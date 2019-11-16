import {IPredicate} from "../IPredicate";
import {IBehaviors, IResponse} from "../IRequest";
import {IMountebankResponse} from "../IProtocol";


export interface IProxyConfig {
    mode: string;
    to: string;
    predicateGenerators?: unknown[];
    [key: string]: string | object | unknown[] | undefined;
}

export interface IStubConfig {
    responses?:IResponse[];
    predicates?: IPredicate[];
    statefulResponses?: IMountebankResponse[];
    proxy?: IProxyConfig;
    _behaviors?: IBehaviors;

    is?:any;
    inject?:unknown;
}
