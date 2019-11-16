import {IPredicate} from "../IPredicate";
import {IBehaviors, IResponse} from "../IRequest";

export interface IStub {
    responses?:IResponse[];
    predicates?: {[key: string]:IPredicate};
    statefulResponses: IResponse[];
    addResponse?: (resp: IResponse) => void;
    recordMatch?: (responce?: any) => void;


    _behaviors?: IBehaviors;
    proxy?: {
        mode: string;
    },
    is?: any;
    inject?: string;
}
