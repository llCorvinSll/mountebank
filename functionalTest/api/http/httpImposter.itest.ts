import { ApiClient } from '../api';
const BaseHttpClient = require('./baseHttpClient');
const sanitizeBody = require('../../testUtils/sanitize').sanitizeBody;
const headersHelper = require('../../../src/models/http/headersHelper');

['http', 'https'].forEach(protocol => {
    const client = BaseHttpClient.create(protocol);
    let api: ApiClient;
    let port: number;
    let mb: any;

    beforeEach(() => {
        api = new ApiClient();
        port = api.port + 1;
        mb = require('../../mb').create(port + 1);
    });

    describe(`${protocol} imposter`, function () {
        // this.timeout(timeout);

        describe('POST /imposters/:id', function () {
            it('should auto-assign port if port not provided', function () {
                const request = { protocol };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.get('/first', response.body.port);
                }).then((response: any) => {
                    expect(response.statusCode).toEqual(200);
                }).finally(() => api.del('/imposters'));
            });

            it('should not support CORS preflight requests if "allowCORS" option is disabled', function () {
                const request = { protocol };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.responseFor({
                        method: 'OPTIONS',
                        path: '/',
                        headers: {
                            'Access-Control-Request-Method': 'PUT',
                            'Access-Control-Request-Headers': 'X-Custom-Header',
                            Origin: 'localhost:8080'
                        },
                        port: response.body.port
                    });
                }).then((response: any) => {
                    const headersJar = headersHelper.getJar(response.headers);

                    expect(response.statusCode).toEqual(200);

                    expect(!headersJar.get('access-control-allow-headers')).toBeTruthy();
                    expect(!headersJar.get('access-control-allow-methods')).toBeTruthy();
                    expect(!headersJar.get('access-control-allow-origin')).toBeTruthy();
                }).finally(() => api.del('/imposters'));
            });

            it('should support CORS preflight requests if "allowCORS" option is enabled', function () {
                const request = { protocol, allowCORS: true };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.responseFor({
                        method: 'OPTIONS',
                        path: '/',
                        headers: {
                            'Access-Control-Request-Method': 'PUT',
                            'Access-Control-Request-Headers': 'X-Custom-Header',
                            Origin: 'localhost:8080'
                        },
                        port: response.body.port
                    });
                }).then((response: any) => {
                    const headersJar = headersHelper.getJar(response.headers);

                    expect(response.statusCode).toEqual(200);

                    expect(headersJar.get('access-control-allow-headers')).toEqual('X-Custom-Header');
                    expect(headersJar.get('access-control-allow-methods')).toEqual('PUT');
                    expect(headersJar.get('access-control-allow-origin')).toEqual('localhost:8080');
                }).finally(() => api.del('/imposters')
                );
            });

            it('should not handle non-preflight requests when "allowCORS" is enabled', function () {
                const request = { protocol, allowCORS: true };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.responseFor({
                        method: 'OPTIONS',
                        path: '/',
                        // Missing the necessary headers.
                        port: response.body.port
                    });
                }).then((response: any) => {
                    const headersJar = headersHelper.getJar(response.headers);

                    expect(response.statusCode).toEqual(200);

                    expect(!headersJar.get('access-control-allow-headers')).toBeTruthy();
                    expect(!headersJar.get('access-control-allow-methods')).toBeTruthy();
                    expect(!headersJar.get('access-control-allow-origin')).toBeTruthy();
                }).finally(() => api.del('/imposters')
                );
            });

            it('should default content type to json if not provided', function () {
                const request = { port, protocol };

                return api.post('/imposters', request/* , true */).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.get('/first', port);
                }).then((response: any) => {
                    expect(response.statusCode).toEqual(200);
                }).finally(() => api.del('/imposters'));
            });
        });

        describe('GET /imposters/:id', function () {
            it('should provide access to all requests', function () {
                const imposterRequest = { protocol, port };

                return api.post('/imposters', imposterRequest)
                    .then(() => client.get('/first', port))
                    .then(() => client.get('/second', port))
                    .then(() => api.get(`/imposters/${port}`))
                    .then((response: any) => {
                        const requests = response.body.requests.map((request: any) => request.path);
                        expect(requests).toEqual(['/first', '/second']);
                    })
                    .finally(() => api.del('/imposters'));
            });

            it('should save headers in case-sensitive way', function () {
                const imposterRequest = { protocol, port };

                return api.post('/imposters', imposterRequest)
                    .then(() => client.responseFor({
                        method: 'GET',
                        path: '/',
                        port,
                        headers: {
                            Accept: 'APPLICATION/json'
                        }
                    }))
                    .then(() => api.get(`/imposters/${port}`))
                    .then((response: any) => {
                        const request = response.body.requests[0];
                        expect(request.headers.Accept).toEqual('APPLICATION/json');
                    })
                    .finally(() => api.del('/imposters'));
            });

            it('should return list of stubs in order', function () {
                const first = { responses: [{ is: { body: '1' } }] };
                const second = { responses: [{ is: { body: '2' } }] };
                const request = { protocol, port, stubs: [first, second] };

                return api.post('/imposters', request)
                    .then(() => api.get(`/imposters/${port}`))
                    .then((response: any) => {
                        const sanitizedBody = sanitizeBody(response);
                        expect(response.statusCode).toEqual(200);
                        expect(sanitizedBody.stubs).toEqual([
                            {
                                _uuid: '696969696969',
                                responses: [{ is: { body: '1' } }],
                                _links: { self: { href: `${api.url}/imposters/${port}/stubs/0` } }
                            },
                            {
                                _uuid: '696969696969',
                                responses: [{ is: { body: '2' } }],
                                _links: { self: { href: `${api.url}/imposters/${port}/stubs/1` } }
                            }
                        ]);
                    })
                    .finally(() => api.del('/imposters'));
            });

            it('should record matches against stubs', function () {
                const stub = { responses: [{ is: { body: '1' } }, { is: { body: '2' } }] };
                const request = { protocol, port, stubs: [stub] };

                return api.post('/imposters', request)
                    .then(() => client.get('/first?q=1', port))
                    .then(() => client.get('/second?q=2', port))
                    .then(() => api.get(`/imposters/${port}`))
                    .then((response: any) => {
                        const stubs = JSON.stringify(response.body.stubs);
                        const withTimeRemoved = stubs.replace(/"timestamp":"[^"]+"/g, '"timestamp":"NOW"');
                        const withClientPortRemoved = withTimeRemoved
                            .replace(/"requestFrom":"[a-f:.\d]+"/g, '"requestFrom":"HERE"')
                            .replace(/"_uuid":"[\S]+?"/g, '"_uuid":"696969696969"');
                        const actualWithoutEphemeralData = JSON.parse(withClientPortRemoved);
                        const requestHeaders = { accept: 'application/json', Host: `localhost:${port}`, Connection: 'keep-alive' };

                        expect(actualWithoutEphemeralData).toEqual([{
                            responses: [{ is: { body: '1' } }, { is: { body: '2' } }],
                            _uuid: '696969696969',
                            matches: [
                                {
                                    timestamp: 'NOW',
                                    request: {
                                        requestFrom: 'HERE',
                                        path: '/first',
                                        query: { q: '1' },
                                        method: 'GET',
                                        headers: requestHeaders,
                                        ip: '::ffff:127.0.0.1',
                                        body: ''
                                    },
                                    response: {
                                        body: '1'
                                    }
                                },
                                {
                                    timestamp: 'NOW',
                                    request: {
                                        requestFrom: 'HERE',
                                        path: '/second',
                                        query: { q: '2' },
                                        method: 'GET',
                                        headers: requestHeaders,
                                        ip: '::ffff:127.0.0.1',
                                        body: ''
                                    },
                                    response: {
                                        body: '2'
                                    }
                                }
                            ],
                            _links: { self: { href: `${api.url}/imposters/${port}/stubs/0` } }
                        }]);
                    })
                    .finally(() => api.del('/imposters'));
            });

            it('should not record matches against stubs if --debug flag is missing', function () {
                const stub = { responses: [{ is: { body: '1' } }, { is: { body: '2' } }] };
                const request = { protocol, port, stubs: [stub] };

                return mb.start()
                    .then(() => mb.post('/imposters', request))
                    .then(() => client.get('/first?q=1', port))
                    .then(() => client.get('/second?q=2', port))
                    .then(() => mb.get(`/imposters/${port}`))
                    .then((response: any) => {
                        const sanitizedBody = sanitizeBody(response);
                        expect(sanitizedBody.stubs).toEqual([{
                            _uuid: '696969696969',
                            responses: [{ is: { body: '1' } }, { is: { body: '2' } }],
                            _links: { self: { href: `${mb.url}/imposters/${port}/stubs/0` } }
                        }]);
                    })
                    .finally(() => mb.stop());
            });

            it('should record numberOfRequests even if --mock flag is missing', function () {
                const stub = { responses: [{ is: { body: 'SUCCESS' } }] };
                const request = { protocol, port, stubs: [stub] };

                return mb.start()
                    .then(() => mb.post('/imposters', request))
                    .then(() => client.get('/', port))
                    .then(() => client.get('/', port))
                    .then(() => mb.get(`/imposters/${port}`))
                    .then((response: any) => {
                        expect(response.body.numberOfRequests).toEqual(2);
                    })
                    .finally(() => mb.stop());
            });

            it('should return 404 if imposter has not been created', function () {
                return api.get('/imposters/3535').then((response: any) => {
                    expect(response.statusCode).toEqual(404);
                });
            });
        });

        describe('DELETE /imposters/:id', function () {
            it('should shutdown server at that port', function () {
                const request = { protocol, port };

                return api.post('/imposters', request)
                    .then((response: any) => api.del(response.headers.location))
                    .then((response: any) => {
                        expect(response.statusCode).toEqual(200);
                        return api.post('/imposters', { protocol: 'http', port });
                    })
                    .then((response: any) => {
                        expect(response.statusCode).toEqual(201);
                    })
                    .finally(() => api.del(`/imposters/${port}`));
            });

            it('should return a 200 even if the server does not exist', function () {
                return api.del('/imposters/9999')
                    .then((response: any) => expect(response.statusCode).toEqual(200));
            });

            it('supports returning a replayable body with proxies removed', function () {
                const imposter = {
                    protocol: 'http',
                    port: port + 1,
                    name: 'impoter',
                    stubs: [{ responses: [
                        { proxy: { to: 'http://www.google.com' } },
                        { is: { body: 'Hello, World!' } }
                    ] }]
                };

                return api.post('/imposters', imposter).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return api.del(`/imposters/${imposter.port}?removeProxies=true&replayable=true`);
                }).then((response: any) => {
                    const sanitizedBody = sanitizeBody(response);

                    expect(response.statusCode).toEqual(200);
                    expect(sanitizedBody).toEqual({
                        protocol: 'http',
                        port: port + 1,
                        name: imposter.name,
                        recordRequests: false,
                        stubs: [{
                            responses: [{ is: { body: 'Hello, World!' } }]
                        }]
                    });
                });
            });
        });
    });
});
