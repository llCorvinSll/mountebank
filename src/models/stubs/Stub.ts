import { IStub } from "./IStub";
import { IResponse } from "../IRequest";
import { IPredicate } from "../predicates/IPredicate";
import { IMountebankResponse } from "../IProtocol";
import {IStubConfig} from "./IStubConfig";


export class Stub implements IStub {
    constructor(config:IStubConfig) {
        this.responses = config.responses || [];
        this.statefulResponses = this.repeatTransform(config.responses as IMountebankResponse[]);

        if (config.predicates) {
            this.predicates = config.predicates;
        }
    }

    _links:string;
    public addResponse:(resp:IResponse) => void = (response:IResponse) => {
        this.responses && this.responses.push(response);
    }

    matches:unknown[];
    predicates:IPredicate[];
    recordMatch:(responce?:any) => void;
    responses:IResponse[];
    statefulResponses:IMountebankResponse[];

    private repeatTransform (responses: IMountebankResponse[]): IMountebankResponse[] {
        const result = [];
        let response;
        let repeats;

        for (let i = 0; i < responses.length; i += 1) {
            response = responses[i];
            repeats = this.repeatsFor(response);
            for (let j = 0; j < repeats; j += 1) {
                // @ts-ignore
                result.push(response);
            }
        }
        return result;
    }

    private repeatsFor (response: IMountebankResponse) {
        if (response._behaviors && response._behaviors.repeat) {
            return response._behaviors.repeat;
        }
        else {
            return 1;
        }
    }
}
