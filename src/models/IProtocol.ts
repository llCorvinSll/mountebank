'use strict';

import {IImposter, IImposterConfig} from "./IImposter";
import {IMontebankError} from "../util/errors";
import * as Q from "q";
import {ILogger} from "../util/scopedLogger";
import {IStubRepository} from "./stubRepository";
import {IProxyConfig, IStubConfig} from "./IStubConfig";
import {IRequest, IResponse} from "./IRequest";

export interface IProtocol {
    testRequest():void;
    testProxyResponse():void;
    validate(imposter_config:IImposterConfig):Q.Promise<IValidation>;
    createImposterFrom(imposter_config:IImposterConfig):Q.Promise<IImposter>;
    createServer(params:unknown, logger:ILogger, req_creator:(request: any, details: any) => Q.Promise<any>):Q.Promise<IServer>;
}


export interface IServer {
    port: string
    stubs: IStubRepository;
    resolver: IResolver;
    close(cb: () => void): void;
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
