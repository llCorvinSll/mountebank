'use strict';

import {IStub} from "./IRequest";
import * as Q from 'q';
import {IStubConfig} from "./IStubConfig";
import {ILogger} from "../util/scopedLogger";
import {IMountebankResponse, IServerRequestData} from "./IProtocol";

export interface IImposter {
    port: number;
    url: string;

    stubs():IStubConfig[];
    addStub(stub: IStubConfig):void;
    toJSON(options?:any):string;
    resetProxies():void;
    stop():Q.Promise<unknown>;
    deleteStubAtIndex(index:string):void;
    addStubAtIndex(index:string, newStub:IStubConfig):void;
    overwriteStubAtIndex(index:string, newStub: IStubConfig):void;
    overwriteStubs(stubs:IStubConfig[]):void;

    getResponseFor(request: IServerRequestData, requestDetails: unknown): Q.Promise<IMountebankResponse>;
    getProxyResponseFor(proxyResponse: any, proxyResolutionKey: any):Q.Promise<any>;
}

export type IpValidator = (ip: string | undefined, logger: ILogger) => boolean;


export interface IImposterConfig {
    port: number;
    protocol: string;
    mode: string;
    stubs: IStub[];
    endOfRequestResolver: {
        inject: boolean
    }

}
