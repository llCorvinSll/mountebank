import { ILogger } from '../../util/scopedLogger';
import { IPredicate } from '../predicates/IPredicate';
import { IProxyConfig, IStubConfig } from './IStubConfig';
import { IMountebankResponse, IServerRequestData } from '../IProtocol';
import * as helpers from '../../util/helpers';
import * as predicates from '../predicates/predicates';
import { IStub } from './IStub';
import { IStubRepository } from './IStubRepository';
import { Stub } from './Stub';
import * as _ from 'lodash';
import { StubWrapper } from './StubWrapper';
import * as stringify from 'json-stable-stringify';
import { predicatesFor, newIsResponse } from '../predicatesFor';
import { IResponse } from '../IRequest';
import { IHashMap } from '../../util/types';
import { RedisStorage } from '../storage/RedisStorage';
import * as uuidv4 from 'uuid/v4';
import { InMemoryStorage } from '../storage/InMemoryStorage';
import { IImposterPrintOptions } from '../imposters/IImposter';
import * as Q from 'q';

/**
 * Maintains all stubs for an imposter
 * @module
 */

function deepEqual (obj1: unknown, obj2: unknown) {
    return stringify(obj1) === stringify(obj2);
}

/**
 * Creates the repository
 * @param {string} encoding - utf8 or base64
 * @returns {Object}
 */
export class StubRepository implements IStubRepository {
    public constructor (private encoding: string, private staticUuids: boolean = false) {

    }

    protected _stubs: Stub[] = [];
    private stubsMap: IHashMap<IStub> = {};

    /**
     * Returns the outside representation of the stubs
     * @memberOf module:models/stubRepository#
     * @returns {Object} - The stubs
     */
    public stubs () {
        return this._stubs.map(stub => new StubWrapper(stub));
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
            this._stubs.splice(this.stubIndexFor(beforeResponse), 0, this.createStub(stub));
        }
        else {
            this._stubs.push(this.createStub(stub));
        }
    }

    /**
     * Adds a stub at stubIndex without changing the state of any other stubs
     * @memberOf module:models/stubRepository#
     * @param {Number} index - the index of the stub to change
     * @param {Object} newStub - the new stub
     */
    public addStubAtIndex (index: string, newStub: IStubConfig): void {
        this._stubs.splice(parseInt(index), 0, this.createStub(newStub));
    }

    /**
     * Deletes the stub at stubIndex without changing the state of any other stubs
     * @memberOf module:models/stubRepository#
     * @param {Number} index - the index of the stub to remove
     */
    public deleteStubAtIndex (index: string): void {
        this._stubs.splice(parseInt(index), 1);
    }

    public deleteStubByUuid (uuid: string): void {
        const stubToDelete = this.stubsMap[uuid];

        if (stubToDelete) {
            delete this.stubsMap[uuid];

            const start = this._stubs.map(e => e.uuid).indexOf(uuid);
            this._stubs.splice(start, 1);
        }
    }

    public hasUuid (uuid: string): boolean {
        return typeof this.stubsMap[uuid] !== 'undefined';
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


    private createStub (stub: IStubConfig): Stub {
        let uuid = _.uniqueId('stub_');

        if (this.staticUuids) {
            uuid = 'stub';
        }
        else {
            uuid = `${uuid}_${uuidv4()}`;
        }

        const storage = new RedisStorage<unknown>(uuid, true);

        const finalStub = new Stub(stub, uuid, storage);

        this.stubsMap[uuid] = finalStub;

        return finalStub;
    }

    //#endregion

    /**
     * Overwrites the stub at stubIndex without changing the state of any other stubs
     * @memberOf module:models/stubRepository#
     * @param {Number} index - the index of the stub to change
     * @param {Object} newStub - the new stub
     */
    public overwriteStubAtIndex (index: string, newStub: IStubConfig): void {
        this._stubs[parseInt(index)] = this.createStub(newStub);
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
        let stub = this.findFirstMatch(request, logger, imposterState);

        if (!stub) {
            const tempUuid = uuidv4();
            stub = new Stub({}, tempUuid, new InMemoryStorage<unknown>(false));
            stub.statefulResponses = [{ is: {} }];
        }

        const responseConfig: IMountebankResponse = stub.statefulResponses.shift() as IMountebankResponse;
        const cloned = helpers.clone(responseConfig);

        logger.debug(`generating response from ${JSON.stringify(responseConfig)}`);

        stub.statefulResponses.push(responseConfig);

        cloned.recordMatch = (response?: any) => {
            const clonedResponse = helpers.clone(response);
            const match = {
                timestamp: new Date().toJSON(),
                request,
                response: clonedResponse
            };
            if (helpers.defined(clonedResponse._proxyResponseTime)) {
                delete clonedResponse._proxyResponseTime;
            }

            stub?.matchesStorage?.saveRequest(match);
            cloned.recordMatch = () => {}; //Only record once
        };

        cloned.setMetadata = (responseType: string, metadata: any) => {
            Object.keys(metadata).forEach(key => {
                (((responseConfig as any)[responseType] as any)[key] as any) = metadata[key];
                (cloned as any)[responseType][key] = metadata[key];
            });
        };
        return cloned;
    }

    //We call map before calling every so we make sure to call every
    //predicate during dry run validation rather than short-circuiting
    private trueForAll (list: IPredicate[], predicate: (p: IPredicate) => boolean) {
        return list.map(predicate).every(result => result);
    }

    private findFirstMatch (request: IServerRequestData, logger: ILogger, imposterState: unknown): IStub | undefined {
        if (this._stubs.length === 0) {
            return undefined;
        }

        const readOnlyState = helpers.clone(imposterState);
        const matches = this._stubs.filter(stub => {
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
            const currentStub = this._stubs[i];
            currentStub.responses = currentStub.responses && currentStub.responses.filter(response => {
                if (!response.is) {
                    return true;
                }
                return typeof response.is._proxyResponseTime === 'undefined';
            });
            if (currentStub.responses && currentStub.responses.length === 0) {
                this._stubs.splice(i, 1);
            }
        }
    }

    //#region METHODS FOR ResponseResolver

    public stubIndexFor (responseConfig: IMountebankResponse) {
        const stubList = this._stubs;
        let i = 0;
        for (i = 0; i < stubList.length; i += 1) {
            const currentStub = stubList[i];
            if (currentStub.responses && currentStub.responses.some(response => deepEqual(response, responseConfig))) {
                break;
            }
        }
        return i;
    }

    public indexOfStubToAddResponseTo (responseConfig: IMountebankResponse, request: IServerRequestData, pathes: string[], logger: ILogger) {
        const currentPredicates = predicatesFor(request, responseConfig.proxy && responseConfig.proxy.predicateGenerators || [], pathes, logger);

        for (let index = this.stubIndexFor(responseConfig) + 1; index < this._stubs.length; index += 1) {
            if (deepEqual(currentPredicates, this._stubs[index].predicates)) {
                return index;
            }
        }
        return -1;
    }

    public addNewResponse (responseConfig: IMountebankResponse, request: IServerRequestData, response: IMountebankResponse, pathes: string[], logger: ILogger): void {
        const stubResponse: IResponse = newIsResponse(response, responseConfig.proxy as IProxyConfig);

        const responseIndex = this.indexOfStubToAddResponseTo(responseConfig, request, pathes, logger);

        const iStub = this._stubs[responseIndex];
        iStub.addResponse!(stubResponse);
    }

    //#endregion METHODS FOR ResponseResolver

    public getJSON (options?: IImposterPrintOptions): Q.Promise<IStub[]> {
        return Q.all(this._stubs.map(s => s.getJSON(options)));
    }
}
