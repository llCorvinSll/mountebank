'use strict';

import {IRequest, IResponse} from "./IRequest";
import {ILogger} from "../util/scopedLogger";
import * as Q from "q";
import {InjectionError, ValidationError} from "../util/errors";
import {IMountebankResponse, IProxyImplementation, IProxyResponse, IResolver, IServerRequestData} from "./IProtocol";
import {IJsonPathConfig, IPredicate, IXPathConfig} from "./predicates/IPredicate";
import * as behaviors from "./behaviors/behaviors";
import {IProxyConfig, IStubConfig} from "./stubs/IStubConfig";
import * as  helpers from '../util/helpers';
import * as jsonpath from './jsonpath';
import * as compatibility from './compatibility';
import * as xpath from './xpath';
import * as errors from '../util/errors';
import * as stringify from 'json-stable-stringify';
import {IStubRepository} from "./stubs/IStubRepository";


interface IPendingProxyResolution {
    responseConfig: IMountebankResponse;
    request: IServerRequestData;
    startTime: Date;
    requestDetails: unknown;
}

function hasMultipleTypes (this:void, responseConfig: IMountebankResponse):boolean {
    return !!((responseConfig.is && responseConfig.proxy) ||
        (responseConfig.is && responseConfig.inject) ||
        (responseConfig.proxy && responseConfig.inject));
}


function newIsResponse (this: void, response: IMountebankResponse, proxyConfig: IProxyConfig):IResponse {
    const result:IResponse = { is: response };
    const addBehaviors:IProxyConfig = {} as any;

    if (proxyConfig.addWaitBehavior && response._proxyResponseTime) { // eslint-disable-line no-underscore-dangle
        // @ts-ignore
        addBehaviors.wait = response._proxyResponseTime; // eslint-disable-line no-underscore-dangle
    }
    if (proxyConfig.addDecorateBehavior) {
        addBehaviors.decorate = proxyConfig.addDecorateBehavior;
    }

    if (Object.keys(addBehaviors).length) {
        // @ts-ignore
        result._behaviors = addBehaviors;
    }
    return result;
}


function xpathValue (xpathConfig: IXPathConfig, possibleXML: string, logger: ILogger) {
    const nodes = xpath.select(xpathConfig.selector, xpathConfig.ns, possibleXML, logger);
    return selectionValue(nodes);
}


function jsonpathValue (jsonpathConfig: IJsonPathConfig, possibleJSON: string, logger: ILogger) {
    const nodes = jsonpath.select(jsonpathConfig.selector, possibleJSON, logger);
    return selectionValue(nodes);
}

// @ts-ignore
function selectionValue (nodes) {
    if (!helpers.defined(nodes)) {
        return '';
    }
    else if (!Array.isArray(nodes)) {
        return nodes; // booleans and counts
    }
    else {
        return (nodes.length === 1) ? nodes[0] : nodes;
    }
}


function deepEqual (obj1: unknown, obj2: unknown) {
    return stringify(obj1) === stringify(obj2);
}


/**
 * Creates the resolver
 * @param {IStubRepository} stubs - The stubs repository
 * @param {IProxyImplementation} proxy - The protocol-specific proxy implementation
 * @param {String} callbackURL - The protocol callback URL for response resolution
 * @returns {Object}
 */
export class ResponseResolver implements IResolver {
    public constructor(
        protected stubs: IStubRepository,
        protected proxy: IProxyImplementation | undefined,
        protected callbackURL?: string) {
        this.inProcessProxy = Boolean(proxy);
    }

    private path:string[] = [];
    private nextProxyResolutionKey = 0;
    private pendingProxyResolutions: {[key: number]:IPendingProxyResolution } = {};
    private readonly inProcessProxy:boolean = false;
    // @ts-ignore
    private injectState:any = {}; // eslint-disable-line no-unused-vars



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
            // We may have already run the behaviors in the proxy call to persist the decorated response
            // in the new stub. If so, we need to ensure we don't re-run it
            if (responseConfig.proxy) {
                return Q(response);
            } else {
                return Q(behaviors.execute(request, response, responseConfig._behaviors, logger));
            }
        }).then((response: IMountebankResponse) => {
            if (this.inProcessProxy) {
                return Q<IMountebankResponse>(response);
            } else {
                return responseConfig.proxy ? Q<IMountebankResponse>(response) : Q<IMountebankResponse>({response});
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
            // eslint-disable-next-line no-underscore-dangle
            proxyResponse._proxyResponseTime = new Date().getTime() - pendingProxyConfig.startTime.getTime();

            return behaviors.execute(pendingProxyConfig.request, proxyResponse, pendingProxyConfig.responseConfig._behaviors, logger)
                .then((response) => {
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

    private proxyAndRecord (responseConfig: IMountebankResponse, request: IServerRequestData, logger: ILogger, requestDetails: unknown):Q.Promise<any> {
        const startTime = new Date().getTime();

        if (!responseConfig.proxy) {
            throw ValidationError("try proxy without actual config")
        }

        if (['proxyOnce', 'proxyAlways', 'proxyTransparent'].indexOf(responseConfig.proxy.mode) < 0) {
            responseConfig.setMetadata && responseConfig.setMetadata('proxy', { mode: 'proxyOnce' });
        }

        if (this.inProcessProxy) {
            return (this.proxy as any).to(responseConfig.proxy.to, request, responseConfig.proxy, requestDetails).then(response => {
                // eslint-disable-next-line no-underscore-dangle
                response._proxyResponseTime = new Date().getTime() - startTime;

                // Run behaviors here to persist decorated response
                return Q(behaviors.execute(request, response, responseConfig._behaviors, logger));
            }).then((response) => {
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
            // Clone to prevent accidental state changes downstream
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
        // proxyTransparent prevents the request from being recorded, and always transparently issues the request.
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

    private indexOfStubToAddResponseTo (responseConfig: IMountebankResponse, request: IServerRequestData, logger: ILogger) {
        const predicates = this.predicatesFor(request, responseConfig.proxy && responseConfig.proxy.predicateGenerators || [], logger),
            stubList = this.stubs.stubs();

        for (let index = this.stubIndexFor(responseConfig) + 1; index < stubList.length; index += 1) {
            if (deepEqual(predicates, stubList[index].predicates)) {
                return index;
            }
        }
        return -1;
    }

    private canAddResponseToExistingStub (responseConfig: IMountebankResponse, request: IServerRequestData, logger: ILogger): boolean {
        return this.indexOfStubToAddResponseTo(responseConfig, request, logger) >= 0;
    }

    private addNewResponse (responseConfig: IMountebankResponse, request: IServerRequestData, response: IMountebankResponse, logger: ILogger):void {
        const stubResponse:IResponse = newIsResponse(response, responseConfig.proxy as IProxyConfig);
        const responseIndex = this.indexOfStubToAddResponseTo(responseConfig, request, logger);

        let i_stub = this.stubs.stubs()[responseIndex];
        i_stub.addResponse && i_stub.addResponse(stubResponse);
    }

    private addNewStub (responseConfig: IMountebankResponse, request :IServerRequestData, response: IMountebankResponse, logger: ILogger):void {
        const predicates = this.predicatesFor(request, (responseConfig.proxy && responseConfig.proxy.predicateGenerators) || [], logger),
            stubResponse = newIsResponse(response, responseConfig.proxy as IProxyConfig),
            newStub:IStubConfig = { predicates: predicates, responses: [stubResponse] };

        if (responseConfig.proxy && responseConfig.proxy.mode === 'proxyAlways') {
            this.stubs.addStub(newStub);
        }
        else {
            this.stubs.addStub(newStub, responseConfig);
        }
    }

    // @ts-ignore
    private predicatesFor (request: IServerRequestData, matchers, logger: ILogger) {
        // @ts-ignore
        const predicates = [];

        // @ts-ignore
        matchers.forEach(matcher => {
            if (matcher.inject) {
                // eslint-disable-next-line no-unused-vars
                // @ts-ignore
                const config = { request, logger },
                    injected = `(${matcher.inject})(config);`;
                try {
                    // @ts-ignore
                    predicates.push(...eval(injected));
                }
                catch (error) {
                    logger.error(`injection X=> ${error}`);
                    logger.error(`    source: ${JSON.stringify(injected)}`);
                    logger.error(`    request: ${JSON.stringify(request)}`);
                    throw errors.InjectionError('invalid predicateGenerator injection', { source: injected, data: error.message });
                }
                return;
            }

            const basePredicate:IPredicate = {} as any;
            let hasPredicateOperator: boolean = false;
            // @ts-ignore
            let predicateOperator; // eslint-disable-line no-unused-vars
            // @ts-ignore
            let valueOf = field => field;

            // Add parameters
            Object.keys(matcher).forEach(key => {
                if (key !== 'matches' && key !== 'predicateOperator') {
                    // @ts-ignore
                    basePredicate[key] = matcher[key];
                }
                if (key === 'xpath') {
                    valueOf = field => xpathValue(matcher.xpath, field, logger);
                }
                else if (key === 'jsonpath') {
                    valueOf = field => jsonpathValue(matcher.jsonpath, field, logger);
                }
                else if (key === 'predicateOperator') {
                    hasPredicateOperator = true;
                    predicateOperator = matcher[key];
                }
            });

            Object.keys(matcher.matches).forEach(fieldName => {
                const matcherValue = matcher.matches[fieldName],
                    predicate = helpers.clone(basePredicate);
                if (matcherValue === true && !hasPredicateOperator) {
                    predicate.deepEquals = {};
                    // @ts-ignore
                    predicate.deepEquals[fieldName] = valueOf(request[fieldName]);
                }
                else if (hasPredicateOperator && matcher.predicateOperator === 'exists') {
                    // @ts-ignore
                    predicate[matcher.predicateOperator] = this.buildExists(request, fieldName, matcherValue, request);
                }
                else if (hasPredicateOperator && matcher.predicateOperator !== 'exists') {
                    predicate[matcher.predicateOperator] = valueOf(request);
                }
                else {
                    predicate.equals = {};
                    // @ts-ignore
                    predicate.equals[fieldName] = this.buildEquals(request[fieldName], matcherValue, valueOf);
                }

                // @ts-ignore
                predicates.push(predicate);
            });
        });

        // @ts-ignore
        return predicates;
    }

    // @ts-ignore
    private stubIndexFor (responseConfig) {
        const stubList = this.stubs.stubs();
        for (var i = 0; i < stubList.length; i += 1) {
            let current_stub = stubList[i];
            if (current_stub.responses && current_stub.responses.some(response => deepEqual(response, responseConfig))) {
                break;
            }
        }
        return i;
    }

    // @ts-ignore
    private buildEquals (request: IRequest, matchers, valueOf) {
        const result = {};

        Object.keys(matchers).forEach(key => {
            if (helpers.isObject(request[key])) {
                // @ts-ignore
                result[key] = this.buildEquals(request[key], matchers[key], valueOf);
            }
            else {
                // @ts-ignore
                result[key] = valueOf(request[key]);
            }
        });
        return result;
    }


    // @ts-ignore
    private buildExists (request: IRequest | undefined, fieldName: string, matchers, initialRequest) {
        request = request || {} as IRequest;

        Object.keys(request || {}).forEach(key => {
            this.path.push(key);
            // @ts-ignore
            if (helpers.isObject(request[key])) {
                // @ts-ignore
                this.buildExists(request[key], fieldName, matchers[key], initialRequest);
            }
            else {
                const booleanValue = (typeof fieldName !== 'undefined' && fieldName !== null && fieldName !== '');
                helpers.setDeep(initialRequest, this.path, booleanValue);
            }
        });
        return initialRequest;
    }

    private inject (request: IServerRequestData, fn: string, logger: ILogger, imposterState: unknown) {
        // @ts-ignore
        const injectState:any = this.injectState;
        const deferred = Q.defer();
        let config:any = {
            request: helpers.clone(request),
            state: imposterState,
            logger: logger,
            callback: deferred.resolve
        };

        compatibility.downcastInjectionConfig(config);

        // Leave parameters for older interface
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
