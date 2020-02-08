import * as Q from 'q';
const helpers = require('../../../src/util/helpers');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

interface IRequestSpec {
    method?: string;
    path?: string;
    port?: number;
    body?: any;
    headers?: any;
    mode?: string;
    agent?: boolean;
    key?: string;
    cert?: string;
    hostname?: string;
    localAddress?: string;
    family?: string;
}

export class BaseHttpClient {
    constructor (protocol: string) {
        this.driver = require(protocol);
        this.agent = new this.driver.Agent({ keepAlive: true });
    }

    private agent: any;
    private driver: any;

    public get (path: string, port: number) {
        return this.responseFor({ method: 'GET', path, port });
    }
    public post (path: string, body: any, port: number) {
        return this.responseFor({ method: 'POST', path, port, body });
    }
    public del (path: string, port: number) {
        return this.responseFor({ method: 'DELETE', path, port });
    }
    public put (path: string, body: any, port: number) {
        return this.responseFor({ method: 'PUT', path, port, body });
    }

    private optionsFor (spec: IRequestSpec): any {
        const defaults = {
            hostname: 'localhost',
            headers: { accept: 'application/json' },
            rejectUnauthorized: false
        };

        return helpers.merge(defaults, spec);
    }

    public responseFor (spec: IRequestSpec): Q.Promise<any> {
        const deferred = Q.defer();
        const options: any = this.optionsFor(spec);

        if (!options.port) {
            throw Error('silly rabbit, you forgot to pass the port again');
        }

        if (spec.body && !options.headers['Content-Type']) {
            options.headers['Content-Type'] = 'application/json';
        }

        options.agent = this.agent;
        const request = this.driver.request(options, (response: any) => {
            const packets: any[] = [];

            response.on('data', (chunk: any) => packets.push(chunk));

            response.on('end', () => {
                const buffer = Buffer.concat(packets);
                const contentType = response.headers['content-type'] || '';

                response.body = spec.mode === 'binary' ? buffer : buffer.toString('utf8');

                if (contentType.indexOf('application/json') === 0) {
                    response.body = JSON.parse(response.body);
                }
                deferred.resolve(response);
            });
        });

        request.on('error', deferred.reject);

        if (spec.body) {
            if (typeof spec.body === 'object') {
                request.write(JSON.stringify(spec.body));
            }
            else {
                request.write(spec.body);
            }
        }
        request.end();
        return deferred.promise;
    }
}
