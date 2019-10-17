'use strict';

import {IStub} from "./IRequest";

export interface IImposter {
    port: string;
    url: string;

    stop():void;
    toJSON(options?:any):string;
}


export interface IImposterConfig {
    port: number;
    protocol: string;
    mode: string;
    stubs: IStub[];
    endOfRequestResolver: {
        inject: boolean
    }

}
