import { ApiClient } from '../api';

const assert = require('assert');
const fs = require('fs');
const util = require('util');
import { BaseHttpClient } from './baseHttpClient';
const isInProcessImposter = require('../../testHelpers').isInProcessImposter;
const sanitizeBody = require('../../testUtils/sanitize').sanitizeBody;
const airplaneMode = process.env.MB_AIRPLANE_MODE === 'true';

describe('http proxy stubs', function () {
    let api: any;
    let port: number;
    let client: BaseHttpClient;

    beforeEach(() => {
        client = new BaseHttpClient('http');
        api = new ApiClient();
        port = api.port + 1;
    });

    if (!airplaneMode) {
        it('should allow proxy stubs to invalid domains', function () {
            const stub = { responses: [{ proxy: { to: 'http://invalid.domain' } }] };
            const request = { protocol: 'http', port, stubs: [stub] };

            return api.post('/imposters', request)
                .then(() => client.get('/', port))
                .then((response: any) => {
                    expect(response.statusCode).toEqual(500);
                    expect(response.body.errors[0].code).toEqual('invalid proxy');
                    expect(response.body.errors[0].message).toEqual('Cannot resolve "http://invalid.domain"');
                }).finally(() => api.del('/imposters'));
        });
    }

    it('should reflect default mode after first proxy if no mode passed in', function () {
        const originServerPort = port + 1;
        const originServerStub = { responses: [{ is: { body: 'origin server' } }] };
        const originServerRequest = {
            protocol: 'http',
            port: originServerPort,
            stubs: [originServerStub],
            name: 'origin'
        };
        const proxyStub = { responses: [{ proxy: { to: `http://localhost:${originServerPort}` } }] };
        const proxyRequest = { protocol: 'http', port, stubs: [proxyStub], name: 'proxy' };

        return api.post('/imposters', originServerRequest)
            .then(() => api.post('/imposters', proxyRequest))
            .then((response: any) => {
                expect(response.statusCode).toEqual(201);
                return client.get('/', port);
            }).then((response: any) => {
                expect(response.body).toEqual('origin server');
                return api.get(`/imposters/${port}`);
            }).then((response: any) => {
                expect(response.body.stubs[1].responses[0].proxy.mode).toEqual('proxyOnce');
            }).finally(() => api.del('/imposters'));
    });

    it('should record new stubs in order in front of proxy resolver using proxyOnce mode', function () {
        const originServerPort = port + 1;
        const originServerFn = (request: any, state: any) => {
            state.count = state.count || 0;
            state.count += 1;
            return {
                body: `${state.count}. ${request.method} ${request.path}`
            };
        };
        const originServerStub = { responses: [{ inject: originServerFn.toString() }] };
        const originServerRequest = {
            protocol: 'http',
            port: originServerPort,
            stubs: [originServerStub],
            name: 'origin server'
        };
        const proxyDefinition = {
            to: `http://localhost:${originServerPort}`,
            mode: 'proxyOnce',
            predicateGenerators: [
                {
                    matches: {
                        method: true,
                        path: true
                    }
                }
            ]
        };
        const proxyStub = { responses: [{ proxy: proxyDefinition }] };
        const proxyRequest = { protocol: 'http', port, stubs: [proxyStub], name: 'proxy' };

        return api.post('/imposters', originServerRequest)
            .then(() => api.post('/imposters', proxyRequest))
            .then((response: any) => {
                expect(response.statusCode).toEqual(201);
                return client.get('/first', port);
            }).then((response: any) => {
                expect(response.body).toEqual('1. GET /first');
                return client.del('/first', port);
            }).then((response: any) => {
                expect(response.body).toEqual('2. DELETE /first');
                return client.get('/second', port);
            }).then((response: any) => {
                expect(response.body).toEqual('3. GET /second');
                return client.get('/first', port);
            }).then((response: any) => {
                expect(response.body).toEqual('1. GET /first');
                return client.del('/first', port);
            }).then((response: any) => {
                expect(response.body).toEqual('2. DELETE /first');
                return client.get('/second', port);
            }).then((response: any) => {
                expect(response.body).toEqual('3. GET /second');
                return api.del(`/imposters/${port}`);
            }).then((response: any) => {
                expect(response.body.stubs.length).toEqual(4);
            }).finally(() => api.del('/imposters'));
    });

    it('should allow programmatic creation of predicates', function () {
        const originServerPort = port + 1;
        const originServerStub = { responses: [{ is: { body: 'ORIGIN' } }] };
        const originServerRequest = {
            protocol: 'http',
            port: originServerPort,
            stubs: [originServerStub],
            name: 'origin server'
        };
        const fn = function (config: any) {
            //Ignore first element; will be empty string in front of root /
            const pathParts = config.request.path.split('/').splice(1);
            //eslint-disable-next-line arrow-body-style
            return pathParts.map((part: any) => { return { contains: { path: part } }; });
        };
        const proxyDefinition = {
            to: `http://localhost:${originServerPort}`,
            predicateGenerators: [{ inject: fn.toString() }]
        };
        const proxyStub = { responses: [{ proxy: proxyDefinition }] };
        const proxyRequest = { protocol: 'http', port, stubs: [proxyStub], name: 'proxy' };

        return api.post('/imposters', originServerRequest)
            .then(() => api.post('/imposters', proxyRequest))
            .then((response: any) => {
                expect(response.statusCode).toEqual(201);
                return client.get('/first/third', port);
            }).then((response: any) => {
                expect(response.body).toEqual('ORIGIN');
                return api.get(`/imposters/${port}`);
            }).then((response: any) => {
                const predicates = response.body.stubs[0].predicates;
                assert.deepEqual(predicates, [
                    { contains: { path: 'first' } },
                    { contains: { path: 'third' } }
                ]);
            }).finally(() => api.del('/imposters'));
    });

    it('should record new stubs with multiple responses behind proxy resolver in proxyAlways mode', function () {
        const originServerPort = port + 1;
        const originServerFn = (request: any, state: any) => {
            state.count = state.count || 0;
            state.count += 1;
            return {
                body: `${state.count}. ${request.path}`
            };
        };
        const originServerStub = { responses: [{ inject: originServerFn.toString() }] };
        const originServerRequest = {
            protocol: 'http',
            port: originServerPort,
            stubs: [originServerStub],
            name: 'origin server'
        };
        const proxyDefinition = {
            to: `http://localhost:${originServerPort}`,
            mode: 'proxyAlways',
            predicateGenerators: [{ matches: { path: true } }]
        };
        const proxyStub = { responses: [{ proxy: proxyDefinition }] };
        const proxyRequest = { protocol: 'http', port, stubs: [proxyStub], name: 'proxy' };

        return api.post('/imposters', originServerRequest)
            .then(() => api.post('/imposters', proxyRequest))
            .then((response: any) => {
                expect(response.statusCode).toEqual(201);
                return client.get('/first', port);
            })
            .then(() => client.get('/second', port))
            .then(() => client.get('/first', port))
            .then(() => api.del(`/imposters/${port}`))
            .then((response: any) => {
                expect(response.body.stubs.length).toEqual(3);

                const stubs = response.body.stubs;
                const responses = stubs.splice(1).map((stub: any) => stub.responses.map((stubResponse: any) => stubResponse.is.body));

                assert.deepEqual(responses, [['1. /first', '3. /first'], ['2. /second']]);
            })
            .finally(() => api.del('/imposters'));
    });

    it('should capture responses together in proxyAlways mode even with complex predicateGenerators', function () {
        const originServerPort = port + 1;
        const originServerFn = (request: any, state: any) => {
            state.count = state.count || 0;
            state.count += 1;
            return {
                body: `${state.count}. ${request.path}`
            };
        };
        const originServerStub = { responses: [{ inject: originServerFn.toString() }] };
        const originServerRequest = {
            protocol: 'http',
            port: originServerPort,
            stubs: [originServerStub],
            name: 'origin server'
        };
        const proxyDefinition = {
            to: `http://localhost:${originServerPort}`,
            mode: 'proxyAlways',
            predicateGenerators: [{
                matches: {
                    path: true,
                    method: true
                },
                caseSensitive: false
            }]
        };
        const proxyStub = { responses: [{ proxy: proxyDefinition }] };
        const proxyRequest = { protocol: 'http', port, stubs: [proxyStub], name: 'proxy' };

        return api.post('/imposters', originServerRequest)
            .then(() => api.post('/imposters', proxyRequest))
            .then((response: any) => {
                expect(response.statusCode).toEqual(201);
                return client.get('/first', port);
            })
            .then(() => client.get('/second', port))
            .then(() => client.get('/first', port))
            .then(() => api.del(`/imposters/${port}`))
            .then((response: any) => {
                expect(response.body.stubs.length).toEqual(3);

                const stubs = response.body.stubs;
                const responses = stubs.splice(1).map((stub: any) => stub.responses.map((stubResponse: any) => stubResponse.is.body));

                assert.deepEqual(responses, [['1. /first', '3. /first'], ['2. /second']]);
            })
            .finally(() => api.del('/imposters'));
    });

    it('should match entire object graphs', function () {
        const originServerPort = port + 1;
        const originServerFn = (request: any, state: any) => {
            state.count = state.count || 0;
            state.count += 1;
            return {
                body: `${state.count}. ${JSON.stringify(request.query)}`
            };
        };
        const originServerStub = { responses: [{ inject: originServerFn.toString() }] };
        const originServerRequest = {
            protocol: 'http',
            port: originServerPort,
            stubs: [originServerStub],
            name: 'origin server'
        };
        const proxyDefinition = {
            to: `http://localhost:${originServerPort}`,
            mode: 'proxyOnce',
            predicateGenerators: [{ matches: { query: true } }]
        };
        const proxyStub = { responses: [{ proxy: proxyDefinition }] };
        const proxyRequest = { protocol: 'http', port, stubs: [proxyStub], name: 'proxy' };

        return api.post('/imposters', originServerRequest)
            .then(() => api.post('/imposters', proxyRequest))
            .then((response: any) => {
                expect(response.statusCode).toEqual(201);
                return client.get('/?first=1&second=2', port);
            }).then((response: any) => {
                expect(response.body).toEqual('1. {"first":"1","second":"2"}');
                return client.get('/?first=1', port);
            }).then((response: any) => {
                expect(response.body).toEqual('2. {"first":"1"}');
                return client.get('/?first=2&second=2', port);
            }).then((response: any) => {
                expect(response.body).toEqual('3. {"first":"2","second":"2"}');
                return client.get('/?first=1&second=2', port);
            }).then((response: any) => {
                expect(response.body).toEqual('1. {"first":"1","second":"2"}');
                return api.del(`/imposters/${originServerPort}`);
            }).finally(() => api.del('/imposters'));
    });

    it('should match sub-objects', function () {
        const originServerPort = port + 1;
        const originServerFn = (request: any, state: any) => {
            state.count = state.count || 0;
            state.count += 1;
            return {
                body: `${state.count}. ${JSON.stringify(request.query)}`
            };
        };
        const originServerStub = { responses: [{ inject: originServerFn.toString() }] };
        const originServerRequest = {
            protocol: 'http',
            port: originServerPort,
            stubs: [originServerStub],
            name: 'origin server'
        };
        const proxyDefinition = {
            to: `http://localhost:${originServerPort}`,
            mode: 'proxyOnce',
            predicateGenerators: [{ matches: { query: { first: true } } }]
        };
        const proxyStub = { responses: [{ proxy: proxyDefinition }] };
        const proxyRequest = { protocol: 'http', port, stubs: [proxyStub], name: 'proxy' };

        return api.post('/imposters', originServerRequest)
            .then(() => api.post('/imposters', proxyRequest))
            .then((response: any) => {
                expect(response.statusCode).toEqual(201);
                return client.get('/?first=1&second=2', port);
            }).then((response: any) => {
                expect(response.body).toEqual('1. {"first":"1","second":"2"}');
                return client.get('/?first=2&second=2', port);
            }).then((response: any) => {
                expect(response.body).toEqual('2. {"first":"2","second":"2"}');
                return client.get('/?first=3&second=2', port);
            }).then((response: any) => {
                expect(response.body).toEqual('3. {"first":"3","second":"2"}');
                return client.get('/?first=1&second=2&third=3', port);
            }).then((response: any) => {
                expect(response.body).toEqual('1. {"first":"1","second":"2"}');
                return api.del(`/imposters/${originServerPort}`);
            }).finally(() => api.del('/imposters'));
    });

    it('should persist behaviors from origin server', function () {
        const originServerPort = port + 1;
        const originServerStub = { responses: [{ is: { body: '${SALUTATION} ${NAME}' } }] };
        const originServerRequest = {
            protocol: 'http',
            port: originServerPort,
            stubs: [originServerStub],
            name: 'origin'
        };
        const shellFn = function exec () {
            console.log(process.argv[3].replace('${SALUTATION}', 'Hello'));
        };
        const decorator = (request: any, response: any) => {
            response.headers['X-Test'] = 'decorated';
        };
        const proxyResponse = {
            proxy: { to: `http://localhost:${originServerPort}` },
            _behaviors: {
                decorate: decorator.toString(),
                shellTransform: 'node shellTransformTest.js',
                copy: [{
                    from: 'path',
                    into: '${NAME}',
                    using: { method: 'regex', selector: '\\w+' }
                }]
            }
        };
        const proxyStub = { responses: [proxyResponse] };
        const proxyRequest = { protocol: 'http', port, stubs: [proxyStub], name: 'proxy' };

        fs.writeFileSync('shellTransformTest.js', util.format('%s\nexec();', shellFn.toString()));

        return api.post('/imposters', originServerRequest)
            .then(() => api.post('/imposters', proxyRequest))
            .then((response: any) => {
                expect(response.statusCode).toEqual(201);
                return client.get('/mountebank', port);
            }).then((response: any) => {
                expect(response.body).toEqual('Hello mountebank');
                expect(response.headers['x-test']).toEqual('decorated');
                return client.get('/world', port);
            }).then((response: any) => {
                expect(response.body).toEqual('Hello mountebank');
                expect(response.headers['x-test']).toEqual('decorated');
            }).finally(() => {
                fs.unlinkSync('shellTransformTest.js');
                return api.del('/imposters');
            });
    });

    it('should support adding latency to saved responses based on how long the origin server took to respond', function () {
        const originServerPort = port + 1;
        const originServerStub = { responses: [{ is: { body: 'origin server' }, _behaviors: { wait: 100 } }] };
        const originServerRequest = {
            protocol: 'http',
            port: originServerPort,
            stubs: [originServerStub],
            name: 'origin'
        };
        const proxyStub = { responses: [{ proxy: {
            to: `http://localhost:${originServerPort}`,
            addWaitBehavior: true
        } }] };
        const proxyRequest = { protocol: 'http', port, stubs: [proxyStub], name: 'proxy' };

        return api.post('/imposters', originServerRequest)
            .then(() => api.post('/imposters', proxyRequest))
            .then((response: any) => {
                expect(response.statusCode).toEqual(201);
                return client.get('/', port);
            }).then((response: any) => {
                expect(response.body).toEqual('origin server');
                return api.get(`/imposters/${port}`);
            }).then((response: any) => {
                const stubResponse = response.body.stubs[0].responses[0];
                //eslint-disable-next-line no-underscore-dangle
                expect(stubResponse._behaviors.wait).toEqual(stubResponse.is._proxyResponseTime);
            }).finally(() => api.del('/imposters'));
    });

    it('should support retrieving replayable JSON with proxies removed for later playback', function () {
        const originServerPort = port + 1;
        const originServerFn = (request: any, state: any) => {
            state.count = state.count || 0;
            state.count += 1;
            return {
                body: `${state.count}. ${request.path}`
            };
        };
        const originServerStub = { responses: [{ inject: originServerFn.toString() }] };
        const originServerRequest = {
            protocol: 'http',
            port: originServerPort,
            stubs: [originServerStub],
            name: 'origin server'
        };
        const proxyDefinition = {
            to: `http://localhost:${originServerPort}`,
            mode: 'proxyAlways',
            predicateGenerators: [{ matches: { path: true } }]
        };
        const proxyStub = { responses: [{ proxy: proxyDefinition }] };
        const proxyRequest = { protocol: 'http', port, stubs: [proxyStub], name: 'proxy' };

        return api.post('/imposters', originServerRequest)
            .then(() => api.post('/imposters', proxyRequest))
            .then((response: any) => {
                expect(response.statusCode).toEqual(201);
                return client.get('/first', port);
            }).then(() => client.get('/second', port)).then(() => client.get('/first', port)).then(() => api.del(`/imposters/${originServerPort}`)).then(() => api.get('/imposters?replayable=true&removeProxies=true')).then((response: any) => {
                const sanitizedBody = sanitizeBody(response);

                assert.deepEqual(sanitizedBody, {
                    imposters: [
                        {
                            protocol: 'http',
                            port,
                            name: proxyRequest.name,
                            recordRequests: false,
                            stubs: [
                                {
                                    predicates: [
                                        {
                                            deepEquals: {
                                                path: '/first'
                                            }
                                        }
                                    ],
                                    responses: [
                                        {
                                            is: {
                                                statusCode: 200,
                                                headers: {
                                                    Connection: 'close',
                                                    Date: 'NOW',
                                                    'Transfer-Encoding': 'chunked'
                                                },
                                                body: '1. /first',
                                                _mode: 'text'
                                            }
                                        },
                                        {
                                            is: {
                                                statusCode: 200,
                                                headers: {
                                                    Connection: 'close',
                                                    Date: 'NOW',
                                                    'Transfer-Encoding': 'chunked'
                                                },
                                                body: '3. /first',
                                                _mode: 'text'
                                            }
                                        }
                                    ]
                                },
                                {
                                    predicates: [
                                        {
                                            deepEquals: {
                                                path: '/second'
                                            }
                                        }
                                    ],
                                    responses: [
                                        {
                                            is: {
                                                statusCode: 200,
                                                headers: {
                                                    Connection: 'close',
                                                    Date: 'NOW',
                                                    'Transfer-Encoding': 'chunked'
                                                },
                                                body: '2. /second',
                                                _mode: 'text'
                                            }
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                });
            }).finally(() => api.del('/imposters'));
    });

    it('should support returning binary data from origin server based on content encoding', function () {
        const buffer = Buffer.from([0, 1, 2, 3]);
        const originServerPort = port + 1;
        const originServerResponse = {
            is: {
                body: buffer.toString('base64'),
                headers: { 'content-encoding': 'gzip' },
                _mode: 'binary'
            }
        };
        const originServerStub = { responses: [originServerResponse] };
        const originServerRequest = {
            protocol: 'http',
            port: originServerPort,
            stubs: [originServerStub],
            name: 'origin'
        };
        const proxyResponse = { proxy: { to: `http://localhost:${originServerPort}` } };
        const proxyStub = { responses: [proxyResponse] };
        const proxyRequest = { protocol: 'http', port, stubs: [proxyStub], name: 'proxy' };

        return api.post('/imposters', originServerRequest)
            .then(() => api.post('/imposters', proxyRequest))
            .then((response: any) => {
                expect(response.statusCode).toEqual(201);
                return client.responseFor({ method: 'GET', port, path: '/', mode: 'binary' });
            }).then((response: any) => {
                assert.deepEqual(response.body.toJSON().data, [0, 1, 2, 3]);
            }).finally(() => api.del('/imposters'));
    });

    it('should persist decorated proxy responses and only run decorator once', function () {
        const originServerPort = port + 1;
        const originServerStub = { responses: [{ is: { body: 'origin server' } }] };
        const originServerRequest = {
            protocol: 'http',
            port: originServerPort,
            stubs: [originServerStub],
            name: 'origin'
        };
        const decorator = (request: any, response: any) => {
            response.body += ' decorated';
        };
        const proxyStub = {
            responses: [{
                proxy: { to: `http://localhost:${originServerPort}` },
                _behaviors: { decorate: decorator.toString() }
            }]
        };
        const proxyRequest = { protocol: 'http', port, stubs: [proxyStub], name: 'proxy' };

        return api.post('/imposters', originServerRequest).then((response: any) => {
            expect(response.statusCode).toEqual(201);
            return api.post('/imposters', proxyRequest);
        }).then((response: any) => {
            expect(response.statusCode).toEqual(201);
            return client.get('/', port);
        }).then((response: any) => {
            expect(response.body).toEqual('origin server decorated');
            return api.get(`/imposters/${port}`);
        }).then((response: any) => {
            expect(response.body.stubs[0].responses[0].is.body).toEqual('origin server decorated');
        }).finally(() => api.del('/imposters'));
    });

    if (!airplaneMode) {
        it('should support http proxy to https server', function () {
            const proxyStub = { responses: [{ proxy: { to: 'https://google.com' } }] };
            const proxyRequest = { protocol: 'http', port, stubs: [proxyStub], name: 'proxy' };

            return api.post('/imposters', proxyRequest).then((response: any) => {
                expect(response.statusCode).toEqual(201);
                return client.get('/', port);
            }).then((response: any) => {
                //Sometimes 301, sometimes 302
                expect(response.statusCode.toString().substring(0, 2)).toEqual('30');

                //https://www.google.com.br in Brasil, google.ca in Canada, etc
                assert.ok(response.headers.location.indexOf('google.') >= 0, response.headers.location);
            }).finally(() => api.del('/imposters'));
        });

        it('should maintain case of headers from origin', function () {
            const proxyStub = { responses: [{ proxy: { to: 'http://google.com' } }] };
            const proxyRequest = { protocol: 'http', port, stubs: [proxyStub], name: 'proxy' };
            const isUpperCase = (header: any) => header[0] === header[0].toUpperCase();

            return api.post('/imposters', proxyRequest).then((response: any) => {
                expect(response.statusCode).toEqual(201);
                return client.get('/', port);
            }).then((response: any) => {
                for (let i = 0; i < response.rawHeaders.length; i += 2) {
                    assert.ok(isUpperCase(response.rawHeaders[i]), `${response.rawHeaders[i]} is not upper-case`);
                }
            }).finally(() => api.del('/imposters'));
        });

        it('should inject proxy headers if specified', function () {
            const proxyPort = port + 1;
            const mirrorPort = port + 2;

            const proxyStub = { responses: [{ proxy: { to: `http://localhost:${mirrorPort}`,
                injectHeaders: { 'X-Forwarded-Host': 'http://www.google.com', Host: 'colbert' } } }] };
            const proxyStubRequest = { protocol: 'http', port: proxyPort, stubs: [proxyStub], name: 'proxy stub' };
            const mirrorStub = { responses: [{ is: { body: '' }, _behaviors: {
                decorate: ((request: any, response: any) => { response.headers = request.headers; }).toString() } }] };
            const mirrorStubRequest = { protocol: 'http', port: mirrorPort, stubs: [mirrorStub], name: 'mirror stub' };

            return api.post('/imposters', mirrorStubRequest).then((response: any) => {
                assert.equal(201, response.statusCode);
                return api.post('/imposters', proxyStubRequest);
            }).then((response: any) => {
                assert.equal(201, response.statusCode);
                return client.get('/', proxyPort);
            }).then((response: any) => {
                assert.equal(response.headers['x-forwarded-host'], 'http://www.google.com');
                assert.equal(response.headers.host, 'colbert');
            }).finally(() => api.del('/imposters'));
        });
    }

    it('should not default to chunked encoding on proxied request (issue #132)', function () {
        const originServerPort = port + 1;
        const fn = (request: any, state: any, logger: any) => {
            function hasHeaderKey (headerKey: any, headers: any) {
                return Object.keys(headers).some(header => header.toLowerCase() === headerKey.toLowerCase());
            }

            let encoding = '';
            logger.warn(JSON.stringify(request.headers, null, 4));
            if (hasHeaderKey('Transfer-Encoding', request.headers)) {
                encoding = 'chunked';
            }
            else if (hasHeaderKey('Content-Length', request.headers)) {
                encoding = 'content-length';
            }
            return {
                body: `Encoding: ${encoding}`
            };
        };
        const originServerStub = { responses: [{ inject: fn.toString() }] };
        const originServerRequest = {
            protocol: 'http',
            port: originServerPort,
            stubs: [originServerStub],
            name: 'origin'
        };
        const proxyStub = {
            responses: [{
                proxy: {
                    to: `http://localhost:${originServerPort}`,
                    mode: 'proxyAlways',
                    predicateGenerators: [{
                        matches: {
                            method: true,
                            path: true,
                            query: true
                        }
                    }]
                }
            }]
        };
        const proxyRequest = { protocol: 'http', port, stubs: [proxyStub], name: 'proxy' };

        return api.post('/imposters', originServerRequest).then((response: any) => {
            expect(response.statusCode).toEqual(201);
            return api.post('/imposters', proxyRequest);
        }).then((response: any) => {
            expect(response.statusCode).toEqual(201);
            return client.responseFor({
                method: 'PUT',
                path: '/',
                port,
                body: 'TEST',
                headers: { 'Content-Length': 4 } //needed to bypass node's implicit chunked encoding
            });
        }).then((response: any) => {
            expect(response.body).toEqual('Encoding: content-length');
        }).finally(() => api.del('/imposters'));
    });

    it('should add decorate behaviors to newly created response', function () {
        const originServerPort = port + 1;
        const originServerStub = { responses: [{ is: { body: 'origin server' } }] };
        const originServerRequest = {
            protocol: 'http',
            port: originServerPort,
            stubs: [originServerStub],
            name: 'origin'
        };
        const decorator = (request: any, response: any) => {
            response.body += ' decorated';
        };
        const proxyStub = {
            responses: [{
                proxy: { to: `http://localhost:${originServerPort}`, addDecorateBehavior: decorator.toString() }
            }]
        };
        const proxyRequest = { protocol: 'http', port, stubs: [proxyStub], name: 'proxy' };

        return api.post('/imposters', originServerRequest).then((response: any) => {
            expect(response.statusCode).toEqual(201);
            return api.post('/imposters', proxyRequest);
        }).then((response: any) => {
            expect(response.statusCode).toEqual(201);
            return client.get('/', port);
        }).then((response: any) => {
            expect(response.body).toEqual('origin server');
            return client.get('/', port);
        }).then((response: any) => {
            expect(response.body).toEqual('origin server decorated');
        }).finally(() => api.del('/imposters'));
    });

    it('DELETE /imposters/:id/requests should delete proxy stubs but not other stubs', function () {
        const originServerPort = port + 1;
        const originServerStub = { responses: [{ is: { body: 'origin server' } }] };
        const originServerRequest = {
            protocol: 'http',
            port: originServerPort,
            stubs: [originServerStub],
            name: 'origin'
        };
        const firstStaticStub = {
            responses: [{ is: { body: 'first stub' } }],
            predicates: [{ equals: { body: 'fail match so we fall through to proxy' } }]
        };
        const proxyStub = { responses: [{ proxy: { to: `http://localhost:${originServerPort}`, mode: 'proxyAlways' } }] };
        const secondStaticStub = { responses: [{ is: { body: 'second stub' } }] };
        const proxyRequest = {
            protocol: 'http',
            port,
            stubs: [firstStaticStub, proxyStub, secondStaticStub],
            name: 'proxy'
        };

        return api.post('/imposters', originServerRequest)
            .then(() => api.post('/imposters', proxyRequest))
            .then((response: any) => {
                expect(response.statusCode).toEqual(201);
                return client.get('/', port);
            })
            .then((response: any) => {
                expect(response.body).toEqual('origin server');
                return api.del(`/imposters/${port}/requests`);
            })
            .then((response: any) => {
                expect(response.statusCode).toEqual(200);
                return api.get(`/imposters/${port}`);
            })
            .then((response: any) => {
                response.body.stubs.forEach((stub: any) => {
                    delete stub.matches;
                    delete stub._links;
                    //eslint-disable-next-line no-underscore-dangle
                    delete stub._uuid;
                });

                const sanitizedBody = sanitizeBody(response);
                assert.deepEqual(proxyRequest.stubs, sanitizedBody.stubs, JSON.stringify(response.body.stubs, null, 2));
            })
            .finally(() => api.del('/imposters'));
    });

    if (isInProcessImposter('http')) {
        it('should not add = at end of of query key missing = in original request (issue #410)', function () {
            const http = require('http');
            const Q = require('q');
            const originServerPort = port + 1;
            const originServer = http.createServer((request: any, response: any) => {
                //Uxe base http library rather than imposter to get raw url
                response.end(request.url);
            });

            originServer.listen(originServerPort);
            originServer.stop = () => {
                const deferred = Q.defer();
                originServer.close(() => {
                    deferred.resolve({});
                });
                return deferred.promise;
            };

            const proxyStub = { responses: [{ proxy: { to: `http://localhost:${originServerPort}`, mode: 'proxyAlways' } }] };
            const proxyRequest = { protocol: 'http', port, stubs: [proxyStub], name: 'proxy' };

            return api.post('/imposters', proxyRequest).then((response: any) => {
                expect(response.statusCode).toEqual(201);
                return client.get('/path?WSDL', port);
            }).then((response: any) => {
                expect(response.body).toEqual('/path?WSDL');
                return client.get('/path?WSDL=', port);
            }).then((response: any) => {
                expect(response.body).toEqual('/path?WSDL=');
            }).finally(() => originServer.stop().then(() => api.del('/imposters')));
        });
    }
});
