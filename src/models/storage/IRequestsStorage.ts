import { IServerRequestData } from '../IProtocol';
import * as Q from 'q';


export interface IRequestsStorage {
    getCount(): number;

    saveRequest(request: IServerRequestData): Q.Promise<void>;

    getRequests(): Q.Promise<IServerRequestData[]>;
}
