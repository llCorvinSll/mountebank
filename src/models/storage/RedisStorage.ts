import { IStorage } from './IStorage';
import * as Q from 'q';
import * as helpers from '../../util/helpers';
import { IHashMap } from '../../util/types';
import { RedisClient } from 'redis';


export class RedisStorage<T> implements IStorage<T> {
    constructor (private uuid: string, private recordRequests: boolean, private client: RedisClient) {
    }

    private reqestsCount = 0;
    private nonSaved: IHashMap<T> = {};

    getCount (): number {
        return this.reqestsCount;
    }

    saveRequest (request: T): Q.Promise<void> {
        this.reqestsCount += 1;

        if (!this.recordRequests) {
            return Q.resolve();
        }

        const currentIndex = this.reqestsCount - 1;
        const requestToRecord = helpers.clone(request);
        (requestToRecord as any).timestamp = new Date().toJSON();
        this.nonSaved[currentIndex] = requestToRecord;

        return Q.Promise(done => {
            this.client.hset(this.uuid, `${currentIndex}`, JSON.stringify(requestToRecord), () => {
                delete this.nonSaved[currentIndex];
                done();
            });
        });
    }

    getRequests (): Q.Promise<T[]> {
        return Q.Promise(done => {
            const result: T[] = [];

            if (!this.recordRequests) {
                done([]);
                return;
            }

            Object.keys(this.nonSaved).forEach(key => {
                if (this.nonSaved[key]) {
                    result[parseInt(key)] = this.nonSaved[key];
                }
            });

            this.client.hgetall(this.uuid, (err, replies) => {
                if (!replies) {
                    done([]);
                }
                else {
                    Object.keys(replies).forEach(key => {
                        const iServerRequestData = JSON.parse(replies[key]);
                        if (iServerRequestData) {
                            result[parseInt(key)] = iServerRequestData;
                        }
                    });

                    done(result);
                }
            });
        });
    }

    clean (): void {
        this.client.del(this.uuid);
    }
}
