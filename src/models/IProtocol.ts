'use strict';

import {IImposter, IImposterConfig} from "./IImposter";
import {IMontebankError} from "../util/errors";
import * as Q from "q";
import {ILogger} from "../util/scopedLogger";
import {IStubRepository} from "./stubRepository";

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
}

export interface IResolver {
    resolve():void;
}

export interface IValidation {
    isValid: boolean;
    errors: IMontebankError[];
}
