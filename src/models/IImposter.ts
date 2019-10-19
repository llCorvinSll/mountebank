'use strict';

import {IStub} from "./IRequest";
import * as Q from 'q';
import {IStubConfig} from "./IStubConfig";
import {ILogger} from "../util/scopedLogger";

export interface IImposter {
    port: string;
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

    getResponseFor(request: any, details?: any):Q.Promise<any>;
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
