'use strict';

import {IStub} from "./IRequest";
import * as Q from 'q';

export interface IImposter {
    port: string;
    url: string;

    stubs():IStub[];
    addStub(stub: IStub):void;
    toJSON(options?:any):string;
    resetProxies():void;
    stop():Q.Promise<unknown>;
    deleteStubAtIndex(index:string):void;
    addStubAtIndex(index:string, newStub:IStub):void;
    overwriteStubAtIndex(index:string, newStub: IStub):void;
    overwriteStubs(stubs:IStub[]):void;

    getResponseFor(request: any, details: any):Q.Promise<any>;
    getProxyResponseFor(proxyResponse: any, proxyResolutionKey: any):Q.Promise<any>;
}


export interface IImposterConfig {
    port: number;
    protocol: string;
    mode: string;
    stubs: IStub[];
    endOfRequestResolver: {
        inject: boolean
    }

}
