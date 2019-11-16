'use strict';

export interface IBehaviorsConfig {
    shellTransform:string[];
    wait:IWaitDescriptor;
    copy: ICopyDescriptor[];
    lookup:ILookupDescriptor[];
    repeat: boolean;
    decorate:string;
}

export type IWaitDescriptor = (() => number) | string;

export interface ICopyDescriptor {
    from:string;
    using: IUsingConfig;
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

export interface IUsingConfig {
    method: string;
    ns: string;
    selector: string;
    options: any;
}
