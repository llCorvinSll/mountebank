'use strict';


import {IStub} from "./stubs/IStub";
import {IBehaviorsConfig} from "./behaviors/IBehaviorsConfig";

export interface IRequest {
    protocol?: string;
    method: string;
    data: never;
    stubs:IStub[];
    isDryRun?:boolean;
    endOfRequestResolver?:any;
    [key: string]: IStub[] | string | boolean | undefined;
    body?: string;
    path?: string;
}

type SetMetadataFunction = (responseType: any, metadata: any) => void;

export interface IResponse {
    proxy?:IProxy;
    _behaviors?: IBehaviorsConfig;
    setMetadata?: SetMetadataFunction;
    is?: {
        _proxyResponseTime?: string;
    } & any;

    _proxyResponseTime?: number;
    [key: string]:IProxy | IBehaviorsConfig | undefined | SetMetadataFunction | unknown;
}

export interface IProxy {
    to: toDeclaration;
    addDecorateBehavior?: boolean;
    predicateGenerators?: IPredicateGenerator[];
    _proxyResponseTime?: string;
}

export interface IPredicateGenerator {
    inject?:boolean;
}

export type toDeclaration = {
    host:string;
    port:string;
} & string;
