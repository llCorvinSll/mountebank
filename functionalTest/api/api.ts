import { BaseHttpClient } from './http/baseHttpClient';


export class ApiClient {
    constructor (port?: number) {
        this.port = port || parseInt((process as any).env.MB_PORT || 2525);
        this.url = `http://localhost:${this.port}`;
        this.httpClient = new BaseHttpClient('http');
    }

    private httpClient: BaseHttpClient;
    public url: string;
    public port: number;

    public get (path: string) {
        return this.httpClient.get(path, this.port);
    }

    public post (path: string, body: any) {
        return this.httpClient.post(path, body, this.port);
    }

    public del (path: string) {
        return this.httpClient.del(path, this.port);
    }

    public put (path: string, body: any) {
        return this.httpClient.put(path, body, this.port);
    }
}
