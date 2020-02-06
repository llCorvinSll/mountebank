

import { IImposter } from './imposters/IImposter';

export interface IMountebankOptions {
    heroku: unknown;
    version: string;
    port: string;
    host: string;
    allowInjection: boolean;
    logfile: string;
    nologfile: boolean;
    loglevel: string;
    imposters: {[key: string]: IImposter };
    localOnly: boolean;
    ipWhitelist: string[];
    protofile: string;
    mock: boolean;
    debug: boolean;
}

export interface IRelease {
    version: string;
    date: string;
}
