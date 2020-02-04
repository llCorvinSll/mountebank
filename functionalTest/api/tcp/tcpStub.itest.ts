

import { ApiClient } from '../api';

const tcp = require('./tcpClient');
const airplaneMode = process.env.MB_AIRPLANE_MODE === 'true';

describe('tcp imposter', function () {
    let api: any;
    let port: number;

    beforeEach(() => {
        api = new ApiClient();
        port = api.port + 1;
    });

    describe('POST /imposters with stubs', function () {
        it('should return stubbed response', function () {
            const stub = {
                predicates: [{ equals: { data: 'client' } }],
                responses: [{ is: { data: 'server' } }]
            };
            const request = { protocol: 'tcp', port, stubs: [stub], mode: 'text' };

            return api.post('/imposters', request).then((response: any) => {
                expect(response.statusCode).toEqual(201);

                return tcp.send('client', port);
            }).then((response: any) => {
                expect(response.toString()).toEqual('server');
            }).finally(() => api.del('/imposters'));
        });

        it('should allow binary stub responses', function () {
            const buffer = Buffer.from([0, 1, 2, 3]);
            const stub = { responses: [{ is: { data: buffer.toString('base64') } }] };
            const request = { protocol: 'tcp', port, stubs: [stub], mode: 'binary' };

            return api.post('/imposters', request).then((response: any) => {
                expect(response.statusCode).toEqual(201);

                return tcp.send('0', port);
            }).then((response: any) => {
                expect(Buffer.isBuffer(response)).toBeTruthy();
                expect(response.toJSON().data).toEqual([0, 1, 2, 3]);
            }).finally(() => api.del('/imposters'));
        });

        it('should allow a sequence of stubs as a circular buffer', function () {
            const stub = {
                predicates: [{ equals: { data: 'request' } }],
                responses: [{ is: { data: 'first' } }, { is: { data: 'second' } }]
            };
            const request = { protocol: 'tcp', port, stubs: [stub] };

            return api.post('/imposters', request)
                .then(() => tcp.send('request', port))
                .then((response: any) => {
                    expect(response.toString()).toEqual('first');
                    return tcp.send('request', port);
                })
                .then((response: any) => {
                    expect(response.toString()).toEqual('second');
                    return tcp.send('request', port);
                })
                .then((response: any) => {
                    expect(response.toString()).toEqual('first');
                    return tcp.send('request', port);
                })
                .then((response: any) => {
                    expect(response.toString()).toEqual('second');
                })
                .finally(() => api.del('/imposters'));
        });

        it('should only return stubbed response if matches complex predicate', function () {
            const stub = {
                responses: [{ is: { data: 'MATCH' } }],
                predicates: [
                    { equals: { data: 'test' } },
                    { startsWith: { data: 'te' } }
                ]
            };
            const request = { protocol: 'tcp', port, stubs: [stub] };

            return api.post('/imposters', request).then((response: any) => {
                expect(response.statusCode).toEqual(201);
                return tcp.send('not test', port, 100);
            }).then((response: any) => {
                expect(response.toString()).toEqual('');

                return tcp.send('test', port, 100);
            }).then((response: any) => {
                expect(response.toString()).toEqual('MATCH');
            }).finally(() => api.del('/imposters'));
        });

        it('should return 400 if uses matches predicate with binary mode', function () {
            const stub = {
                responses: [{ is: { data: 'dGVzdA==' } }],
                predicates: [{ matches: { data: 'dGVzdA==' } }]
            };
            const request = { protocol: 'tcp', port, mode: 'binary', stubs: [stub] };

            return api.post('/imposters', request).then((response: any) => {
                expect(response.statusCode).toEqual(400);
                expect(response.body.errors[0].data).toEqual('the matches predicate is not allowed in binary mode');
            }).finally(() => api.del('/imposters'));
        });

        it('should allow proxy stubs', function () {
            const proxyPort = port + 1;
            const proxyStub = { responses: [{ is: { data: 'PROXIED' } }] };
            const proxyRequest = { protocol: 'tcp', port: proxyPort, stubs: [proxyStub], name: 'PROXY' };
            const stub = { responses: [{ proxy: { to: `tcp://localhost:${proxyPort}` } }] };
            const request = { protocol: 'tcp', port, stubs: [stub], name: 'MAIN' };

            return api.post('/imposters', proxyRequest)
                .then(() => api.post('/imposters', request))
                .then(() => tcp.send('request', port))
                .then((response: any) => {
                    expect(response.toString()).toEqual('PROXIED');
                }).finally(() => api.del('/imposters'));
        });

        it('should support old proxy syntax for backwards compatibility', function () {
            const proxyPort = port + 1;
            const proxyStub = { responses: [{ is: { data: 'PROXIED' } }] };
            const proxyRequest = { protocol: 'tcp', port: proxyPort, stubs: [proxyStub], name: 'PROXY' };
            const stub = { responses: [{ proxy: { to: { host: 'localhost', port: proxyPort } } }] };
            const request = { protocol: 'tcp', port, stubs: [stub], name: 'MAIN' };

            return api.post('/imposters', proxyRequest)
                .then(() => api.post('/imposters', request))
                .then(() => tcp.send('request', port))
                .then((response: any) => {
                    expect(response.toString()).toEqual('PROXIED');
                }).finally(() => api.del('/imposters'));
        });

        if (!airplaneMode) {
            it('should allow proxy stubs to invalid hosts', function () {
                const stub = { responses: [{ proxy: { to: 'tcp://remotehost:8000' } }] };
                const request = { protocol: 'tcp', port, stubs: [stub] };

                return api.post('/imposters', request)
                    .then(() => tcp.send('request', port))
                    .then((response: any) => {
                        const error = JSON.parse(response).errors[0];
                        expect(error.code).toEqual('invalid proxy');
                        expect(error.message).toEqual('Cannot resolve "tcp://remotehost:8000"');
                    })
                    .finally(() => api.del('/imposters'));
            });
        }

        it('should split each packet into a separate request by default', function () {
            // max 64k packet size, likely to hit max on the loopback interface
            const largeRequest = `${new Array(65537).join('1')}2`;
            const stub = { responses: [{ is: { data: 'success' } }] };
            const request = {
                protocol: 'tcp',
                port,
                stubs: [stub],
                mode: 'text'
            };

            return api.post('/imposters', request)
                .then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return tcp.send(largeRequest, port);
                })
                .then(() => api.get(`/imposters/${port}`))
                .then((response: any) => {
                    const requests = response.body.requests;
                    const dataLength = requests.reduce((sum: any, recordedRequest: any) => sum + recordedRequest.data.length, 0);
                    expect(requests.length > 1).toBeTruthy();
                    expect(65537).toEqual(dataLength);
                })
                .finally(() => api.del('/imposters'));
        });

        it('should support changing default response for stub', function () {
            const stub = {
                responses: [{ is: { data: 'Given response' } }],
                predicates: [{ equals: { data: 'MATCH ME' } }]
            };
            const request = {
                protocol: 'tcp',
                mode: 'text',
                port,
                defaultResponse: { data: 'Default response' },
                stubs: [stub]
            };

            return api.post('/imposters', request).then((response: any) => {
                expect(response.statusCode).toEqual(201);
                return tcp.send('MATCH ME', port);
            }).then((response: any) => {
                expect('Given response').toEqual(response.toString());
                return tcp.send('NO MATCH', port);
            }).then((response: any) => {
                expect('Default response').toEqual(response.toString());
            }).finally(() => api.del('/imposters'));
        });
    });
});
