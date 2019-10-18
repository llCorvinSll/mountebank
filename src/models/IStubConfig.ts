import {IPredicate} from "./IPredicate";
import {IBehaviors, IResponse} from "./IRequest";


export interface IProxyConfig {
    mode: string;
    to: string;
    [key: string]: string | object;
}

export interface IStubConfig {
    responses?:IResponse[];
    predicates?: IPredicate[];
    statefulResponses: IResponse[];
    addResponse?: (resp: IResponse) => void;
    recordMatch?: (responce?: any) => void;
    matches?:unknown[];
    proxy?: IProxyConfig;
    _behaviors?: IBehaviors;

    is?:any;
    inject?:unknown;


    //functions
    setMetadata(key: string, data: unknown): void;
}
