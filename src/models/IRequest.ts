'use strict';

import {IPredicate} from "./IPredicate";

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

export interface IStub {
    responses?:IResponse[];
    predicates?: {[key: string]:IPredicate};
    statefulResponses: IResponse[];
    addResponse?: (resp: IResponse) => void;
    recordMatch?: (responce?: any) => void;


    _behaviors?: IBehaviors;
    proxy?: {
        mode: string;
    },
    is?: any;
    inject?: string;
}

export interface ICopyDescriptor {
    from:string;
    using: IUsingConfig;
    into: {};
}

export interface IUsingConfig {
    method: string;
    ns: string;
    selector: string;
    options: any;
}

export interface ILookupDescriptor {
    into: string
    key: {
        from: string;
        index:number;
        using: {
            method: string;
        }
    };
    fromDataSource: {
        csv:string;
    };
}


export interface IBehaviors {
    shellTransform:never[];
    wait:(() => number) | string;
    copy: ICopyDescriptor[];
    lookup:ILookupDescriptor[];
    repeat: boolean;
    decorate:never;
}

type SetMetadataFunction = (responseType: any, metadata: any) => void;

export interface IResponse {
    proxy?:IProxy;
    _behaviors?: IBehaviors;
    setMetadata?: SetMetadataFunction;
    is?: {
        _proxyResponseTime: string;
    };

    _proxyResponseTime?: number;
    [key: string]:IProxy | IBehaviors | undefined | SetMetadataFunction | unknown;
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
