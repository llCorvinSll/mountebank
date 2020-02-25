import { IStorage } from './IStorage';
import { RedisStorage } from './RedisStorage';
import { InMemoryStorage } from './InMemoryStorage';
import { RedisClient, createClient } from 'redis';


export interface IStorageConfig {
    use_redis?: boolean;
    host?: string;
}

export class StorageCreator {
    constructor (private config: IStorageConfig = {}) {
        if (this.config.use_redis) {
            this.redisClient = createClient({
                host: config.host
            });
        }
    }

    private redisClient: RedisClient;

    createStorage<T> (uuid: string, recordRequests: boolean): IStorage<T> {

        if (this.config.use_redis) {
            return new RedisStorage<T>(uuid, recordRequests, this.redisClient);
        }

        return new InMemoryStorage<T>(recordRequests);
    }
}
