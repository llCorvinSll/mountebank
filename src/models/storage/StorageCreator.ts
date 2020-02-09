import { IStorage } from './IStorage';
import { RedisStorage } from './RedisStorage';
import { InMemoryStorage } from './InMemoryStorage';
import { RedisClient, createClient } from 'redis';


export class StorageCreator {
    constructor (private useRedis: boolean) {
        if (useRedis) {
            this.redisClient = createClient();
        }
    }

    private redisClient: RedisClient;

    createStorage<T> (uuid: string, recordRequests: boolean): IStorage<T> {

        if (this.useRedis) {
            return new RedisStorage<T>(uuid, recordRequests, this.redisClient);
        }

        return new InMemoryStorage<T>(recordRequests);
    }
}
