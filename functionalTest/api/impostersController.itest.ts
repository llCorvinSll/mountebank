import { ApiClient } from './api';

const sanitizeBody = require('../testUtils/sanitize').sanitizeBody;
import { BaseHttpClient } from './http/baseHttpClient';

describe('POST /imposters', function () {
    let api: ApiClient;
    let port: number;

    beforeEach(() => {
        api = new ApiClient();
        port = api.port + 1;
    });

    it('should return create new imposter with consistent hypermedia', function () {
        let createdBody: any;
        let imposterPath: any;

        return api.post('/imposters', { protocol: 'http', port }).then((response: any) => {
            createdBody = response.body;

            expect(response.statusCode).toEqual(201);
            expect(response.headers.location).toEqual(response.body._links.self.href);

            return api.get(response.headers.location);
        }).then((response: any) => {
            expect(response.statusCode).toEqual(200);
            expect(response.body).toEqual(createdBody);
        }).finally(() => api.del(imposterPath));
    });

    it('should create imposter at provided port', function () {
        return api.post('/imposters', { protocol: 'http', port })
            .then(() => api.get('/'))
            .then((response: any) => {
                expect(response.statusCode).toEqual(200);
            })
            .finally(() => api.del(`/imposters/${port}`));
    });

    it('should return 400 on invalid input', function () {
        return api.post('/imposters', {}).then((response: any) => {
            expect(response.statusCode).toEqual(400);
        });
    });

    it('should return 400 on port conflict', function () {
        return api.post('/imposters', { protocol: 'http', port: api.port }).then((response: any) => {
            expect(response.statusCode).toEqual(400);
        });
    });

    it('should return 400 on invalid JSON', function () {
        return api.post('/imposters', 'invalid').then((response: any) => {
            expect(response.statusCode).toEqual(400);
            expect(response.body).toEqual({
                errors: [{
                    code: 'invalid JSON',
                    message: 'Unable to parse body as JSON',
                    source: 'invalid'
                }]
            });
        });
    });
});

describe('DELETE /imposters', function () {
    let api: ApiClient;
    let port: number;
    let client: BaseHttpClient;

    beforeEach(() => {
        client = new BaseHttpClient('http');
        api = new ApiClient();
        port = api.port + 1;
    });

    it('returns 200 with empty array if no imposters had been created', function () {
        return api.del('/imposters').then((response: any) => {
            expect(response.statusCode).toEqual(200);
            expect(response.body).toEqual({ imposters: [] });
        });
    });

    it('deletes all imposters and returns replayable body', function (done) {
        const firstImposter = { protocol: 'http', port, name: 'imposter 1' };
        const secondImposter = { protocol: 'http', port: port + 1, name: 'imposter 1' };

        return api.post('/imposters', firstImposter).then((response: any) => {
            expect(response.statusCode).toEqual(201);
            return api.post('/imposters', secondImposter);
        }).then((response: any) => {
            expect(response.statusCode).toEqual(201);
            return client.get('/', firstImposter.port);
        }).then(() => api.del('/imposters')).then((response: any) => {
            expect(response.statusCode).toEqual(200);
            expect(response.body).toEqual({
                imposters: [
                    {
                        protocol: 'http',
                        port: firstImposter.port,
                        name: firstImposter.name,
                        recordRequests: false,
                        stubs: []
                    },
                    {
                        protocol: 'http',
                        port: secondImposter.port,
                        name: secondImposter.name,
                        recordRequests: false,
                        stubs: []
                    }
                ]
            });

            return client.get('/', firstImposter.port);
        }).done(() => {
            throw new Error('did not close socket');
            done();
        }, (error: any) => {
            expect(error.code).toEqual('ECONNREFUSED');
            done();
        });
    });

    it('supports returning a non-replayable body with proxies removed', function () {
        const isImposter = {
            protocol: 'http',
            port,
            name: 'imposter-is',
            stubs: [{ responses: [{ is: { body: 'Hello, World!' } }] }]
        };
        const proxyImposter = {
            protocol: 'http',
            port: port + 1,
            name: 'imposter-proxy',
            stubs: [{ responses: [{ proxy: { to: 'http://www.google.com' } }] }]
        };

        return api.post('/imposters', isImposter).then((response: any) => {
            expect(response.statusCode).toEqual(201);
            return api.post('/imposters', proxyImposter);
        }).then((response: any) => {
            expect(response.statusCode).toEqual(201);
            return api.del('/imposters?removeProxies=true&replayable=false');
        }).then((response: any) => {
            const sanitizedBody = sanitizeBody(response);
            expect(response.statusCode).toEqual(200);
            expect(sanitizedBody).toEqual({
                imposters: [
                    {
                        protocol: 'http',
                        port: isImposter.port,
                        name: isImposter.name,
                        recordRequests: false,
                        numberOfRequests: 0,
                        requests: [],
                        stubs: [{
                            _uuid: '696969696969',
                            responses: [{ is: { body: 'Hello, World!' } }],
                            _links: { self: { href: `${api.url}/imposters/${isImposter.port}/stubs/0` } }
                        }],
                        _links: {
                            self: { href: `http://localhost:${api.port}/imposters/${isImposter.port}` },
                            stubs: { href: `http://localhost:${api.port}/imposters/${isImposter.port}/stubs` }
                        }
                    },
                    {
                        protocol: 'http',
                        port: proxyImposter.port,
                        name: proxyImposter.name,
                        recordRequests: false,
                        numberOfRequests: 0,
                        requests: [],
                        stubs: [],
                        _links: {
                            self: { href: `http://localhost:${api.port}/imposters/${proxyImposter.port }` },
                            stubs: { href: `http://localhost:${api.port}/imposters/${proxyImposter.port}/stubs` }
                        }
                    }
                ]
            });
        });
    });
});

describe('PUT /imposters', function () {
    let api: ApiClient;
    let port: number;
    let client: BaseHttpClient;

    beforeEach(() => {
        client = new BaseHttpClient('http');
        api = new ApiClient();
        port = api.port + 1;
    });

    afterEach(() => {
        api.del('/imposters');
    });

    it('creates all imposters provided when no imposters previously exist', () => {
        const request = {
            imposters: [
                { protocol: 'http', port, name: 'imposter 1' },
                { protocol: 'http', port: port + 1, name: 'imposter 2' },
                { protocol: 'http', port: port + 2, name: 'imposter 3' }
            ]
        };

        return api.put('/imposters', request).then((response: any) => {
            expect(response.statusCode).toEqual(200);
            return client.get('/', port);
        }).then((response: any) => {
            expect(response.statusCode).toEqual(200);
            return client.get('/', port + 1);
        }).then((response: any) => {
            expect(response.statusCode).toEqual(200);
            return client.get('/', port + 2);
        }).then((response: any) => {
            expect(response.statusCode).toEqual(200);
        }).finally(() => api.del('/imposters'));
    });

    it('overwrites previous imposters', function () {
        const postRequest = { protocol: 'smtp', port: port };
        const putRequest = {
            imposters: [
                { protocol: 'http', port, name: 'imposter 1' },
                { protocol: 'http', port: port + 1, name: 'imposter 2' },
                { protocol: 'http', port: port + 2, name: 'imposter 3' }
            ]
        };

        return api.post('/imposters', postRequest).then((response: any) => {
            expect(response.statusCode).toEqual(201);
            return api.put('/imposters', putRequest);
        }).then((response: any) => {
            expect(response.statusCode).toEqual(200);
            return client.get('/', port);
        }).then((response: any) => {
            expect(response.statusCode).toEqual(200);
            return client.get('/', port + 1);
        }).then((response: any) => {
            expect(response.statusCode).toEqual(200);
            return client.get('/', port + 2);
        }).then((response: any) => {
            expect(response.statusCode).toEqual(200);
        }).finally(() => api.del('/imposters'));
    });
});
