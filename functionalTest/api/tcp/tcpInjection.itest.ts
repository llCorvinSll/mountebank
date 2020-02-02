'use strict';

import {ApiClient} from "../api";
const tcp = require('./tcpClient');

describe('tcp imposter', function () {
    let api: any;
    let port: number;

    beforeEach(() => {
        api = new ApiClient();
        port = api.port + 1;
    })

    describe('POST /imposters with injections', function () {
        it('should allow javascript predicate for matching (old interface)', function () {
            const fn = (request: any) => request.data.toString() === 'test',
                stub = {
                    predicates: [{ inject: fn.toString() }],
                    responses: [{ is: { data: 'MATCHED' } }]
                };

            return api.post('/imposters', { protocol: 'tcp', port, stubs: [stub] }).then((response: any) => {
                expect(response.statusCode).toEqual(201);

                return tcp.send('test', port);
            }).then((response: any) => {
                expect(response.toString()).toEqual('MATCHED');
            }).finally(() => api.del('/imposters'));
        });

        it('should allow javascript predicate for matching', function () {
            const fn = (config: any) => config.request.data.toString() === 'test',
                stub = {
                    predicates: [{ inject: fn.toString() }],
                    responses: [{ is: { data: 'MATCHED' } }]
                };

            return api.post('/imposters', { protocol: 'tcp', port, stubs: [stub] }).then((response: any) => {
                expect(response.statusCode).toEqual(201);

                return tcp.send('test', port);
            }).then((response: any) => {
                expect(response.toString()).toEqual('MATCHED');
            }).finally(() => api.del('/imposters'));
        });

        it('should allow synchronous javascript injection for responses (old interface)', function () {
            const fn = (request: any) => ({ data: `${request.data} INJECTED` }),
                stub = { responses: [{ inject: fn.toString() }] },
                request = { protocol: 'tcp', port, stubs: [stub] };

            return api.post('/imposters', request)
                .then(() => tcp.send('request', port))
                .then((response: any) => {
                    expect(response.toString()).toEqual('request INJECTED');
                })
                .finally(() => api.del('/imposters'));
        });

        it('should allow synchronous javascript injection for responses', function () {
            const fn = (config: any) => ({ data: `${config.request.data} INJECTED` }),
                stub = { responses: [{ inject: fn.toString() }] },
                request = { protocol: 'tcp', port, stubs: [stub] };

            return api.post('/imposters', request)
                .then(() => tcp.send('request', port))
                .then((response: any) => {
                    expect(response.toString()).toEqual('request INJECTED');
                })
                .finally(() => api.del('/imposters'));
        });

        it('should allow javascript injection to keep state between requests (old interface)', function () {
            const fn = (request: any, state: any) => {
                    if (!state.calls) { state.calls = 0; }
                    state.calls += 1;
                    return { data: state.calls.toString() };
                },
                stub = { responses: [{ inject: fn.toString() }] },
                request = { protocol: 'tcp', port, stubs: [stub] };

            return api.post('/imposters', request).then((response: any) => {
                expect(response.statusCode).toEqual(201);

                return tcp.send('request', port);
            }).then((response: any) => {
                expect(response.toString()).toEqual('1');

                return tcp.send('request', port);
            }).then((response: any) => {
                expect(response.toString()).toEqual('2');
            }).finally(() => api.del('/imposters'));
        });

        it('should allow javascript injection to keep state between requests', function () {
            const fn = (config: any) => {
                    if (!config.state.calls) { config.state.calls = 0; }
                    config.state.calls += 1;
                    return { data: config.state.calls.toString() };
                },
                stub = { responses: [{ inject: fn.toString() }] },
                request = { protocol: 'tcp', port, stubs: [stub] };

            return api.post('/imposters', request).then((response: any) => {
                expect(response.statusCode).toEqual(201);

                return tcp.send('request', port);
            }).then((response: any) => {
                expect(response.toString()).toEqual('1');

                return tcp.send('request', port);
            }).then((response: any) => {
                expect(response.toString()).toEqual('2');
            }).finally(() => api.del('/imposters'));
        });

        it('should allow asynchronous injection (old interface)', function () {
            const originServerPort = port + 1,
                originServerStub = { responses: [{ is: { body: 'origin server' } }] },
                originServerRequest = {
                    protocol: 'http',
                    port: originServerPort,
                    stubs: [originServerStub],
                    name: 'origin'
                },
                fn = (request: any, state: any, logger: any, callback: any) => {
                    const net = require('net'),
                        options = {
                            host: '127.0.0.1',
                            port: '$PORT'
                        },
                        socket = net.connect(options, () => {
                            socket.write(`${request.data}\n`);
                        });
                    socket.once('data', (data: any) => {
                        callback({ data: data });
                    });
                    // No return value!!!
                },
                stub = { responses: [{ inject: fn.toString().replace("'$PORT'", `${originServerPort}`) }] };

            return api.post('/imposters', originServerRequest).then((response: any) => {
                expect(response.statusCode).toEqual(201);
                return api.post('/imposters', { protocol: 'tcp', port, stubs: [stub] });
            }).then((response: any) => {
                expect(response.statusCode).toEqual(201);
                return tcp.send('GET / HTTP/1.1\r\nHost: www.google.com\r\n\r', port);
            }).then((response: any) => {
                expect(response.toString().indexOf('HTTP/1.1')).toEqual(0);
            }).finally(() => api.del('/imposters'));
        });

        it('should allow asynchronous injection', function () {
            const originServerPort = port + 1;
            const originServerStub = {responses: [{is: {body: 'origin server'}}]};
            const originServerRequest = {
                protocol: 'http',
                port: originServerPort,
                stubs: [originServerStub],
                name: 'origin'
            };
            const fn = (config:any) => {
                const net = require('net'),
                    options = {
                        host: '127.0.0.1',
                        port: '$PORT'
                    },
                    socket = net.connect(options, () => {
                        socket.write(`${config.request.data}\n`);
                    });
                socket.once('data', (data:any) => {
                    config.callback({data: data});
                });
                // No return value!!!
            };
            const stub = {responses: [{inject: fn.toString().replace("'$PORT'", `${originServerPort}`)}]};

            return api.post('/imposters', originServerRequest).then((response: any) => {
                expect(response.statusCode).toEqual(201);
                return api.post('/imposters', { protocol: 'tcp', port, stubs: [stub] });
            }).then((response: any) => {
                expect(response.statusCode).toEqual(201);
                return tcp.send('GET / HTTP/1.1\r\nHost: www.google.com\r\n\r', port);
            }).then((response: any) => {
                expect(response.toString().indexOf('HTTP/1.1')).toEqual(0);
            }).finally(() => api.del('/imposters'));
        });

        it('should allow binary requests extending beyond a single packet using endOfRequestResolver', function () {
            // We'll simulate a protocol that has a 4 byte message length at byte 0 indicating how many bytes follow
            const getRequest = (length:any) => {
                const buffer = Buffer.alloc(length + 4);
                buffer.writeUInt32LE(length, 0);

                for (let i = 0; i < length; i += 1) {
                    buffer.writeInt8(0, i + 4);
                }
                return buffer;
            };
            const largeRequest = getRequest(100000);
            const responseBuffer = Buffer.from([0, 1, 2, 3]);
            const stub = {responses: [{is: {data: responseBuffer.toString('base64')}}]};
            const resolver = (requestData: any) => {
                const messageLength = requestData.readUInt32LE(0);
                return requestData.length === messageLength + 4;
            };
            const request = {
                protocol: 'tcp',
                port,
                stubs: [stub],
                mode: 'binary',
                endOfRequestResolver: {inject: resolver.toString()}
            };

            return api.post('/imposters', request)
                .then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return tcp.send(largeRequest, port);
                })
                .then(() => api.get(`/imposters/${port}`))
                .then((response: any) => {
                    expect(response.body.requests.length).toEqual(1);
                    expect(response.body.requests[0].data).toEqual(largeRequest.toString('base64'));
                })
                .finally(() => api.del('/imposters'));
        });

        it('should allow text requests extending beyond a single packet using endOfRequestResolver', function () {
            // We'll simulate HTTP
            // The last 'x' is added because new Array(5).join('x') creates 'xxxx' in JavaScript...
            const largeRequest = `Content-Length: 100000\n\n${new Array(100000).join('x')}x`;
            const stub = {responses: [{is: {data: 'success'}}]};
            const resolver = (requestData:any) => {
                const bodyLength = parseInt(/Content-Length: (\d+)/.exec(requestData)![1]);
                const body = /\n\n(.*)/.exec(requestData)![1];

                return body.length === bodyLength;
            };
            const request = {
                protocol: 'tcp',
                port,
                stubs: [stub],
                mode: 'text',
                endOfRequestResolver: {inject: resolver.toString()}
            };

            return api.post('/imposters', request)
                .then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return tcp.send(largeRequest, port);
                })
                .then(() => api.get(`/imposters/${port}`))
                .then((response: any) => {
                    expect(response.body.requests.length).toEqual(1);
                    expect(response.body.requests[0].data).toEqual(largeRequest);
                })
                .finally(() => api.del('/imposters'));
        });
    });
});
