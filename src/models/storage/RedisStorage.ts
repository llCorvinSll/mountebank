import { IStorage } from './IStorage';
import * as Q from 'q';
import * as helpers from '../../util/helpers';
import { RedisClient, createClient } from 'redis';
import { IHashMap } from '../../util/types';

const client: RedisClient = createClient();

export class RedisStorage<T> implements IStorage<T> {
    constructor (private uuid: string, private recordRequests: boolean) {
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
            client.hset(this.uuid, `${currentIndex}`, JSON.stringify(requestToRecord), () => {
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

            client.hgetall(this.uuid, (err, replies) => {
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
        client.del(this.uuid);
    }
}
