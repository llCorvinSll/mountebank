import { IStub } from './IStub';
import { IResponse } from '../IRequest';
import { IPredicate } from '../predicates/IPredicate';
import { IMountebankResponse } from '../IProtocol';
import { IStubConfig } from './IStubConfig';
import { IStorage } from '../storage/IStorage';
import { IImposterPrintOptions } from '../imposters/IImposter';
import * as Q from 'q';
import { StubWrapper } from './StubWrapper';
import * as helpers from '../../util/helpers';


export class Stub implements IStub {
    constructor (config: IStubConfig, private _uuid: string, public matchesStorage: IStorage<unknown>) {
        this.responses = config.responses || [];
        this.statefulResponses = this.repeatTransform(config.responses as IMountebankResponse[]);

        if (config.predicates) {
            this.predicates = config.predicates;
        }
    }

    public get uuid () {
        return this._uuid;
    }

    _links: string;
    predicates: IPredicate[];
    responses: IResponse[];
    statefulResponses: IMountebankResponse[];

    public addResponse (response: IResponse): void {
        this.responses.push(response);
    }

    public recordMatch (response?: any) {
        this.matchesStorage.saveRequest(response);
    }

    private repeatTransform (responses: IMountebankResponse[]): IMountebankResponse[] {
        if (!responses) {
            return [];
        }

        const result = [];
        let response;
        let repeats;

        for (let i = 0; i < responses.length; i += 1) {
            response = responses[i];
            repeats = this.repeatsFor(response);
            for (let j = 0; j < repeats; j += 1) {
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

    public getJSON (options?: IImposterPrintOptions): Q.Promise<IStub> {
        let asyncDataPromise = Q.resolve<unknown[]>();

        if (!options?.replayable) {
            asyncDataPromise = this.matchesStorage.getRequests();
        }

        return asyncDataPromise.then(matches => {
            const stub = new StubWrapper(this);
            const stubJson: IStub = helpers.clone(stub);

            if (!options?.replayable) {
                if (matches && matches.length) {
                    (stubJson as any).matches = matches;
                }
            }

            return stubJson;
        });
    }
}
