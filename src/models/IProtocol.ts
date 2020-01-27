'use strict';

import {IImposter, IImposterConfig} from "./imposters/IImposter";
import {IMontebankError} from "../util/errors";
import * as Q from "q";
import {ILogger} from "../util/scopedLogger";
import {IProxyConfig} from "./stubs/IStubConfig";
import {IStubRepository} from "./stubs/IStubRepository";
import {IBehaviorsConfig} from "./behaviors/IBehaviorsConfig";


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
    testRequest:IServerRequestData;
    testProxyResponse: IServerResponseData;
    create:ServerImplCreatorFunction;

    createServer?: ServerCreatorFunction;
    createImposterFrom?: (creationRequest: IImposterConfig) => Q.Promise<IImposter>;
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
    resolver: IResolver;
    encoding?:string;
    proxy?:IProxyImplementation;
    close(cb:(err?: Error) => void): void;
}

export interface IServerRequestData {
    requestFrom?: string;
    method?: string;
    path?: string;
    query?: any;
    headers?: any;
    body?: string;
    form?: any | undefined;
    data?:unknown;

    ip?: string;
    timestamp?:string;
    isDryRun?:boolean;

    [key:string]:string|undefined|unknown;
}


export interface IServerResponseData {
    blocked?: boolean;
    statusCode: number;
    headers: any;
    body: string;
    _mode?: string;

}

export interface IMountebankResponse {
    response?: IMountebankResponse;

    proxy?: IProxyConfig;
    blocked?: boolean;
    code?: string;


    _behaviors?: IBehaviorsConfig;
    _proxyResponseTime?:number;

    is?: any;

    inject?:string;

    recordMatch?: (match?: any) => void;
    setMetadata?: (responseType: string, metadata: any) => void;
}


export interface IProxyResponse {
    _proxyResponseTime?:number;
}

export interface IResolver {
    resolve(responseConfig: IMountebankResponse, request: IServerRequestData, logger: ILogger, imposterState: unknown, options: unknown): Q.Promise<IMountebankResponse>;
    resolveProxy(proxyResponse: IProxyResponse, proxyResolutionKey: number, logger: ILogger): Q.Promise<IMountebankResponse>;
}


export interface IProxyImplementation {
    to(to: string, request: unknown, cfg: IProxyConfig, requestDetails?: unknown): Q.Promise<IMountebankResponse>
}

export interface IValidation {
    isValid: boolean;
    errors: IMontebankError[];
}
