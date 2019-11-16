import {IPredicate} from "../IPredicate";
import {IResponse} from "../IRequest";


export interface IProxyConfig {
    mode: string;
    to: string;
    predicateGenerators?: unknown[];
    [key: string]: string | object | unknown[] | undefined;
}

export interface IStubConfig {
    responses?:IResponse[];
    predicates?: IPredicate[];
    // proxy?: IProxyConfig;
    // _behaviors?: IBehaviors;

    // is?:any;
    // inject?:unknown;
}
