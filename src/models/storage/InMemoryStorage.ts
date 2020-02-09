import * as Q from 'q';
import * as helpers from '../../util/helpers';
import { IStorage } from './IStorage';


export class InMemoryStorage<T> implements IStorage<T> {
    constructor (private recordRequests: boolean) {
    }

    private reqestsCount = 0;
    private requests: T[] = [];

    getCount (): number {
        return this.reqestsCount;
    }

    saveRequest (request: T): Q.Promise<void> {
        this.reqestsCount += 1;

        if (!this.recordRequests) {
            return Q.resolve();
        }

        return Q.Promise(done => {
            const recordedRequest = helpers.clone(request);
            (recordedRequest as any).timestamp = new Date().toJSON();
            this.requests.push(recordedRequest);
            done();
        });


    }

    getRequests (): Q.Promise<T[]> {
        return Q.resolve(this.requests);
    }

    clean (): void {
        this.requests = [];
    }
}
