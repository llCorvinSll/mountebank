import { IStub } from './IStub';
import { IResponse } from '../IRequest';
import { IPredicate } from '../predicates/IPredicate';
import { IMountebankResponse } from '../IProtocol';
import * as helpers from '../../util/helpers';


export class StubWrapper implements IStub {
    constructor (stub: IStub) {
        this.responses = helpers.clone(stub.responses);
        this.predicates = helpers.clone(stub.predicates);
        this._uuid = stub.uuid;
        this.addResponse = (resp: IResponse) => {
            stub.addResponse!(resp);
        };

        this.getMatches = () => stub.getMatches!();
    }

    getMatches?: () => Q.Promise<unknown[]>;

    _links: string;
    recordMatch: (responce?: any) => void;
    addResponse?: (resp: IResponse) => void;
    predicates?: IPredicate[];
    responses?: IResponse[];
    statefulResponses: IMountebankResponse[];
    _uuid?: string;
}
