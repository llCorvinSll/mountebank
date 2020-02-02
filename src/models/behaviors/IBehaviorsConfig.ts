'use strict';

export interface IBehaviorsConfig {
    shellTransform?:string[];
    wait?:IWaitDescriptor;
    copy?: ICopyDescriptor[];
    lookup?:ILookupDescriptor[];
    repeat?: boolean;
    decorate?:string;
    [key: string]: string[] | IWaitDescriptor | ICopyDescriptor[] | ILookupDescriptor[] | boolean | string | undefined;
}

export type IWaitDescriptor = (() => number) | string;

export interface ICopyDescriptor {
    from:string;
    using: IUsingConfig;
    into: {} | string;
}

export interface ICsvConfig {
    delimiter: string;
    path: string;
    keyColumn: string;
}

export interface ILookupInfokey {
    from: string;
    index: number;
    using: {
        method: string;
        selector: string;
        options: IUsingConfigOptions;
        ns: string;
    };
}

export interface ILookupDescriptor {
    into: string
    key: ILookupInfokey;
    fromDataSource: {
        csv: ICsvConfig
    };
}

export interface IUsingConfigOptions {
    ignoreCase: boolean;
    multiline: boolean;
}

export interface IUsingConfig {
    method: string;
    ns: string;
    selector: string;
    options: IUsingConfigOptions;
}
