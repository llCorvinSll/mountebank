'use strict';

import * as Q from 'q';
import {IStubConfig} from "../stubs/IStubConfig";
import {ILogger} from "../../util/scopedLogger";
import {IMountebankResponse, IServerRequestData} from "../IProtocol";
import {IStubRepository} from "../stubs/IStubRepository";

export interface IImposter {
    port: number;
    url: string;
    protocol: string;

    stubRepository:IStubRepository;
    toJSON(options?:ImposterPrintOptions):string;
    stop():Q.Promise<unknown>;

    getResponseFor(request: IServerRequestData, requestDetails?: unknown): Q.Promise<IMountebankResponse>;
    getProxyResponseFor(proxyResponse: any, proxyResolutionKey: any):Q.Promise<any>;
}

export interface ImposterPrintOptions {
    list?:boolean;
    replayable?:boolean;
    removeProxies?:boolean;
}

export type IpValidator = (ip: string | undefined, logger: ILogger) => boolean;


export interface IImposterConfig {
    port?: number;
    protocol?: string;
    host?: string;
    name?: string;
    mode?: string;
    recordRequests?: boolean;
    stubs?: IStubConfig[];
    endOfRequestResolver?: {
        inject: boolean
    }
}
