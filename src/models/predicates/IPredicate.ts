'use strict';

export interface IPredicate {
    caseSensitive?: boolean
    except?: string;
    xpath?: IXPathConfig;
    jsonpath?:IJsonPathConfig;
    keyCaseSensitive?: boolean;

    equals?: IPredicateConfig;
    deepEquals?: IPredicateConfig;
    contains?: IPredicateConfig;
    startsWith?: IPredicateConfig;

    endsWith?: IPredicateConfig;
    matches?: IPredicateConfig;
    exists?: IPredicateConfig;

    not?: IPredicate;
    or?: IPredicate[];
    and?: IPredicate[];
    inject?: IPredicateConfig;

    [key: string]: IPredicateConfig| boolean | undefined;
}

export interface IPredicateConfig {

}


export interface IXPathConfig {
    selector: string;
    ns?: {};
}

export interface IJsonPathConfig {
    selector: string;
}
