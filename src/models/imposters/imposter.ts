import {
    IMountebankResponse,
    IProtocolFactory,
    IProxyResponse,
    IResolver,
    IServer,
    IServerRequestData
} from '../IProtocol';
import { IImposter, IImposterConfig, IImposterPrintOptions, IpValidator } from './IImposter';
import * as Q from 'q';
import { ILogger } from '../../util/scopedLogger';
import { IProtocolLoadOptions } from '../protocols';
import * as domainNsp from 'domain';
import { Domain } from 'domain';
import * as helpers from '../../util/helpers';
import * as compatibility from '../compatibility';
import { ImposterPrinter } from './imposterPrinter';
import { IStubRepository } from '../stubs/IStubRepository';
import * as _ from 'lodash';
import { IRequestsStorage } from '../storage/IRequestsStorage';
import { RedisRequestsStorage } from '../storage/RedisRequestsStorage';
import * as uuidv4 from 'uuid/v4';

/**
 * An imposter represents a protocol listening on a socket.  Most imposter
 * functionality is in each particular protocol implementation.  This module
 * exists as a bridge between the API and the protocol, mapping back to pretty
 * JSON for the end user.
 * @module
 */


function createErrorHandler (deferred: Q.Deferred<unknown>, port: number) {
    return (error: any) => {
        const errors = require('../../util/errors');

        if (error.errno === 'EADDRINUSE') {
            deferred.reject(errors.ResourceConflictError(`Port ${port} is already in use`));
        }
        else if (error.errno === 'EACCES') {
            deferred.reject(errors.InsufficientAccessError());
        }
        else {
            deferred.reject(error);
        }
    };
}

/**
 * Create the imposter
 * @param {Object} Protocol - The protocol factory for creating servers of that protocol
 * @param {Object} creationRequest - the parsed imposter JSON
 * @param {Object} baseLogger - the logger
 * @param {Object} config - command line options
 * @param {Function} isAllowedConnection - function to determine if the IP address of the requestor is allowed
 * @returns {Object}
 */
export class Imposter implements IImposter {
    public constructor (
        protected Protocol: IProtocolFactory,
        protected creationRequest: IImposterConfig,
        protected baseLogger: ILogger,
        protected config: IProtocolLoadOptions,
        protected isAllowedConnection: IpValidator) {
        compatibility.upcast(this.creationRequest);

        const numericId = _.uniqueId(`imposter_${creationRequest.protocol}_${creationRequest.port}_`);
        this.uuid = `${numericId}-${uuidv4()}`;

        this.logger = require('../../util/scopedLogger').create(baseLogger, this.scopeFor(creationRequest.port!));
        //If the CLI --mock flag is passed, we record even if the imposter level recordRequests = false
        const recordRequests = Boolean(config.recordRequests) || Boolean(creationRequest.recordRequests);

        this.requestsStorage = new RedisRequestsStorage(this.uuid, recordRequests);
    }

    private readonly uuid: string;

    private readonly logger: ILogger;
    private resolver: IResolver;
    private domain: Domain;
    private server: IServer;
    private requestsStorage: IRequestsStorage;

    private imposterState = {};
    public protocol: string;

    public init (): Q.Promise<IImposter> {
        this.domain = domainNsp.create();
        const deferred = Q.defer<IImposter>();

        const errorHandler = createErrorHandler(deferred, this.creationRequest.port!);

        this.domain.on('error', errorHandler);

        this.domain.run(() => {
            if (!helpers.defined(this.creationRequest.host) && helpers.defined(this.config.host)) {
                this.creationRequest.host = this.config.host;
            }

            this.Protocol.createServer && this.Protocol.createServer(
                this.creationRequest,
                this.logger,
                (request: IServerRequestData, requestDetails: unknown) => this.getResponseFor(request, requestDetails))
                .done(server => {
                    this.server = server;

                    if (this.creationRequest.port !== server.port) {
                        this.logger.changeScope(this.scopeFor(String(server.port)));
                    }
                    this.logger.info('Open for business...');

                    this.resolver = server.resolver;

                    if (this.creationRequest.stubs) {
                        this.creationRequest.stubs.forEach(st => this.server.stubs.addStub(st));
                    }

                    return deferred.resolve(this);
                });
        });

        return deferred.promise;
    }

    public get port (): number {
        return this.server.port;
    }

    public get url (): string {
        return '/imposters/' + this.server.port;
    }

    public getJSON (options?: IImposterPrintOptions): Q.Promise<any> {
        return this.requestsStorage.getRequests()
            .then(requests => {
                const printer = new ImposterPrinter(this.creationRequest, this.server, requests);
                return printer.toJSON(this.requestsStorage.getCount(), options);
            });
    }

    public stop () {
        const stopDeferred = Q.defer();
        this.server.close(() => {
            this.logger.info('Ciao for now');
            return stopDeferred.resolve({});
        });
        return stopDeferred.promise;
    }

    get stubRepository (): IStubRepository {
        return this.server.stubs;
    }

    //requestDetails are not stored with the imposter
    //It was created to pass the raw URL to maintain the exact querystring during http proxying
    //without having to change the path / query options on the stored request
    public getResponseFor (request: IServerRequestData, requestDetails?: unknown): Q.Promise<IMountebankResponse> {
        if (!this.isAllowedConnection(request.ip, this.logger)) {
            return Q({ blocked: true, code: 'unauthorized ip address' });
        }

        this.requestsStorage.saveRequest(request);

        const responseConfig = this.server.stubs.getResponseFor(request, this.logger, this.imposterState);

        const responcePromise = this.resolver.resolve(responseConfig, request, this.logger, this.imposterState, requestDetails).then(response => {
            if (this.config.recordMatches && !response.proxy) {
                if (response.response) {
                    //Out of process responses wrap the result in an outer response object
                    responseConfig.recordMatch && responseConfig.recordMatch(response.response);
                }
                else {
                    //In process resolution
                    responseConfig.recordMatch && responseConfig.recordMatch(response);
                }
            }
            return Q(response);
        });

        return responcePromise;
    }

    public getProxyResponseFor (proxyResponse: IProxyResponse, proxyResolutionKey: number) {
        return this.resolver.resolveProxy(proxyResponse, proxyResolutionKey, this.logger).then(response => {
            if (this.config.recordMatches) {
                response.recordMatch!();
            }
            return Q(response);
        });
    }

    private scopeFor (port: string|number): string {
        let scope = `${this.creationRequest.protocol}:${port}`;

        if (this.creationRequest.name) {
            scope += ' ' + this.creationRequest.name;
        }
        return scope;
    }
}
