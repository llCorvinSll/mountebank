import * as Q from 'q';


export interface IStorage<T> {
    getCount(): number;

    saveRequest(request: T): Q.Promise<void>;

    getRequests(): Q.Promise<T[]>;

    clean(): void;
}
