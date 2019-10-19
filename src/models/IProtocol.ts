'use strict';

import {IImposter, IImposterConfig} from "./IImposter";
import {IMontebankError} from "../util/errors";
import * as Q from "q";
import {ILogger} from "../util/scopedLogger";
import {IProxyConfig, IStubConfig} from "./IStubConfig";
import {IRequest, IResponse} from "./IRequest";
import {IStubRepository} from "./stubRepository";
import {IResponseResolver} from "./responseResolver";


export interface IRequestData {
    requestFrom: string,
    method: string,
    path: string,
    query: any,
    headers: any,
    form: any,
    body: string
}

export interface IResponceData {
    statusCode: number,
    headers: any,
    body: string;
}

export interface IProtocol {
    port:number;
    metadata: any;
    close: () => void;
    proxy: IProxyImplementation;
    encoding: string;
    validate?:(imposter_config:IImposterConfig) => Q.Promise<IValidation>;
    createImposterFrom?:(imposter_config:IImposterConfig) => Q.Promise<IImposter>;
    createServer?:(params:unknown, logger:ILogger, req_creator:(request: any, details: any) => Q.Promise<any>) => Q.Promise<IServer>;
}


export interface IServerCreationOptions {
    port: number;
    defaultResponse?: any;

    [key: string]: any;
}

export type ServerImplCreatorFunction = (options: IServerCreationOptions, logger: ILogger, responseFn: RequestCallback) => Q.Promise<IServerImplementation>;
export type ServerCreatorFunction = (options: IServerCreationOptions, logger: ILogger, responseFn: RequestCallback) => Q.Promise<IServer>;

export type RequestCallback = (arg1: IServerRequestData, arg2: any) => any;

export interface IProtocolFactory {
    validate?:(imposter_config:IImposterConfig) => Q.Promise<IValidation>;
    testRequest:IRequestData;
    testProxyResponse: IResponceData;
    create:ServerImplCreatorFunction;

    createServer?: ServerCreatorFunction;
    createImposterFrom?: (creationRequest: any) => Q.Promise<IImposter>;
}


export interface IServerImplementation {
    encoding?:string;
    port: number;
    metadata: any;
    close(cb:(err?: Error) => void): void;
    proxy: IProxyImplementation;
}


export interface IServer {
    port: number;
    metadata: any;
    stubs: IStubRepository;
    resolver: IResponseResolver;
    encoding?:string;
    proxy?:IProxyImplementation;
    close(cb:(err?: Error) => void): void;
}

export interface IServerRequestData {
    requestFrom: string;
    method: string;
    path: string;
    query: any;
    headers: any;
    body: string;
    ip: string;
    form?: any | undefined;
}


export interface IServerResponseData {
    blocked?: boolean;
    statusCode: number;
    headers: any;
    body: string;
    _mode: string;

}

export interface IResolver {
    resolve(responseConfig: IStubConfig, request: IRequest, logger: ILogger, imposterState: unknown, options: unknown): Q.Promise<unknown>;
    resolveProxy(proxyResponse, proxyResolutionKey, logger: ILogger): Q.Promise<IResponse>;
}


export interface IProxyImplementation {
    to(to: string, request: unknown, cfg: IProxyConfig, requestDetails?: unknown): Q.Promise<IResponse>
}

export interface IValidation {
    isValid: boolean;
    errors: IMontebankError[];
}
