

import {ApiClient} from "../api";

const assert = require('assert');
const HttpProxy = require('../../../src/models/http/httpProxy');
// const api = require('../api').create();
// const port = api.port + 1;
// const timeout = parseInt(process.env.MB_SLOW_TEST_TIMEOUT || 3000);
const airplaneMode = process.env.MB_AIRPLANE_MODE === 'true';

describe('http proxy', function () {
    // this.timeout(timeout);
    let api: any;
    let port: number;

    beforeEach(() => {
        api = new ApiClient();
        port = api.port + 1;
    })

    const noOp = () => {},
        logger = { debug: noOp, info: noOp, warn: noOp, error: noOp },
        proxy = HttpProxy.create(logger);

    describe('#to', function () {
        it('should send same request information to proxied url', function () {
            const proxyRequest = { protocol: 'http', port },
                request = { path: '/PATH', method: 'POST', body: 'BODY', headers: { 'X-Key': 'TRUE' } };

            return api.post('/imposters', proxyRequest)
                .then(() => proxy.to(`http://localhost:${port}`, request, {}))
                .then((response: any) => {
                    expect(response.statusCode).toEqual(200);
                    return api.get(`/imposters/${port}`);
                })
                .then((response: any) => {
                    const requests = response.body.requests;
                    expect(requests.length).toEqual(1);
                    expect(requests[0].path).toEqual('/PATH');
                    expect(requests[0].method).toEqual('POST');
                    expect(requests[0].body).toEqual('BODY');
                    expect(requests[0].headers['X-Key']).toEqual('TRUE');
                })
                .finally(() => api.del('/imposters'));
        });

        it('should return proxied result', function () {
            const stub = { responses: [{ is: { statusCode: 400, body: 'ERROR' } }] },
                request = { protocol: 'http', port, stubs: [stub] };

            return api.post('/imposters', request).then((response: any) => {
                expect(response.statusCode).toEqual(201);

                return proxy.to(`http://localhost:${port}`, { path: '/', method: 'GET', headers: {} }, {});
            }).then((response: any) => {
                expect(response.statusCode).toEqual(400);
                expect(response.body).toEqual('ERROR');
            }).finally(() => api.del('/imposters'));
        });

        it('should proxy to https', function () {
            const stub = { responses: [{ is: { statusCode: 400, body: 'ERROR' } }] },
                request = { protocol: 'https', port, stubs: [stub] };

            return api.post('/imposters', request).then((response: any) => {
                expect(response.statusCode).toEqual(201);

                return proxy.to(`https://localhost:${port}`, { path: '/', method: 'GET', headers: {} }, {});
            }).then((response: any) => {
                expect(response.statusCode).toEqual(400);
                expect(response.body).toEqual('ERROR');
            }).finally(() => api.del('/imposters'));
        });

        it('should update the host header to the origin server', function () {
            const stub = {
                    responses: [{ is: { statusCode: 400, body: 'ERROR' } }],
                    predicates: [{ equals: { headers: { host: `localhost:${port}` } } }]
                },
                request = { protocol: 'http', port, stubs: [stub] };

            return api.post('/imposters', request).then((response: any) => {
                expect(response.statusCode).toEqual(201);

                return proxy.to(`http://localhost:${port}`, { path: '/', method: 'GET', headers: { host: 'www.mbtest.org' } }, {});
            }).then((response: any) => {
                expect(response.statusCode).toEqual(400);
                expect(response.body).toEqual('ERROR');
            }).finally(() => api.del('/imposters'));
        });

        if (!airplaneMode) {
            it('should gracefully deal with DNS errors', function () {
                return proxy.to('http://no.such.domain', { path: '/', method: 'GET', headers: {} }, {}).then(() => {
                    assert.fail('should not have resolved promise');
                }, (reason: any) => {
                    expect(reason).toEqual({
                        code: 'invalid proxy',
                        message: 'Cannot resolve "http://no.such.domain"'
                    });
                });
            });

            it('should gracefully deal with bad urls', function () {
                return proxy.to('1 + 2', { path: '/', method: 'GET', headers: {} }, {}).then(() => {
                    assert.fail('should not have resolved promise');
                }, (reason: any) => {
                    expect(reason).toEqual({
                        code: 'invalid proxy',
                        message: 'Unable to connect to "1 + 2"'
                    });
                });
            });
        }


        ['application/octet-stream', 'audio/mpeg', 'audio/mp4', 'image/gif', 'image/jpeg', 'video/avi', 'video/mpeg'].forEach(mimeType => {
            it(`should base64 encode ${mimeType} responses`, function () {
                const buffer = Buffer.from([0, 1, 2, 3]),
                    stub = {
                        responses: [{
                            is: {
                                body: buffer.toString('base64'),
                                headers: { 'content-type': mimeType },
                                _mode: 'binary'
                            }
                        }]
                    },
                    request = { protocol: 'http', port, stubs: [stub] };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);

                    return proxy.to(`http://localhost:${port}`, { path: '/', method: 'GET', headers: {} }, {});
                }).then((response: any) => {
                    expect(response.body).toEqual(buffer.toString('base64'));
                    expect(response._mode).toEqual('binary');
                }).finally(() => api.del('/imposters'));
            });
        });

        if (!airplaneMode) {
            it('should proxy to different host', function () {
                return proxy.to('https://google.com', { path: '/', method: 'GET', headers: {} }, {}).then((response: any) => {
                    // sometimes 301, sometimes 302
                    expect(response.statusCode.toString().substring(0, 2)).toEqual('30');

                    // https://www.google.com.br in Brasil, google.ca in Canada, etc
                    expect(response.headers.Location.indexOf('google.') >= 0).toBeTruthy();
                });
            });
        }
    });
});
