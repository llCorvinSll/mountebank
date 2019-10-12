'use strict';

export interface IRequest {
    protocol: string;
    method: string;
    data: never;
    stubs:IStub[];
    isDryRun?:boolean;
    [key: string]: IStub[] | string | boolean | undefined;
}

export interface IStub {
    responses:IResponse[];
}

export interface ICopyDescriptor {
    from:string;
    using: {};
    into: {};
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
    decorate:never;
}

export interface IResponse {
    proxy:IProxy;
    _behaviors: IBehaviors
    [key: string]:IProxy | IBehaviors;
}

export interface IProxy {
    to: toDeclaration;
}

export type toDeclaration = {
    host:string;
    port:string;
} & string;
