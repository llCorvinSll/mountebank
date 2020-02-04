import { Request, Response } from 'express';
import { ILogger } from '../util/scopedLogger';
import { IProtocolFactory, IValidation } from '../models/IProtocol';
import { IImposter, IImposterConfig } from '../models/imposters/IImposter';
import { ParsedUrlQuery } from 'querystring';
import * as Q from 'q';
import { IMontebankError, ValidationError } from '../util/errors';
import * as url from 'url';
import * as helpers from '../util/helpers';
import * as exceptions from '../util/errors';
import * as compatibility from '../models/compatibility';
import { IStubConfig } from '../models/stubs/IStubConfig';


function queryBoolean (query: ParsedUrlQuery, key: string) {
    if (!helpers.defined(query[key])) {
        return false;
    }
    return (query[key] as string).toLowerCase() === 'true';
}

/**
 * The controller that gets and deletes single imposters
 * @module
 */

export class ImposterController {
    /**
     * Creates the imposter controller
     * @param {Object} protocols - the protocol implementations supported by mountebank
     * @param {Object} imposters - The map of ports to imposters
     * @param {Object} logger - The logger
     * @param {Boolean} allowInjection - Whether injection is allowed or not
     */
    public constructor (
        private protocols: {[key: string]: IProtocolFactory},
        private imposters: { [key: string]: IImposter },
        private logger?: ILogger,
        private allowInjection?: boolean) {

    }

    // #region GET

    /**
     * The function responding to GET /imposters/:id
     * @memberOf module:controllers/imposterController#
     * @param {Object} request - the HTTP request
     * @param {Object} response - the HTTP response
     */
    public get = (request: Request, response: Response) => {
        const query = url.parse(request.url, true).query;
        const options = { replayable: queryBoolean(query, 'replayable'), removeProxies: queryBoolean(query, 'removeProxies') };
        const imposter = this.imposters[request.params.id].toJSON(options);

        response.format({
            json: () => { response.send(imposter); },
            html: () => {
                if (request.headers['x-requested-with']) {
                    response.render('_imposter', { imposter: imposter });
                }
                else {
                    response.render('imposter', { imposter: imposter });
                }
            }
        });
    }

    // #endregion

    // #region del

    /**
     * The function responding to DELETE /imposters/:id
     * @memberOf module:controllers/imposterController#
     * @param {Object} request - the HTTP request
     * @param {Object} response - the HTTP response
     * @returns {Object} A promise for testing
     */
    public del = (request: Request, response: Response): Q.Promise<boolean|void> => {
        const imposter: IImposter = this.imposters[request.params.id];
        const query = url.parse(request.url, true).query;
        const options = { replayable: queryBoolean(query, 'replayable'), removeProxies: queryBoolean(query, 'removeProxies') };
        let json = {};

        if (imposter) {
            json = imposter.toJSON(options);
            return imposter.stop().then(() => {
                delete this.imposters[request.params.id];
                response.send(json);
            });
        }
        else {
            response.send(json);
            return Q(true);
        }
    }

    // #endregion

    // #region resetProxies

    /**
     * Corresponds to DELETE /imposters/:id/savedProxyResponses
     * Removes all saved proxy responses
     * @memberOf module:controllers/imposterController#
     * @param {Object} request - the HTTP request
     * @param {Object} response - the HTTP response
     * @returns {Object} A promise for testing
     */
    public resetProxies = (request: Request, response: Response) => {
        const json = {};
        const options = { replayable: false, removeProxies: false };
        const imposter = this.imposters[request.params.id];

        if (imposter) {
            imposter.stubRepository.resetProxies();
            const imposterJson = imposter.toJSON(options);

            response.format({
                json: () => { response.send(imposterJson); },
                html: () => {
                    if (request.headers['x-requested-with']) {
                        response.render('_imposter', { imposter: imposterJson });
                    }
                    else {
                        response.render('imposter', { imposter: imposterJson });
                    }
                }
            });
            return Q(true);
        }
        else {
            response.send(json);
            return Q(true);
        }
    }

    // #endregion

    // #region postRequest

    /**
     * The function responding to POST /imposters/:id/_requests
     * This is what protocol implementations call to send the JSON request
     * structure to mountebank, which responds with the JSON response structure
     * @memberOf module:controllers/imposterController#
     * @param {Object} request - the HTTP request
     * @param {Object} response - the HTTP response
     */
    public postRequest = (request: Request, response: Response) => {
        const imposter = this.imposters[request.params.id];
        const protoRequest = request.body.request;

        imposter.getResponseFor(protoRequest).done(protoResponse => {
            response.send(protoResponse);
        });
    }

    // #endregion

    // #region postProxyResponse

    /**
     * The function responding to POST /imposters/:id/_requests/:proxyResolutionKey
     * This is what protocol implementations call after proxying a request so
     * mountebank can record the response and add behaviors to
     * @memberOf module:controllers/imposterController#
     * @param {Object} request - the HTTP request
     * @param {Object} response - the HTTP response
     */
    public postProxyResponse = (request: Request, response: Response) => {
        const imposter = this.imposters[request.params.id];
        const proxyResolutionKey = request.params.proxyResolutionKey;
        const proxyResponse = request.body.proxyResponse;

        imposter.getProxyResponseFor(proxyResponse, proxyResolutionKey).done(protoResponse => {
            response.send(protoResponse);
        });
    }

    // #endregion

    // #region putStubs

    /**
     * The function responding to PUT /imposters/:id/stubs
     * Overwrites the stubs list without restarting the imposter
     * @memberOf module:controllers/imposterController#
     * @param {Object} request - the HTTP request
     * @param {Object} response - the HTTP response
     * @returns {Object} - promise for testing
     */
    public putStubs = (request: Request, response: Response) => {
        const imposter = this.imposters[request.params.id];
        const newStubs: IStubConfig[] = request.body.stubs;
        const errors: IMontebankError[] = [];

        ImposterController.validateStubs(newStubs, errors);
        if (errors.length > 0) {
            return this.respondWithValidationErrors(response, errors);
        }
        else {
            return this.validate(imposter, newStubs).then(result => {
                if (result.isValid) {
                    imposter.stubRepository.overwriteStubs(newStubs);
                    response.send(imposter.toJSON());
                }
                else {
                    this.respondWithValidationErrors(response, result.errors);
                }
            });
        }
    }

    private validate (imposter: IImposterConfig, newStubs: IStubConfig[]): Q.Promise<IValidation> {
        const request = helpers.clone(imposter);

        request.stubs = newStubs as any;

        compatibility.upcast(request as any);

        const Protocol = this.protocols[request.protocol!];
        const validator = require('../models/dryRunValidator').create({
            testRequest: Protocol.testRequest,
            testProxyResponse: Protocol.testProxyResponse,
            additionalValidation: Protocol.validate,
            allowInjection: this.allowInjection
        });
        return validator.validate(request, this.logger);
    }


    private static validateStubs (stubs: IStubConfig[], errors: IMontebankError[]) {
        if (!helpers.defined(stubs)) {
            errors.push(ValidationError("'stubs' is a required field"));
        }
        else if (!Array.isArray(stubs)) {
            errors.push(ValidationError("'stubs' must be an array"));
        }
    }

    private respondWithValidationErrors (response: Response, validationErrors: IMontebankError[], statusCode = 400) {
        this.logger!.error(`error changing stubs: ${JSON.stringify(exceptions.details(validationErrors as any))}`);
        response.statusCode = statusCode;
        response.send({ errors: validationErrors });
        return Q();
    }

    // #endregion

    // #region putStub

    /**
     * The function responding to PUT /imposters/:id/stubs/:stubIndex
     * Overwrites a single stub without restarting the imposter
     * @memberOf module:controllers/imposterController#
     * @param {Object} request - the HTTP request
     * @param {Object} response - the HTTP response
     * @returns {Object} - promise for testing
     */
    public putStub = (request: Request, response: Response) => {
        const imposter = this.imposters[request.params.id];
        const newStub: IStubConfig = request.body;
        const errors: IMontebankError[] = [];

        this.validateStubIndex(request.params.stubIndex, imposter, errors);
        if (errors.length > 0) {
            return this.respondWithValidationErrors(response, errors, 404);
        }
        else {
            return this.validate(imposter, [newStub]).then(result => {
                if (result.isValid) {
                    imposter.stubRepository.overwriteStubAtIndex(request.params.stubIndex, newStub);
                    response.send(imposter.toJSON());
                }
                else {
                    this.respondWithValidationErrors(response, result.errors);
                }
            });
        }
    }

    private validateStubIndex (index: string, imposter: IImposter, errors: IMontebankError[]) {
        if (typeof imposter.stubRepository.stubs()[parseInt(index)] === 'undefined') {
            errors.push(exceptions.ValidationError("'stubIndex' must be a valid integer, representing the array index position of the stub to replace"));
        }
    }

    // #endregion

    // #region postStub

    /**
     * The function responding to POST /imposters/:port/stubs
     * Creates a single stub without restarting the imposter
     * @memberOf module:controllers/imposterController#
     * @param {Object} request - the HTTP request
     * @param {Object} response - the HTTP response
     * @returns {Object} - promise for testing
     */
    public postStub = (request: Request, response: Response) => {
        const imposter = this.imposters[request.params.id];
        const newStub: IStubConfig = request.body.stub;
        const index = typeof request.body.index === 'undefined' ? imposter.stubRepository.stubs().length : request.body.index;
        const errors = [];

        if (typeof index !== 'number' || index < 0 || index > imposter.stubRepository.stubs().length) {
            errors.push(exceptions.ValidationError("'index' must be between 0 and the length of the stubs array"));
        }
        if (errors.length > 0) {
            return this.respondWithValidationErrors(response, errors);
        }
        else {
            return this.validate(imposter, [newStub]).then(result => {
                if (result.isValid) {
                    imposter.stubRepository.addStubAtIndex(index, newStub);
                    response.send(imposter.toJSON());
                }
                else {
                    this.respondWithValidationErrors(response, result.errors);
                }
            });
        }
    }

    // #endregion

    // #region deleteStub

    /**
     * The function responding to DELETE /imposters/:port/stubs/:stubIndex
     * Removes a single stub without restarting the imposter
     * @memberOf module:controllers/imposterController#
     * @param {Object} request - the HTTP request
     * @param {Object} response - the HTTP response
     * @returns {Object} - promise for testing
     */
    public deleteStub = (request: Request, response: Response) => {
        const imposter: IImposter = this.imposters[request.params.id];
        const errors: IMontebankError[] = [];

        this.validateStubIndex(request.params.stubIndex, imposter, errors);
        if (errors.length > 0) {
            return this.respondWithValidationErrors(response, errors, 404);
        }
        else {

            imposter.stubRepository.deleteStubAtIndex(request.params.stubIndex);
            response.send(imposter.toJSON());
            return Q();
        }
    }

    // #endregion
}
