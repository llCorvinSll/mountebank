'use strict';

export interface IRequest {
    protocol: string;
    method: string;
    data: never;
    stubs:IStub[];
    [key: string]: IStub[] | string;
}

export interface IStub {
    responses:IResponse[];
}

export interface IResponse {
    proxy:IProxy;
    _behaviors: {
        shellTransform:never[];
    }
}

export interface IProxy {
    to: toDeclaration;
}

export type toDeclaration = {
    host:string;
    port:string;
} & string;
