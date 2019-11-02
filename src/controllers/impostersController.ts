'use strict';

import {ILogger} from "../util/scopedLogger";
import {IImposter, IImposterConfig} from "../models/IImposter";
import {details, IMontebankError, ValidationError} from "../util/errors";
import {Request, Response} from "express";
import {IProtocolFactory, IValidation} from "../models/IProtocol";
import {ParsedUrlQuery} from "querystring";
import * as Q from 'q';
import * as helpers from '../util/helpers';
import * as url from 'url';


const queryIsFalse = (query: ParsedUrlQuery, key: string) => !helpers.defined(query[key]) || (query[key] as string).toLowerCase() !== 'false';
const queryBoolean = (query: ParsedUrlQuery, key: string) => helpers.defined(query[key]) && (query[key] as string).toLowerCase() === 'true';

/**
 * The controller that manages the list of imposters
 * @module
 */

/**
 * Creates the imposters controller
 * @param {Object} protocols - the protocol implementations supported by mountebank
 * @param {Object} imposters - The map of ports to imposters
 * @param {Object} logger - The logger
 * @param {Boolean} allowInjection - Whether injection is allowed or not
 * @returns {{get, post, del, put}}
 */
export class ImpostersController {
    public constructor(
        private protocols: {[key: string]: IProtocolFactory},
        private imposters: { [key: string]: IImposter },
        private logger: ILogger,
        private allowInjection: boolean) {
    }


    /**
     * The function responding to GET /imposters
     * @memberOf module:controllers/impostersController#
     * @param {Object} request - the HTTP request
     * @param {Object} response - the HTTP response
     */
    public get = (request: Request, response: Response) => {
        response.format({
            json: () => {
                const query = url.parse(request.url, true).query,
                    options = {
                        replayable: queryBoolean(query, 'replayable'),
                        removeProxies: queryBoolean(query, 'removeProxies'),
                        list: !(queryBoolean(query, 'replayable') || queryBoolean(query, 'removeProxies'))
                    };

                response.send({imposters: this.getJSON(options)});
            },
            html: () => {
                response.render('imposters', {imposters: this.getJSON()});
            }
        });
    }

    /**
     * The function responding to POST /imposters
     * @memberOf module:controllers/impostersController#
     * @param {Object} request - the HTTP request
     * @param {Object} response - the HTTP response
     * @returns {Object} A promise for testing purposes
     */
    public post = (request: Request, response: Response) => {
        const protocol = request.body.protocol,
            validationPromise = this.validate(request.body);

        this.logger.debug(this.requestDetails(request));

        return validationPromise.then(validation => {
            if (validation.isValid) {
                let protocol_factory = this.protocols[protocol];
                if (protocol_factory && protocol_factory.createImposterFrom) {
                    return protocol_factory.createImposterFrom(request.body).then(imposter => {
                        this.imposters[imposter.port] = imposter;
                        response.setHeader('Location', imposter.url);
                        response.statusCode = 201;
                        response.send(imposter.toJSON());
                    }, error => {
                        this.respondWithCreationError(response, error);
                    });
                } else {
                    this.respondWithCreationError(response, ValidationError("protocol has no creators"))
                }
            } else {
                this.respondWithValidationErrors(response, validation.errors);
                return Q<void>(false as any);
            }
        });
    }

    /**
     * The function responding to DELETE /imposters
     * @memberOf module:controllers/impostersController#
     * @param {Object} request - the HTTP request
     * @param {Object} response - the HTTP response
     * @returns {Object} A promise for testing purposes
     */
    public del = (request: Request, response: Response) => {
        const url = require('url'),
            query = url.parse(request.url, true).query,
            options = {
                // default to replayable for backwards compatibility
                replayable: queryIsFalse(query, 'replayable'),
                removeProxies: queryBoolean(query, 'removeProxies')
            },
            json = this.getJSON(options);

        return this.deleteAllImposters().then(() => {
            response.send({imposters: json});
        });
    }

    /**
     * The function responding to PUT /imposters
     * @memberOf module:controllers/impostersController#
     * @param {Object} request - the HTTP request
     * @param {Object} response - the HTTP response
     * @returns {Object} A promise for testing purposes
     */
    public put = (request: Request, response: Response) => {
        const requestImposters: IImposterConfig[] = request.body.imposters || [],
            validationPromises: Q.Promise<IValidation>[] = requestImposters.map((imposter: IImposterConfig) => this.validate(imposter));

        this.logger.debug(this.requestDetails(request));

        if (!('imposters' in request.body)) {
            this.respondWithValidationErrors(response, [
                ValidationError("'imposters' is a required field")
            ]);
            return Q(false);
        }

        return Q.all(validationPromises).then((validations) => {
            const isValid = validations.every(validation => validation.isValid);

            if (isValid) {
                return this.deleteAllImposters().then(() => {
                    const creationPromises = requestImposters.map((imposter) => {
                            let protocol_factory = this.protocols[imposter.protocol];
                            if (protocol_factory && protocol_factory.createImposterFrom) {
                                return protocol_factory.createImposterFrom(imposter);
                            }
                            return undefined;
                        }
                    );
                    return Q.all(creationPromises);
                }).then((allImposters: IImposter[]) => {
                    const json = allImposters.map(imposter => imposter.toJSON({list: true}));
                    allImposters.forEach(imposter => {
                        this.imposters[imposter.port] = imposter;
                    });
                    response.send({imposters: json});
                }, error => {
                    this.respondWithCreationError(response, error);
                });
            } else {
                const validationErrors = validations.reduce((accumulator, validation) => accumulator.concat(validation.errors), [] as IMontebankError[]);
                this.respondWithValidationErrors(response, validationErrors);
                return Q<void>(false as any);
            }
        });
    }


    private deleteAllImposters() {
        const ids = Object.keys(this.imposters),
            promises = ids.map(id => this.imposters[id].stop());

        ids.forEach(id => {
            delete this.imposters[id];
        });
        return Q.all(promises);
    }

    private validatePort(port: number, errors: IMontebankError[]) {
        const portIsValid = !helpers.defined(port) || (port.toString().indexOf('.') === -1 && port > 0 && port < 65536);

        if (!portIsValid) {
            errors.push(ValidationError("invalid value for 'port'"));
        }
    }

    private validateProtocol(protocol: string, errors: IMontebankError[]) {
        const Protocol = this.protocols[protocol];

        if (!helpers.defined(protocol)) {
            errors.push(ValidationError("'protocol' is a required field"));
        } else if (!Protocol) {
            errors.push(ValidationError(`the ${protocol} protocol is not yet supported`));
        }
    }

    private validate(request: IImposterConfig): Q.Promise<IValidation> {
        const errors: IMontebankError[] = [],
            compatibility = require('../models/compatibility');

        compatibility.upcast(request);

        this.validatePort(request.port, errors);
        this.validateProtocol(request.protocol, errors);

        if (errors.length > 0) {
            return Q({isValid: false, errors});
        } else {
            const Protocol = this.protocols[request.protocol],
                validator = require('../models/dryRunValidator').create({
                    testRequest: Protocol.testRequest,
                    testProxyResponse: Protocol.testProxyResponse,
                    additionalValidation: Protocol.validate,
                    allowInjection: this.allowInjection
                });
            return validator.validate(request, this.logger);
        }
    }

    private respondWithValidationErrors(response: Response, validationErrors: IMontebankError[]) {
        // TODO: wrong typing for details()
        this.logger.error(`error creating imposter: ${JSON.stringify(details(validationErrors as any))}`);
        response.statusCode = 400;
        response.send({errors: validationErrors});
    }

    private respondWithCreationError(response: Response, error: IMontebankError) {
        this.logger.error(`error creating imposter: ${JSON.stringify(details(error))}`);
        response.statusCode = (error.code === 'insufficient access') ? 403 : 400;
        response.send({errors: [error]});
    }

    private getJSON(options?: any) {
        return Object.keys(this.imposters).reduce((accumulator, id) => accumulator.concat(this.imposters[id].toJSON(options)), [] as string[]);
    }

    private requestDetails(request: Request) {
        return `${helpers.socketName(request.socket)} => ${JSON.stringify(request.body)}`;
    }
}
