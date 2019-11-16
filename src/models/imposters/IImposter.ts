'use strict';

import * as Q from 'q';
import {IStubConfig} from "../stubs/IStubConfig";
import {ILogger} from "../../util/scopedLogger";
import {IMountebankResponse, IServerRequestData} from "../IProtocol";
import {IStub} from "../stubs/IStub";

export interface IImposter {
    port: number;
    url: string;
    protocol: string;

    stubs():IStub[];
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
    host: string;
    name: string;
    mode: string;
    recordRequests: boolean;
    stubs: IStubConfig[];
    endOfRequestResolver: {
        inject: boolean
    }

}
