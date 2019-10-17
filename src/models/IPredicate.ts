'use strict';

export interface IPredicate {
    not: any;
    inject: unknown;
    caseSensitive?: boolean
    matches: unknown[]
    or: unknown[]
    and: unknown[]

}
