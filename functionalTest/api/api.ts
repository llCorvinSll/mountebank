'use strict';

const httpClient = require('./http/baseHttpClient').create('http');

export function create (port: number) {
    port = port || parseInt((process as any).env.MB_PORT || 2525);

    return {
        url: `http://localhost:${port}`,
        port,
        get: (path: string) => httpClient.get(path, port),
        post: (path: string, body: string) => httpClient.post(path, body, port),
        del: (path: string) => httpClient.del(path, port),
        put: (path: string, body: string) => httpClient.put(path, body, port)
    };
}

export class ApiClient {
    constructor(port?: number) {
        this.port = port || parseInt((process as any).env.MB_PORT || 2525);
        this.url = `http://localhost:${this.port}`;
    }

    public url: string;
    public port:number;

    public get = (path: string) => httpClient.get(path, this.port);
    public post = (path: string, body: any) => httpClient.post(path, body, this.port);
    public del = (path: string) => httpClient.del(path, this.port);
    public put = (path: string, body: any) => httpClient.put(path, body, this.port);
}
