

import { ApiClient } from '../api';
const tcp = require('./tcpClient');
const sanitizeBody = require('../../testUtils/sanitize').sanitizeBody;


describe('tcp imposter', function () {
    let api: any;
    let port: number;

    beforeEach(() => {
        api = new ApiClient();
        port = api.port + 1;
    });

    describe('POST /imposters/:id', function () {
        it('should auto-assign port if port not provided', function () {
            const request = { protocol: 'tcp' };

            return api.post('/imposters', request).then((response: any) => {
                expect(response.statusCode).toEqual(201);
                expect(response.body.port > 0).toBeTruthy();
            }).finally(() => api.del('/imposters'));
        });
    });

    describe('GET /imposters/:id', function () {
        it('should provide access to all requests', function () {
            const request = { protocol: 'tcp', port };

            return api.post('/imposters', request)
                .then(() => tcp.fireAndForget('first', port))
                .then(() => tcp.fireAndForget('second', port))
                .then(() => api.get(`/imposters/${port}`))
                .then((response: any) => {
                    const requests = response.body.requests.map((recordedRequest: any) => recordedRequest.data);
                    expect(requests).toEqual(['first', 'second']);
                })
                .finally(() => api.del('/imposters'));
        });

        it('should return list of stubs in order', function () {
            const first = { responses: [{ is: { data: '1' } }] };
            const second = { responses: [{ is: { data: '2' } }] };
            const request = { protocol: 'tcp', port, stubs: [first, second] };

            return api.post('/imposters', request)
                .then(() => api.get(`/imposters/${port}`))
                .then((response: any) => {
                    const sanitizedBody = sanitizeBody(response);
                    expect(response.statusCode).toEqual(200);
                    expect(sanitizedBody.stubs).toEqual([
                        {
                            _uuid: '696969696969',
                            responses: [{ is: { data: '1' } }],
                            _links: { self: { href: `${api.url}/imposters/${port}/stubs/0` } }
                        },
                        {
                            _uuid: '696969696969',
                            responses: [{ is: { data: '2' } }],
                            _links: { self: { href: `${api.url}/imposters/${port}/stubs/1` } }
                        }
                    ]);
                })
                .finally(() => api.del('/imposters'));
        });

        it('should reflect default mode', function () {
            const request = { protocol: 'tcp', port, name: 'imposter' };

            return api.post('/imposters', request)
                .then(() => api.get(`/imposters/${port}`))
                .then((response: any) => {
                    expect(response.statusCode).toEqual(200);
                    expect(response.body).toEqual({
                        protocol: 'tcp',
                        port,
                        recordRequests: false,
                        numberOfRequests: 0,
                        mode: 'text',
                        name: request.name,
                        requests: [],
                        stubs: [],
                        _links: {
                            self: { href: `${api.url}/imposters/${port}` },
                            stubs: { href: `${api.url}/imposters/${port}/stubs` }
                        }
                    });
                })
                .finally(() => api.del('/imposters'));
        });

        it('should record matches against stubs', function () {
            const stub = { responses: [{ is: { data: '1' } }, { is: { data: '2' } }] };
            const request = { protocol: 'tcp', port, stubs: [stub] };

            return api.post('/imposters', request)
                .then(() => tcp.send('first', port))
                .then(() => tcp.send('second', port))
                .then(() => api.get(`/imposters/${port}`))
                .then((response: any) => {
                    const sanitizedBody = sanitizeBody(response);

                    expect(sanitizedBody.stubs).toEqual([{
                        _uuid: '696969696969',
                        responses: [{ is: { data: '1' } }, { is: { data: '2' } }],
                        matches: [
                            {
                                timestamp: 'NOW',
                                request: { requestFrom: 'HERE', data: 'first', ip: '::ffff:127.0.0.1' },
                                response: { data: '1' }
                            },
                            {
                                timestamp: 'NOW',
                                request: { requestFrom: 'HERE', data: 'second', ip: '::ffff:127.0.0.1' },
                                response: { data: '2' }
                            }
                        ],
                        _links: { self: { href: `${api.url}/imposters/${port}/stubs/0` } }
                    }]);
                })
                .finally(() => api.del('/imposters'));
        });
    });
});
