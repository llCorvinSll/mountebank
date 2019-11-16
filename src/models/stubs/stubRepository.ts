'use strict';

import {ILogger} from "../../util/scopedLogger";
import {IResponse} from "../IRequest";
import {IPredicate} from "../IPredicate";
import {IStubConfig} from "./IStubConfig";
import {IMountebankResponse, IServerRequestData} from "../IProtocol";
import * as helpers from "../../util/helpers";
import * as predicates from '../predicates';

/**
 * Maintains all stubs for an imposter
 * @module
 */

export interface IStubRepository {
    stubs: () => IStubConfig[];
    addStub(stub: IStubConfig, beforeResponse?: IMountebankResponse):void;
    addStubAtIndex(index: string, newStub: IStubConfig): void;
    overwriteStubs(newStubs: IStubConfig[]): void;
    overwriteStubAtIndex(index: string, newStub: IStubConfig):void;
    deleteStubAtIndex(index: string):void;
    getResponseFor(request: IServerRequestData, logger: ILogger, imposterState: unknown):IMountebankResponse;
    resetProxies():void;
}

/**
 * Creates the repository
 * @param {string} encoding - utf8 or base64
 * @returns {Object}
 */
export class StubRepository implements IStubRepository {
    public constructor(private encoding:string) {

    }

    protected _stubs:IStubConfig[] = [];

    /**
     * Returns the outside representation of the stubs
     * @memberOf module:models/stubRepository#
     * @returns {Object} - The stubs
     */
    public stubs() {
        const result = helpers.clone(this._stubs);

        for (let i = 0; i < this._stubs.length; i += 1) {
            delete result[i].statefulResponses;
            const stub = this._stubs[i];
            result[i].addResponse = (response: IResponse) => { stub.responses && stub.responses.push(response); };
        }
        return result;
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

    private stubIndexFor (responseToMatch: object) {
        let i = 0;
        for (i; i < this._stubs.length; i += 1) {
            let current_stub = this._stubs[i];
            if (current_stub.responses && current_stub.responses.some(response => JSON.stringify(response) === JSON.stringify(responseToMatch))) {
                break;
            }
        }
        return i;
    }

    private decorate (stub: IStubConfig) {
        stub.statefulResponses = this.repeatTransform(stub.responses as IMountebankResponse[]);
        stub.addResponse = response => { stub.responses && stub.responses.push(response); };
        return stub;
    }

    private repeatTransform (responses: IMountebankResponse[]): IMountebankResponse[] {
        const result = [];
        let response, repeats;

        for (let i = 0; i < responses.length; i += 1) {
            response = responses[i];
            repeats = this.repeatsFor(response);
            for (let j = 0; j < repeats; j += 1) {
                // @ts-ignore
                result.push(response);
            }
        }
        return result;
    }

    private repeatsFor (response: IMountebankResponse) {
        if (response._behaviors && response._behaviors.repeat) {
            return response._behaviors.repeat;
        }
        else {
            return 1;
        }
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
        const stub: IStubConfig = this.findFirstMatch(request, logger, imposterState) || { statefulResponses: [{ is: {} }] },
            responseConfig:IMountebankResponse = (stub.statefulResponses as IMountebankResponse[]).shift() as IMountebankResponse,
            cloned = helpers.clone(responseConfig);

        logger.debug(`generating response from ${JSON.stringify(responseConfig)}`);

        (stub.statefulResponses as IMountebankResponse[]).push(responseConfig);

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

    private findFirstMatch (request: IServerRequestData, logger: ILogger, imposterState: unknown): IStubConfig | undefined {
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
}
