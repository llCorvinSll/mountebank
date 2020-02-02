'use strict';

import {ILogger} from "../../util/scopedLogger";
import {IPredicate} from "../predicates/IPredicate";
import {IProxyConfig, IStubConfig} from "./IStubConfig";
import {IMountebankResponse, IServerRequestData} from "../IProtocol";
import * as helpers from "../../util/helpers";
import * as predicates from '../predicates/predicates';
import {IStub} from "./IStub";
import {IStubRepository} from "./IStubRepository";
import { Stub } from "./Stub";
import {uniqueId} from "lodash";
import {StubWrapper} from "./StubWrapper";
import * as stringify from "json-stable-stringify";
import {predicatesFor, newIsResponse} from "../predicatesFor";
import {IResponse} from "../IRequest";

/**
 * Maintains all stubs for an imposter
 * @module
 */

/**
 * Creates the repository
 * @param {string} encoding - utf8 or base64
 * @returns {Object}
 */
export class StubRepository implements IStubRepository {
    public constructor(private encoding:string, private static_uuids: boolean = false) {

    }

    protected _stubs:IStub[] = [];

    /**
     * Returns the outside representation of the stubs
     * @memberOf module:models/stubRepository#
     * @returns {Object} - The stubs
     */
    public stubs() {
        return this._stubs.map((stub) => new StubWrapper(stub));
    }

    //#region addStub

    /**
     * Adds a stub to the repository
     * @memberOf module:models/stubRepository#
     * @param {Object} stub - The stub to add
     * @param {Object} beforeResponse - If provided, the new stub will be added before the stub containing the response (used for proxyOnce)
     */
    public addStub (stub: IStubConfig, beforeResponse?: IMountebankResponse): void {
        if (beforeResponse) {
            this._stubs.splice(this.stubIndexFor(beforeResponse), 0, this.decorate(stub));
        }
        else {
            this._stubs.push(this.decorate(stub));
        }
    }

    /**
     * Adds a stub at stubIndex without changing the state of any other stubs
     * @memberOf module:models/stubRepository#
     * @param {Number} index - the index of the stub to change
     * @param {Object} newStub - the new stub
     */
    public addStubAtIndex (index: string, newStub: IStubConfig): void {
        this._stubs.splice(parseInt(index), 0, this.decorate(newStub));
    }

    /**
     * Deletes the stub at stubIndex without changing the state of any other stubs
     * @memberOf module:models/stubRepository#
     * @param {Number} index - the index of the stub to remove
     */
    public deleteStubAtIndex (index: string): void {
        this._stubs.splice(parseInt(index), 1);
    }

    /**
     * Overwrites the entire list of stubs
     * @memberOf module:models/stubRepository#
     * @param {Object} newStubs - the new list of stubs
     */
    public overwriteStubs (newStubs: IStubConfig[]): void {
        while (this._stubs.length > 0) {
            this._stubs.pop();
        }
        newStubs.forEach(stub => this.addStub(stub));
    }


    private decorate (stub: IStubConfig):IStub {
        let uuid = uniqueId("stub");

        if (this.static_uuids) {
            uuid = "stub";
        }

        return new Stub(stub, uuid);
    }

    //#endregion

    /**
     * Overwrites the stub at stubIndex without changing the state of any other stubs
     * @memberOf module:models/stubRepository#
     * @param {Number} index - the index of the stub to change
     * @param {Object} newStub - the new stub
     */
    public overwriteStubAtIndex (index: string, newStub: IStubConfig): void {
        this._stubs[parseInt(index)] = this.decorate(newStub);
    }

    //#region getResponseFor

    /**
     * Finds the next response configuration for the given request
     * @memberOf module:models/stubRepository#
     * @param {Object} request - The protocol request
     * @param {Object} logger - The logger
     * @param {Object} imposterState - The current state for the imposter
     * @returns {Object} - Promise resolving to the response
     */
    public getResponseFor (request: IServerRequestData, logger: ILogger, imposterState: unknown): IMountebankResponse {
        const stub: IStub = this.findFirstMatch(request, logger, imposterState) || { statefulResponses: [{ is: {} }] };
        const responseConfig:IMountebankResponse = stub.statefulResponses.shift() as IMountebankResponse;
        const cloned = helpers.clone(responseConfig);

        logger.debug(`generating response from ${JSON.stringify(responseConfig)}`);

        stub.statefulResponses.push(responseConfig);

        cloned.recordMatch = (response?: any) => {
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

        cloned.setMetadata = (responseType: string, metadata: any) => {
            Object.keys(metadata).forEach(key => {
                // @ts-ignore
                ((responseConfig[responseType] as any)[key] as any) = metadata[key];
                // @ts-ignore
                cloned[responseType][key] = metadata[key];
            });
        };
        return cloned;
    }

    // We call map before calling every so we make sure to call every
    // predicate during dry run validation rather than short-circuiting
    private trueForAll(list: IPredicate[], predicate: (p: IPredicate) => boolean) {
        return list.map(predicate).every(result => result);
    }

    private findFirstMatch (request: IServerRequestData, logger: ILogger, imposterState: unknown): IStub | undefined {
        if (this._stubs.length === 0) {
            return undefined;
        }

        const readOnlyState = helpers.clone(imposterState),
            matches = this._stubs.filter(stub => {
                const stubPredicates: IPredicate[] = stub.predicates || [];

                return this.trueForAll(stubPredicates,
                    (predicate: IPredicate) => predicates.evaluate(predicate, request, this.encoding, logger, readOnlyState));
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

    //#endregion

    /**
     * Removes the saved proxy responses
     */
    public resetProxies (): void {
        for (let i = this._stubs.length - 1; i >= 0; i -= 1) {
            let current_stub = this._stubs[i];
            current_stub.responses = current_stub.responses && current_stub.responses.filter(response => {
                if (!response.is) {
                    return true;
                }
                return typeof response.is._proxyResponseTime === 'undefined'; // eslint-disable-line no-underscore-dangle
            });
            if (current_stub.responses && current_stub.responses.length === 0) {
                this._stubs.splice(i, 1);
            }
        }
    }

    //#region METHODS FOR ResponseResolver

    public stubIndexFor (responseConfig: IMountebankResponse) {
        const stubList = this._stubs;
        for (var i = 0; i < stubList.length; i += 1) {
            let current_stub = stubList[i];
            if (current_stub.responses && current_stub.responses.some(response => deepEqual(response, responseConfig))) {
                break;
            }
        }
        return i;
    }

    public indexOfStubToAddResponseTo (responseConfig: IMountebankResponse, request: IServerRequestData, pathes: string[], logger: ILogger) {
        const predicates = predicatesFor(request, responseConfig.proxy && responseConfig.proxy.predicateGenerators || [], pathes, logger);

        for (let index = this.stubIndexFor(responseConfig) + 1; index < this._stubs.length; index += 1) {
            if (deepEqual(predicates, this._stubs[index].predicates)) {
                return index;
            }
        }
        return -1;
    }

    public addNewResponse (responseConfig: IMountebankResponse, request: IServerRequestData, response: IMountebankResponse, pathes: string[], logger: ILogger):void {
        const stubResponse:IResponse = newIsResponse(response, responseConfig.proxy as IProxyConfig);

        const responseIndex = this.indexOfStubToAddResponseTo(responseConfig, request, pathes, logger);

        let i_stub = this._stubs[responseIndex];
        i_stub.addResponse && i_stub.addResponse(stubResponse);
    }

    //#endregion METHODS FOR ResponseResolver

}

function deepEqual (obj1: unknown, obj2: unknown) {
    return stringify(obj1) === stringify(obj2);
}
