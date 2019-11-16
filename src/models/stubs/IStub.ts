import {IPredicate} from "../predicates/IPredicate";
import {IResponse} from "../IRequest";
import {IMountebankResponse} from "../IProtocol";

export interface IStub {
    responses?:IResponse[];
    predicates?: IPredicate[];
    statefulResponses: IMountebankResponse[];
    addResponse?: (resp: IResponse) => void;
    recordMatch?: (responce?: any) => void;

    matches?:unknown[];
}
