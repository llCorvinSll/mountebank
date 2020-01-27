'use strict';

import {
    IMountebankResponse,
    IProtocolFactory,
    IProxyResponse,
    IResolver,
    IServer,
    IServerRequestData
} from "../IProtocol";
import {IImposter, IImposterConfig, ImposterPrintOptions, IpValidator} from "./IImposter";
import * as Q from "q";
import {ILogger} from "../../util/scopedLogger";
import {IProtocolLoadOptions} from "../protocols";
import {IStubConfig} from "../stubs/IStubConfig";
import * as domain_nsp from "domain";
import {Domain} from "domain";
import * as helpers from '../../util/helpers';
import * as compatibility from '../compatibility';
import {IStub} from "../stubs/IStub";
import {ImposterPrinter} from "./imposterPrinter";

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
    public constructor(
        protected Protocol: IProtocolFactory,
        protected creationRequest:IImposterConfig,
        protected baseLogger: ILogger,
        protected config: IProtocolLoadOptions,
        protected isAllowedConnection: IpValidator) {
        compatibility.upcast(this.creationRequest);

        this.logger = require('../../util/scopedLogger').create(baseLogger, this.scopeFor(creationRequest.port!));
        // If the CLI --mock flag is passed, we record even if the imposter level recordRequests = false
        this.recordRequests = !!config.recordRequests || !!creationRequest.recordRequests;
    }

    private readonly logger: ILogger;
    private resolver: IResolver;
    private domain: Domain;
    private server: IServer;
    private numberOfRequests = 0;
    private requests: IServerRequestData[] = [];
    private readonly recordRequests: boolean = false;
    private imposterState = {};
    private printer:any;
    //TODO: not required field
    public protocol:string;

    public init(): Q.Promise<IImposter> {
        this.domain = domain_nsp.create();
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

                    this.printer = new ImposterPrinter(this.creationRequest, this.server, this.requests);

                    if (this.creationRequest.stubs) {
                        this.creationRequest.stubs.forEach((st) => this.server.stubs.addStub(st));
                    }

                    return deferred.resolve(this);
                });
        });

        return deferred.promise;
    }

    public get port(): number {
        return this.server.port;
    }

    public get url(): string {
        return '/imposters/' + this.server.port;
    }

    public toJSON(options?:ImposterPrintOptions): string {
        return this.printer.toJSON(this.numberOfRequests, options);
    }

    public stop() {
        const stopDeferred = Q.defer();
        this.server.close(() => {
            this.logger.info('Ciao for now');
            return stopDeferred.resolve({});
        });
        return stopDeferred.promise;
    }

    //#region ProxyMethods

    public resetProxies() {
        this.server.stubs.resetProxies();
    };

    public addStub(stub: IStubConfig, beforeResponse?: IMountebankResponse) {
        this.server.stubs.addStub(stub, beforeResponse);
    };

    public stubs(): IStub[] {
        return this.server.stubs.stubs();
    }

    public overwriteStubs(stubs: IStubConfig[]) {
        this.server.stubs.overwriteStubs(stubs);
    }

    public overwriteStubAtIndex(index: string, newStub: IStubConfig) {
        this.server.stubs.overwriteStubAtIndex(index, newStub);
    }

    public deleteStubAtIndex(index: string) {
        this.server.stubs.deleteStubAtIndex(index);
    }

    public addStubAtIndex(index: string, newStub: IStubConfig) {
        this.server.stubs.addStubAtIndex(index, newStub);
    }

    //#endregion


    // requestDetails are not stored with the imposter
    // It was created to pass the raw URL to maintain the exact querystring during http proxying
    // without having to change the path / query options on the stored request
    public getResponseFor(request: IServerRequestData, requestDetails?: unknown): Q.Promise<IMountebankResponse> {
        if (!this.isAllowedConnection(request.ip, this.logger)) {
            return Q({blocked: true, code: 'unauthorized ip address'});
        }

        this.numberOfRequests += 1;
        if (this.recordRequests) {
            const recordedRequest = helpers.clone(request);
            recordedRequest.timestamp = new Date().toJSON();
            this.requests.push(recordedRequest);
        }

        const responseConfig = this.server.stubs.getResponseFor(request, this.logger, this.imposterState);
        return this.resolver.resolve(responseConfig, request, this.logger, this.imposterState, requestDetails).then(response => {
            if (this.config.recordMatches && !response.proxy) {
                if (response.response) {
                    // Out of process responses wrap the result in an outer response object
                    responseConfig.recordMatch && responseConfig.recordMatch(response.response);
                } else {
                    // In process resolution
                    responseConfig.recordMatch && responseConfig.recordMatch(response);
                }
            }
            return Q(response);
        });
    }

    public getProxyResponseFor(proxyResponse: IProxyResponse, proxyResolutionKey: number) {
        return this.resolver.resolveProxy(proxyResponse, proxyResolutionKey, this.logger).then(response => {
            if (this.config.recordMatches) {
                // @ts-ignore
                response.recordMatch();
            }
            return Q(response);
        });
    }

    private scopeFor(port: string|number): string {
        let scope = `${this.creationRequest.protocol}:${port}`;

        if (this.creationRequest.name) {
            scope += ' ' + this.creationRequest.name;
        }
        return scope;
    }

}
