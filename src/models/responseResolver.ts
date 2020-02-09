import { ILogger } from '../util/scopedLogger';
import * as Q from 'q';
import * as errors from '../util/errors';
import { InjectionError, ValidationError } from '../util/errors';
import { IMountebankResponse, IProxyImplementation, IProxyResponse, IResolver, IServerRequestData } from './IProtocol';
import * as behaviors from './behaviors/behaviors';
import { IProxyConfig, IStubConfig } from './stubs/IStubConfig';
import * as helpers from '../util/helpers';
import * as compatibility from './compatibility';
import { IStubRepository } from './stubs/IStubRepository';
import { newIsResponse, predicatesFor } from './predicatesFor';


interface IPendingProxyResolution {
    responseConfig: IMountebankResponse;
    request: IServerRequestData;
    startTime: Date;
    requestDetails: unknown;
}

function hasMultipleTypes (this: void, responseConfig: IMountebankResponse): boolean {
    return Boolean((responseConfig.is && responseConfig.proxy) ||
        (responseConfig.is && responseConfig.inject) ||
        (responseConfig.proxy && responseConfig.inject));
}


/**
 * Creates the resolver
 * @param {IStubRepository} stubs - The stubs repository
 * @param {IProxyImplementation} proxy - The protocol-specific proxy implementation
 * @param {String} callbackURL - The protocol callback URL for response resolution
 * @returns {Object}
 */
export class ResponseResolver implements IResolver {
    public constructor (
        protected stubs: IStubRepository,
        protected proxy: IProxyImplementation | undefined | null,
        protected callbackURL?: string) {
        this.inProcessProxy = Boolean(proxy);
    }

    private path: string[] = [];
    private nextProxyResolutionKey = 0;
    private pendingProxyResolutions: {[key: number]: IPendingProxyResolution } = {};
    private readonly inProcessProxy: boolean = false;
    private injectState: any = {}; //eslint-disable-line no-unused-vars


    /**
     * Resolves a single response
     * @memberOf module:models/responseResolver#
     * @param {Object} responseConfig - The API-provided response configuration
     * @param {Object} request - The protocol-specific request object
     * @param {Object} logger - The logger
     * @param {Object} imposterState - The current state for the imposter
     * @param {Object} options - Additional options not carried with the request
     * @returns {Object} - Promise resolving to the response
     */
    public resolve (responseConfig: IMountebankResponse, request: IServerRequestData, logger: ILogger, imposterState: unknown, options?: unknown): Q.Promise<IMountebankResponse> {
        if (hasMultipleTypes(responseConfig)) {
            return Q.reject(ValidationError('each response object must have only one response type',
                { source: responseConfig }));
        }

        return this.processResponse(responseConfig, helpers.clone(request), logger, imposterState, options).then((response: IMountebankResponse) => {
            //We may have already run the behaviors in the proxy call to persist the decorated response
            //in the new stub. If so, we need to ensure we don't re-run it
            if (responseConfig.proxy) {
                return Q(response);
            }
            else {
                return Q(behaviors.execute(request, response, responseConfig._behaviors, logger));
            }
        }).then((response: IMountebankResponse) => {
            if (this.inProcessProxy) {
                return Q<IMountebankResponse>(response);
            }
            else {
                return responseConfig.proxy ? Q<IMountebankResponse>(response) : Q<IMountebankResponse>({ response });
            }
        });
    }

    /**
     * Finishes the protocol implementation dance for proxy. On the first call,
     * mountebank selects a JSON proxy response and sends it to the protocol implementation,
     * saving state indexed by proxyResolutionKey. The protocol implementation sends the proxy
     * to the downstream system and calls mountebank again with the response so mountebank
     * can save it and add behaviors
     * @param {Object} proxyResponse - the proxy response from the protocol implementation
     * @param {Number} proxyResolutionKey - the key into the saved proxy state
     * @param {Object} logger - the logger
     * @returns {Object} - Promise resolving to the response
     */
    public resolveProxy (proxyResponse: IProxyResponse, proxyResolutionKey: number, logger: ILogger): Q.Promise<IMountebankResponse> {
        const pendingProxyConfig = this.pendingProxyResolutions[proxyResolutionKey];

        if (pendingProxyConfig) {
            //eslint-disable-next-line no-underscore-dangle
            proxyResponse._proxyResponseTime = new Date().getTime() - pendingProxyConfig.startTime.getTime();

            return behaviors.execute(pendingProxyConfig.request, proxyResponse, pendingProxyConfig.responseConfig._behaviors, logger)
                .then(response => {
                    this.recordProxyResponse(pendingProxyConfig.responseConfig, pendingProxyConfig.request, response, logger);
                    response.recordMatch = () => { pendingProxyConfig.responseConfig.recordMatch && pendingProxyConfig.responseConfig.recordMatch(response); };
                    delete this.pendingProxyResolutions[proxyResolutionKey];
                    return Q(response);
                });
        }
        else {
            logger.error('Invalid proxy resolution key: ' + proxyResolutionKey);
            return Q.reject(errors.MissingResourceError('invalid proxy resolution key',
                { source: `${this.callbackURL}/${proxyResolutionKey}` }));
        }
    }

    private proxyAndRecord (responseConfig: IMountebankResponse, request: IServerRequestData, logger: ILogger, requestDetails: unknown): Q.Promise<any> {
        const startTime = new Date().getTime();

        if (!responseConfig.proxy) {
            throw ValidationError('try proxy without actual config');
        }

        if (['proxyOnce', 'proxyAlways', 'proxyTransparent'].indexOf(responseConfig.proxy.mode) < 0) {
            responseConfig.setMetadata && responseConfig.setMetadata('proxy', { mode: 'proxyOnce' });
        }

        if (this.inProcessProxy) {
            return this.proxy!.to(responseConfig.proxy.to, request, responseConfig.proxy, requestDetails).then(response => {
                //eslint-disable-next-line no-underscore-dangle
                response._proxyResponseTime = new Date().getTime() - startTime;

                //Run behaviors here to persist decorated response
                return Q(behaviors.execute(request, response, responseConfig._behaviors, logger));
            }).then((response: IMountebankResponse) => {
                this.recordProxyResponse(responseConfig, request, response, logger);
                return Q(response);
            });
        }
        else {
            this.pendingProxyResolutions[this.nextProxyResolutionKey] = {
                responseConfig: responseConfig,
                request: request,
                startTime: new Date(),
                requestDetails: requestDetails
            };
            this.nextProxyResolutionKey += 1;
            return Q({
                proxy: responseConfig.proxy,
                request: request,
                callbackURL: `${this.callbackURL}/${this.nextProxyResolutionKey - 1}`
            });
        }
    }


    private processResponse (responseConfig: IMountebankResponse, request: IServerRequestData, logger: ILogger, imposterState: unknown, requestDetails: unknown): Q.Promise<IMountebankResponse> {
        if (responseConfig.is) {
            //Clone to prevent accidental state changes downstream
            return Q(helpers.clone(responseConfig.is));
        }
        else if (responseConfig.proxy) {
            return this.proxyAndRecord(responseConfig, request, logger, requestDetails);
        }
        else if (responseConfig.inject) {
            return this.inject(request, responseConfig.inject, logger, imposterState).then<IMountebankResponse>(Q);
        }
        else {
            return Q.reject(ValidationError('unrecognized response type',
                { source: helpers.clone(responseConfig) }));
        }
    }

    private recordProxyResponse (responseConfig: IMountebankResponse, request: IServerRequestData, response: IMountebankResponse, logger: ILogger) {
        //proxyTransparent prevents the request from being recorded, and always transparently issues the request.
        if (responseConfig.proxy && responseConfig.proxy.mode === 'proxyTransparent') {
            return;
        }

        if (responseConfig.proxy && responseConfig.proxy.mode === 'proxyAlways' && this.canAddResponseToExistingStub(responseConfig, request, logger)) {
            this.addNewResponse(responseConfig, request, response, logger);
        }
        else {
            this.addNewStub(responseConfig, request, response, logger);
        }
    }

    private canAddResponseToExistingStub (responseConfig: IMountebankResponse, request: IServerRequestData, logger: ILogger): boolean {
        return this.stubs.indexOfStubToAddResponseTo(responseConfig, request, this.path, logger) >= 0;
    }

    private addNewResponse (responseConfig: IMountebankResponse, request: IServerRequestData, response: IMountebankResponse, logger: ILogger): void {
        this.stubs.addNewResponse(responseConfig, request, response, this.path, logger);
    }

    private addNewStub (responseConfig: IMountebankResponse, request: IServerRequestData, response: IMountebankResponse, logger: ILogger): void {
        const predicates = predicatesFor(request, (responseConfig.proxy && responseConfig.proxy.predicateGenerators) || [], this.path, logger);
        const stubResponse = newIsResponse(response, responseConfig.proxy as IProxyConfig);
        const newStub: IStubConfig = { predicates: predicates, responses: [stubResponse] };

        if (responseConfig.proxy && responseConfig.proxy.mode === 'proxyAlways') {
            this.stubs.addStub(newStub);
        }
        else {
            this.stubs.addStub(newStub, responseConfig);
        }
    }

    private inject (request: IServerRequestData, fn: string, logger: ILogger, imposterState: unknown) {
        //eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        //@ts-ignore
        //eslint-disable-next-line @typescript-eslint/no-unused-vars
        const injectState: any = this.injectState;
        const deferred = Q.defer();
        const config: any = {
            request: helpers.clone(request),
            state: imposterState,
            logger: logger,
            callback: deferred.resolve
        };

        compatibility.downcastInjectionConfig(config);

        //Leave parameters for older interface
        const injected = `(${fn})(config, injectState, logger, deferred.resolve, imposterState);`;

        if (request.isDryRun === true) {
            Q.delay(1).then(() => {
                deferred.resolve({});
            });
        }
        else {
            try {
                const response = eval(injected);
                if (helpers.defined(response)) {
                    deferred.resolve(response);
                }
            }
            catch (error) {
                logger.error(`injection X=> ${error}`);
                logger.error(`    full source: ${JSON.stringify(injected)}`);
                logger.error(`    config: ${JSON.stringify(config)}`);
                deferred.reject(InjectionError('invalid response injection', {
                    source: injected,
                    data: error.message
                }));
            }
        }
        return deferred.promise;
    }
}
