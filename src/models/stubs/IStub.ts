import { IPredicate } from '../predicates/IPredicate';
import { IResponse } from '../IRequest';
import { IMountebankResponse } from '../IProtocol';
import {IStorage} from "../storage/IStorage";

export interface IStub {
    responses?: IResponse[];
    predicates?: IPredicate[];
    statefulResponses: IMountebankResponse[];
    addResponse?: (resp: IResponse) => void;
    recordMatch?: (responce?: any) => void;

    matchesStorage?: IStorage<unknown>;
    // matches?: unknown[];

    uuid?: string;
    _links?: string;
}
