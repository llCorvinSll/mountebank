import { ApiClient } from '../api';
import { BaseHttpClient } from './baseHttpClient';

['http', 'https'].forEach(protocol => {
    const client = new BaseHttpClient(protocol);

    let api: any;
    let port: number;

    beforeEach(() => {
        api = new ApiClient();
        port = api.port + 1;

    });

    describe(`${protocol} imposter`, function () {
        describe('POST /imposters with injections', function () {
            it('should allow javascript predicate for matching (old interface)', function () {
                //note the lower-case keys for headers!!!
                const fn = (request: any) => request.path === '/test';
                const stub = {
                    predicates: [{ inject: fn.toString() }],
                    responses: [{ is: { body: 'MATCHED' } }]
                };
                const request = { protocol, port, stubs: [stub] };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);

                    const spec = {
                        path: '/test?key=value',
                        port,
                        method: 'POST',
                        headers: {
                            'X-Test': 'test headera',
                            'Content-Type': 'text/plain'
                        },
                        body: 'BODY'
                    };
                    return client.responseFor(spec);
                }).then((response: any) => {
                    expect(response.body).toEqual('MATCHED');
                }).finally(() => api.del('/imposters'));
            });

            it('should allow javascript predicate for matching', function () {
                //note the lower-case keys for headers!!!
                const fn = (config: any) => config.request.path === '/test';
                const stub = {
                    predicates: [{ inject: fn.toString() }],
                    responses: [{ is: { body: 'MATCHED' } }]
                };
                const request = { protocol, port, stubs: [stub] };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);

                    const spec = {
                        path: '/test?key=value',
                        port,
                        method: 'POST',
                        headers: {
                            'X-Test': 'test header',
                            'Content-Type': 'text/plain'
                        },
                        body: 'BODY'
                    };
                    return client.responseFor(spec);
                }).then((response: any) => {
                    expect(response.body).toEqual('MATCHED');
                }).finally(() => api.del('/imposters'));
            });

            it('should not validate a bad predicate injection', function () {
                const stub = {
                    predicates: [{ inject: 'return true;' }],
                    responses: [{ is: { body: 'MATCHED' } }]
                };
                const request = { protocol, port, stubs: [stub] };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                }).finally(() => api.del('/imposters'));
            });

            it('should allow synchronous javascript injection for responses (old interface)', function () {
                const fn = (request: any) => ({ body: `${request.method} INJECTED` });
                const stub = { responses: [{ inject: fn.toString() }] };
                const request = { protocol, port, stubs: [stub] };

                return api.post('/imposters', request)
                    .then(() => client.get('/', port))
                    .then((response: any) => {
                        expect(response.body).toEqual('GET INJECTED');
                        expect(response.statusCode).toEqual(200);
                        expect(response.headers.connection).toEqual('close');
                    })
                    .finally(() => api.del('/imposters'));
            });

            it('should allow synchronous javascript injection for responses', function () {
                const fn = (config: any) => ({ body: `${config.request.method} INJECTED` });
                const stub = { responses: [{ inject: fn.toString() }] };
                const request = { protocol, port, stubs: [stub] };

                return api.post('/imposters', request)
                    .then(() => client.get('/', port))
                    .then((response: any) => {
                        expect(response.body).toEqual('GET INJECTED');
                        expect(response.statusCode).toEqual(200);
                        expect(response.headers.connection).toEqual('close');
                    })
                    .finally(() => api.del('/imposters'));
            });

            it('should not validate a bad response injection', function () {
                const fn = () => { throw new Error('BOOM'); };
                const stub = { responses: [{ inject: fn.toString() }] };
                const request = { protocol, port, stubs: [stub] };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                }).finally(() => api.del('/imposters'));
            });

            it('should allow javascript injection to keep state between requests (old interface)', function () {
                const fn = (request: any, state: any) => {
                    if (!state.calls) { state.calls = 0; }
                    state.calls += 1;
                    return { body: state.calls.toString() };
                };
                const stub = { responses: [{ inject: fn.toString() }] };
                const request = { protocol, port, stubs: [stub] };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);

                    return client.get('/', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('1');

                    return client.get('/', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('2');
                }).finally(() => api.del('/imposters'));
            });

            it('should allow javascript injection to keep state between requests', function () {
                const fn = (config: any) => {
                    if (!config.state.calls) { config.state.calls = 0; }
                    config.state.calls += 1;
                    return { body: config.state.calls.toString() };
                };
                const stub = { responses: [{ inject: fn.toString() }] };
                const request = { protocol, port, stubs: [stub] };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);

                    return client.get('/', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('1');

                    return client.get('/', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('2');
                }).finally(() => api.del('/imposters'));
            });

            it('should share state with predicate and response injection (old interface)', function () {
                const responseFn = (request: any, injectState: any, logger: any, callback: any, imposterState: any) => {
                    imposterState.calls = imposterState.calls || 0;
                    imposterState.calls += 1;
                    return { body: 'INJECT' };
                };
                const predicateFn = (request: any, logger: any, state: any) => {
                    const numCalls = state.calls || 0;
                    return numCalls > 1;
                };
                const stubs = [
                    {
                        predicates: [{ //Compound predicate because previous bug didn't pass state in and/or
                            and: [
                                { inject: predicateFn.toString() },
                                { equals: { path: '/' } }
                            ]
                        }],
                        responses: [{ is: { body: 'IS' } }]
                    },
                    {
                        responses: [{ inject: responseFn.toString() }]
                    }
                ];
                const request = { protocol, port, stubs };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.get('/', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('INJECT');
                    return client.get('/', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('INJECT');
                    return client.get('/', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('IS');
                }).finally(() => api.del('/imposters'));
            });

            it('should share state with predicate and response injection', function () {
                const responseFn = (config: any) => {
                    config.state.calls = config.state.calls || 0;
                    config.state.calls += 1;
                    return { body: 'INJECT' };
                };
                const predicateFn = (config: any) => {
                    const numCalls = config.state.calls || 0;
                    return numCalls > 1;
                };
                const stubs = [
                    {
                        predicates: [{ //Compound predicate because previous bug didn't pass state in and/or
                            and: [
                                { inject: predicateFn.toString() },
                                { equals: { path: '/' } }
                            ]
                        }],
                        responses: [{ is: { body: 'IS' } }]
                    },
                    {
                        responses: [{ inject: responseFn.toString() }]
                    }
                ];
                const request = { protocol, port, stubs };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.get('/', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('INJECT');
                    return client.get('/', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('INJECT');
                    return client.get('/', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('IS');
                }).finally(() => api.del('/imposters'));
            });

            it('should allow access to the global process object', function () {
                //https://github.com/bbyars/mountebank/issues/134
                const fn = () => ({ body: process.env.USER || 'test' });
                const stub = { responses: [{ inject: fn.toString() }] };
                const request = { protocol, port, stubs: [stub] };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.get('/', port);
                }).then((response: any) => {
                    expect(response.body).toEqual(process.env.USER || 'test');
                }).finally(() => api.del('/imposters'));
            });

            if (process.env.MB_AIRPLANE_MODE !== 'true') {
                it('should allow asynchronous injection', function () {
                    const fn = (request: any, state: any, logger: any, callback: any) => {
                        const http = require('http');
                        const options = {
                            method: request.method,
                            hostname: 'www.google.com',
                            port: 80,
                            path: request.path,
                            headers: request.headers
                        };

                        options.headers.host = options.hostname;
                        const httpRequest = http.request(options, (response: any) => {
                            response.body = '';
                            response.setEncoding('utf8');
                            response.on('data', (chunk: any) => {
                                response.body += chunk;
                            });
                            response.on('end', () => {
                                callback({
                                    statusCode: response.statusCode,
                                    headers: response.headers,
                                    body: response.body
                                });
                            });
                        });
                        httpRequest.end();
                        //No return value!!!
                    };
                    const stub = { responses: [{ inject: fn.toString() }] };
                    const request = { protocol, port, stubs: [stub] };

                    return api.post('/imposters', request).then((response: any) => {
                        expect(response.statusCode).toEqual(201);

                        return client.get('/', port);
                    }).then((response: any) => {
                        //sometimes 301, sometimes 302
                        //200 on new Mac with El Capitan?
                        expect(response.statusCode <= 302).toBeTruthy();
                        if (response.statusCode === 200) {
                            expect(response.body.indexOf('google') >= 0).toBeTruthy();
                        }
                        else {
                            //google.com.br in Brasil, google.ca in Canada, etc
                            expect(response.headers.location.indexOf('google.') >= 0).toBeTruthy();
                        }
                    }).finally(() => api.del('/imposters'));
                });
            }
        });
    });
});
