import {IPredicate} from "../IPredicate";
import {IBehaviors, IResponse} from "../IRequest";
import {IMountebankResponse} from "../IProtocol";

export interface IStub {
    responses?:IResponse[];
    predicates?: IPredicate[];
    statefulResponses?: IMountebankResponse[];
    addResponse?: (resp: IResponse) => void;
    recordMatch?: (responce?: any) => void;

    matches?:unknown[];
    _behaviors?: IBehaviors;
    proxy?: {
        mode: string;
    },
    is?: any;
    inject?: string;
}
