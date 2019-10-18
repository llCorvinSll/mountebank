'use strict';

import {ILogger} from "../util/scopedLogger";
import {IRequest, IResponse} from "./IRequest";
import {IPredicate} from "./IPredicate";
import {IStubConfig} from "./IStubConfig";


/**
 * Maintains all stubs for an imposter
 * @module
 */

export interface IStubRepository {
    stubs: () => IStubConfig[];
    addStub(stub: IStubConfig):void;
    addStubAtIndex(index: string, newStub: IStubConfig): void;
    overwriteStubs(newStubs: IStubConfig[]): void;
    overwriteStubAtIndex(index: string, newStub: IStubConfig):void;
    deleteStubAtIndex(index: string):void;
    getResponseFor(request: IRequest, logger: ILogger, imposterState: unknown):IStubConfig;
    resetProxies():void;
}

/**
 * Creates the repository
 * @param {string} encoding - utf8 or base64
 * @returns {Object}
 */
export function create (encoding: string): IStubRepository {
    /**
     * The list of stubs within this repository
     * @memberOf module:models/stubRepository#
     * @type {Array}
     */
    const stubs: IStubConfig[] = [];

    // We call map before calling every so we make sure to call every
    // predicate during dry run validation rather than short-circuiting
    function trueForAll (list: IPredicate[], predicate: (p: IPredicate) => boolean) {
        return list.map(predicate).every(result => result);
    }

    function findFirstMatch (request: IRequest, logger: ILogger, imposterState: unknown): IStubConfig | undefined {
        if (stubs.length === 0) {
            return undefined;
        }

        const helpers = require('../util/helpers'),
            readOnlyState = helpers.clone(imposterState),
            matches = stubs.filter(stub => {
                const stubPredicates: IPredicate[] = stub.predicates || [],
                    predicates = require('./predicates');

                return trueForAll(stubPredicates,
                    (predicate: IPredicate) => predicates.evaluate(predicate, request, encoding, logger, readOnlyState));
            });

        if (matches.length === 0) {
            logger.debug('no predicate match');
            return undefined;
        }
        else {
            logger.debug(`using predicate match: ${JSON.stringify(matches[0].predicates || {})}`);
            return matches[0];
        }
    }

    function repeatsFor (response: IResponse) {
        if (response._behaviors && response._behaviors.repeat) {
            return response._behaviors.repeat;
        }
        else {
            return 1;
        }
    }

    function repeatTransform (responses: IResponse[]): IResponse[] {
        const result = [];
        let response, repeats;

        for (let i = 0; i < responses.length; i += 1) {
            response = responses[i];
            repeats = repeatsFor(response);
            for (let j = 0; j < repeats; j += 1) {
                result.push(response);
            }
        }
        return result;
    }

    function stubIndexFor (responseToMatch: object) {
        let i = 0;
        for (i; i < stubs.length; i += 1) {
            let current_stub = stubs[i];
            if (current_stub.responses && current_stub.responses.some(response => JSON.stringify(response) === JSON.stringify(responseToMatch))) {
                break;
            }
        }
        return i;
    }

    function decorate (stub: IStubConfig) {
        stub.statefulResponses = repeatTransform(stub.responses as IResponse[]);
        stub.addResponse = response => { stub.responses && stub.responses.push(response); };
        return stub;
    }

    /**
     * Adds a stub to the repository
     * @memberOf module:models/stubRepository#
     * @param {Object} stub - The stub to add
     * @param {Object} beforeResponse - If provided, the new stub will be added before the stub containing the response (used for proxyOnce)
     */
    function addStub (stub: IStubConfig, beforeResponse?: object): void {
        if (beforeResponse) {
            stubs.splice(stubIndexFor(beforeResponse), 0, decorate(stub));
        }
        else {
            stubs.push(decorate(stub));
        }
    }

    /**
     * Adds a stub at stubIndex without changing the state of any other stubs
     * @memberOf module:models/stubRepository#
     * @param {Number} index - the index of the stub to change
     * @param {Object} newStub - the new stub
     */
    function addStubAtIndex (index: string, newStub: IStubConfig): void {
        stubs.splice(parseInt(index), 0, decorate(newStub));
    }

    /**
     * Overwrites the entire list of stubs
     * @memberOf module:models/stubRepository#
     * @param {Object} newStubs - the new list of stubs
     */
    function overwriteStubs (newStubs: IStubConfig[]): void {
        while (stubs.length > 0) {
            stubs.pop();
        }
        newStubs.forEach(stub => addStub(stub));
    }

    /**
     * Overwrites the stub at stubIndex without changing the state of any other stubs
     * @memberOf module:models/stubRepository#
     * @param {Number} index - the index of the stub to change
     * @param {Object} newStub - the new stub
     */
    function overwriteStubAtIndex (index: string, newStub: IStubConfig): void {
        stubs[parseInt(index)] = decorate(newStub);
    }

    /**
     * Deletes the stub at stubIndex without changing the state of any other stubs
     * @memberOf module:models/stubRepository#
     * @param {Number} index - the index of the stub to remove
     */
    function deleteStubAtIndex (index: string): void {
        stubs.splice(parseInt(index), 1);
    }

    /**
     * Returns the outside representation of the stubs
     * @memberOf module:models/stubRepository#
     * @returns {Object} - The stubs
     */
    function getStubs (): IStubConfig[] {
        const helpers = require('../util/helpers'),
            result = helpers.clone(stubs);

        for (let i = 0; i < stubs.length; i += 1) {
            delete result[i].statefulResponses;
            const stub = stubs[i];
            result[i].addResponse = (response: IResponse) => { stub.responses && stub.responses.push(response); };
        }
        return result;
    }

    /**
     * Finds the next response configuration for the given request
     * @memberOf module:models/stubRepository#
     * @param {Object} request - The protocol request
     * @param {Object} logger - The logger
     * @param {Object} imposterState - The current state for the imposter
     * @returns {Object} - Promise resolving to the response
     */
    function getResponseFor (request: IRequest, logger: ILogger, imposterState: unknown): IStubConfig {
        const helpers = require('../util/helpers');
        const stub: IStubConfig = findFirstMatch(request, logger, imposterState) || { statefulResponses: [{ is: {} }] },
            responseConfig:IResponse = stub.statefulResponses.shift() as IResponse,
            cloned = helpers.clone(responseConfig);

        logger.debug(`generating response from ${JSON.stringify(responseConfig)}`);

        stub.statefulResponses.push(responseConfig as IResponse);

        cloned.recordMatch = (response?: IResponse) => {
            const clonedResponse = helpers.clone(response),
                match = {
                    timestamp: new Date().toJSON(),
                    request,
                    response: clonedResponse
                };
            if (helpers.defined(clonedResponse._proxyResponseTime)) { // eslint-disable-line no-underscore-dangle
                delete clonedResponse._proxyResponseTime; // eslint-disable-line no-underscore-dangle
            }
            stub.matches = stub.matches || [];
            stub.matches.push(match);
            cloned.recordMatch = () => {}; // Only record once
        };

        cloned.setMetadata = (responseType: any, metadata: any) => {
            Object.keys(metadata).forEach(key => {
                ((responseConfig[responseType] as any)[key] as any) = metadata[key];
                cloned[responseType][key] = metadata[key];
            });
        };
        return cloned;
    }

    /**
    * Removes the saved proxy responses
    */
    function resetProxies (): void {
        for (let i = stubs.length - 1; i >= 0; i -= 1) {
            let current_stub = stubs[i];
            current_stub.responses = current_stub.responses && current_stub.responses.filter(response => {
                if (!response.is) {
                    return true;
                }
                return typeof response.is._proxyResponseTime === 'undefined'; // eslint-disable-line no-underscore-dangle
            });
            if (current_stub.responses && current_stub.responses.length === 0) {
                stubs.splice(i, 1);
            }
        }
    }

    return {
        stubs: getStubs,
        addStub,
        addStubAtIndex,
        overwriteStubs,
        overwriteStubAtIndex,
        deleteStubAtIndex,
        getResponseFor,
        resetProxies
    };
}
