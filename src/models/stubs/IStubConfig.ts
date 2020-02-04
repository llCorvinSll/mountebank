import { IPredicate } from '../predicates/IPredicate';
import { IPredicateGenerator, IResponse } from '../IRequest';


export interface IProxyConfig {
    mode: string;
    to: string;
    predicateGenerators?: IPredicateGenerator[];
    [key: string]: string | object | unknown[] | undefined;
}

export interface IStubConfig {
    responses?: IResponse[];
    predicates?: IPredicate[];
}
