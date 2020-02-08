import { IServerRequestData } from '../IProtocol';
import * as Q from 'q';
import * as helpers from '../../util/helpers';
import { IRequestsStorage } from './IRequestsStorage';


export class RequestsStorage implements IRequestsStorage {
    constructor (private uuid: string, private recordRequests: boolean) {
    }

    private reqestsCount = 0;
    private requests: IServerRequestData[] = [];

    getCount (): number {
        return this.reqestsCount;
    }

    saveRequest (request: IServerRequestData): Q.Promise<void> {
        this.reqestsCount += 1;

        if (!this.recordRequests) {
            return Q.resolve();
        }

        return Q.Promise(done => {
            const recordedRequest = helpers.clone(request);
            recordedRequest.timestamp = new Date().toJSON();
            this.requests.push(recordedRequest);
            done();
        });


    }

    getRequests (): Q.Promise<IServerRequestData[]> {
        return Q.resolve(this.requests);
    }
}
