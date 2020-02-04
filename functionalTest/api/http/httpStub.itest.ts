

import { ApiClient } from '../api';

const BaseHttpClient = require('./baseHttpClient');
const sanitizeBody = require('../../testUtils/sanitize').sanitizeBody;
const helpers = require('../../../src/util/helpers');

['http', 'https'].forEach(protocol => {
    const client = BaseHttpClient.create(protocol);
    let api: any;
    let port: number;
    beforeEach(() => {
        api = new ApiClient();
        port = api.port + 1;
    });

    describe(`${protocol} imposter`, function () {

        describe('POST /imposters with stubs', function () {
            it('should return stubbed response', function () {
                const stub = {
                    responses: [{
                        is: {
                            statusCode: 400,
                            headers: { 'X-Test': 'test header' },
                            body: 'test body',
                            query: {
                                key: true
                            }
                        }
                    }]
                };
                const request = { protocol, port, stubs: [stub] };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);

                    return client.get('/test?key=true', port);
                }).then((response: any) => {
                    expect(response.statusCode).toEqual(400);
                    expect(response.body).toEqual('test body');
                    expect(response.headers['x-test']).toEqual('test header');
                }).finally(() => api.del('/imposters'));
            });

            it('should allow a sequence of stubs as a circular buffer', function () {
                const stub = { responses: [{ is: { statusCode: 400 } }, { is: { statusCode: 405 } }] };
                const request = { protocol, port, stubs: [stub] };

                return api.post('/imposters', request)
                    .then(() => client.get('/test', port))
                    .then((response: any) => {
                        expect(response.statusCode).toEqual(400);
                        return client.get('/test', port);
                    })
                    .then((response: any) => {
                        expect(response.statusCode).toEqual(405);
                        return client.get('/test', port);
                    })
                    .then((response: any) => {
                        expect(response.statusCode).toEqual(400);
                        return client.get('/test', port);
                    })
                    .then((response: any) => {
                        expect(response.statusCode).toEqual(405);
                    })
                    .finally(() => api.del('/imposters'));
            });

            it('should only return stubbed response if matches complex predicate', function () {
                const spec = {
                    path: '/test?key=value&next=true',
                    port,
                    method: 'POST',
                    headers: {
                        'X-One': 'Test',
                        'X-Two': 'Test',
                        'Content-Type': 'text/plain'
                    }
                };
                const stub = {
                    responses: [{ is: { statusCode: 400 } }],
                    predicates: [
                        { equals: { path: '/test', method: 'POST' } },
                        { equals: { query: { key: 'value' } } },
                        { exists: { headers: { 'X-One': true } } },
                        { exists: { headers: { 'X-Two': true } } },
                        { equals: { headers: { 'X-Two': 'Test' } } },
                        { exists: { headers: { 'X-Three': false } } },
                        { not: { exists: { headers: { 'X-Four': true } } } },
                        { startsWith: { body: 'T' } },
                        { contains: { body: 'ES' } },
                        { endsWith: { body: 'T' } },
                        { matches: { body: '^TEST$' } },
                        { equals: { body: 'TEST' } },
                        { exists: { body: true } }
                    ]
                };
                const request = { protocol, port, stubs: [stub] };

                return api.post('/imposters', request).then(() => {
                    const options = helpers.merge(spec, { path: '/', body: 'TEST' });
                    return client.responseFor(options);
                }).then((response: any) => {
                    expect(response.statusCode).toEqual(200);

                    const options = helpers.merge(spec, { path: '/test?key=different', body: 'TEST' });
                    return client.responseFor(options);
                }).then((response: any) => {
                    expect(response.statusCode).toEqual(200);

                    const options = helpers.merge(spec, { method: 'PUT', body: 'TEST' });
                    return client.responseFor(options);
                }).then((response: any) => {
                    expect(response.statusCode).toEqual(200);

                    const options = helpers.merge(spec, { body: 'TEST' });
                    delete options.headers['X-One'];
                    return client.responseFor(options);
                }).then((response: any) => {
                    expect(response.statusCode).toEqual(200);

                    const options = helpers.merge(spec, { headers: { 'X-Two': 'Testing', body: 'TEST' } });
                    return client.responseFor(options);
                }).then((response: any) => {
                    expect(response.statusCode).toEqual(200);

                    return client.responseFor(helpers.merge(spec, { body: 'TESTing' }));
                }).then((response: any) => {
                    expect(response.statusCode).toEqual(200);

                    return client.responseFor(helpers.merge(spec, { body: 'TEST' }));
                }).then((response: any) => {
                    expect(response.statusCode).toEqual(400);
                }).finally(() => api.del('/imposters'));
            });

            it('should correctly handle deepEquals object predicates', function () {
                const stubWithEmptyObjectPredicate = {
                    responses: [{ is: { body: 'first stub' } }],
                    predicates: [{ deepEquals: { query: {} } }]
                };
                const stubWithPredicateKeywordInObject = {
                    responses: [{ is: { body: 'second stub' } }],
                    predicates: [{ deepEquals: { query: { equals: 1 } } }]
                };
                const stubWithTwoKeywordsInObject = {
                    responses: [{ is: { body: 'third stub' } }],
                    predicates: [{ deepEquals: { query: { equals: 'true', contains: false } } }]
                };
                const stubs = [stubWithEmptyObjectPredicate, stubWithPredicateKeywordInObject, stubWithTwoKeywordsInObject];
                const request = { protocol, port, stubs: stubs };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.get('/', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('first stub');
                    return client.get('/?equals=something', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('');
                    return client.get('/?equals=1', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('second stub');
                    return client.get('/?contains=false&equals=true', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('third stub');
                    return client.get('/?contains=false&equals=true&matches=yes', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('');
                }).finally(() => api.del('/imposters'));
            });

            it('should support sending binary response', function () {
                const buffer = Buffer.from([0, 1, 2, 3]);
                const stub = { responses: [{ is: { body: buffer.toString('base64'), _mode: 'binary' } }] };
                const request = { protocol, port, stubs: [stub] };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.responseFor({ method: 'GET', port, path: '/', mode: 'binary' });
                }).then((response: any) => {
                    expect(response.body.toJSON().data).toEqual([0, 1, 2, 3]);
                }).finally(() => api.del('/imposters'));
            });

            it('should support JSON bodies', function () {
                const stub = {
                    responses: [
                        {
                            is: {
                                body: {
                                    key: 'value',
                                    sub: {
                                        'string-key': 'value'
                                    },
                                    arr: [1, 2]
                                }
                            }
                        },
                        {
                            is: {
                                body: {
                                    key: 'second request'
                                }
                            }
                        }
                    ]
                };
                const request = { protocol, port, stubs: [stub] };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);

                    return client.get('/', port);
                }).then((response: any) => {
                    expect(JSON.parse(response.body)).toEqual({
                        key: 'value',
                        sub: {
                            'string-key': 'value'
                        },
                        arr: [1, 2]
                    });
                    return client.get('/', port);
                }).then((response: any) => {
                    expect(JSON.parse(response.body)).toEqual({ key: 'second request' });
                }).finally(() => api.del('/imposters'));
            });

            it('should support treating the body as a JSON object for predicate matching', function () {
                const stub = {
                    responses: [{ is: { body: 'SUCCESS' } }],
                    predicates: [
                        { equals: { body: { key: 'value' } } },
                        { equals: { body: { arr: 3 } } },
                        { deepEquals: { body: { key: 'value', arr: [2, 1, 3] } } },
                        { matches: { body: { key: '^v' } } }
                    ]
                };
                const request = { protocol, port, stubs: [stub] };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.post('/', '{"key": "value", "arr": [3,2,1]}', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('SUCCESS');
                }).finally(() => api.del('/imposters'));
            });

            it('should support changing default response for stub', function () {
                const stub = {
                    responses: [
                        { is: { body: 'Wrong address' } },
                        { is: { statusCode: 500 } }
                    ],
                    predicates: [{ equals: { path: '/' } }]
                };
                const defaultResponse = { statusCode: 404, body: 'Not found' };
                const request = { protocol, port, defaultResponse: defaultResponse, stubs: [stub] };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.get('/', port);
                }).then((response: any) => {
                    expect(404).toEqual(response.statusCode);
                    expect('Wrong address').toEqual(response.body);
                    return client.get('/', port);
                }).then((response: any) => {
                    expect(500).toEqual(response.statusCode);
                    expect('Not found').toEqual(response.body);
                    return client.get('/differentStub', port);
                }).then((response: any) => {
                    expect(404).toEqual(response.statusCode);
                    expect('Not found').toEqual(response.body);
                }).finally(() => api.del('/imposters'));
            });

            it('should support keepalive connections', function () {
                const stub = { responses: [{ is: { body: 'Success' } }] };
                const defaultResponse = { headers: { CONNECTION: 'Keep-Alive' } }; // tests case-sensitivity of header match
                const request = { protocol, port, defaultResponse: defaultResponse, stubs: [stub] };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.get('/', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('Success');
                    expect(response.headers.connection).toEqual('Keep-Alive');
                }).finally(() => api.del('/imposters'));
            });

            it('should support sending multiple values back for same header', function () {
                const stub = { responses: [{ is: { headers: { 'Set-Cookie': ['first', 'second'] } } }] };
                const request = { protocol, port, stubs: [stub] };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.get('/', port);
                }).then((response: any) => {
                    expect(response.headers['set-cookie']).toEqual(['first', 'second']);
                }).finally(() => api.del('/imposters'));
            });

            it('should support sending JSON bodies with _links field for canned responses', function () {
                const stub = { responses: [{ is: {
                    headers: { 'Content-Type': 'application/json' },
                    body: { _links: { self: { href: '/products/123' } } }
                } }] };
                const request = { protocol, port, stubs: [stub] };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.get('/', port);
                }).then((response: any) => {
                    expect(response.body).toEqual({ _links: { self: { href: '/products/123' } } });
                }).finally(() => api.del('/imposters'));
            });

            it('should correctly set content-length for binary data', function () {
                // https://github.com/bbyars/mountebank/issues/204
                const stub = {
                    responses: [{
                        is: {
                            headers: { 'Content-Length': 852 },
                            body: 'H4sIAAAAAAAEAO29B2AcSZYlJi9tynt/SvVK1+B0oQiAYBMk2JBAEOzBiM3mkuwdaUcjKasqgcplVmVdZhZAzO2dvPfee++999577733ujudTif33/8/XGZkAWz2zkrayZ4hgKrIHz9+fB8/In7xR8Xso0cfzab3p/vn053t/NPZbHt/cn5/++D+5N72pwefTnd2JtP8/CD7aPRR02btuqH2zXo6zZuGPpplbfbRo1/80arMlviZXWZFmU2Ksmiv8XdbLPIfVMucXsqb9vfPZy29VC3LAh/94o8WFb91XlcLarFz/9HODn3fVvTH3h7++CX015qbbmxzldMwbmjTztc3tjmvixvbNFnrt3mIj02bXfyBNutgXJE2v4RagWi//zRftnVWonlZXVALmpNFdpH//uuaPvxo3rar5tHdu9NFsz3LL8fL7JJIOivejafV4m5z3bT54u55UebN3d27/GIzXi0vqDei8VsPCMEI3gWadd5U65qm8qNH3/vFHy2zBVH6o5d1dVnM8jp9WtT5tK3qawLWg7PM2zH9n6C4F+dZvcim1+//YlUW0yJv0l+YUufTfLYmxG757vG6nVd18YOsLapl+rxowGC3efFZVS/WZXZ7JA1ZXuXneZ0vpzmh+0oJmH6+pu9ui/MJTU0xzUqM9qLOFrd9z9I1rc7Tb+dZ2c4BgtFq0mKZvsiv0t+nqt9uhPd9YnMa+8Cc5wugtJoX0/RsiXZC2Ff5L1qTAKeg2kboDtuTqqpnxVLeJ4Sf5Mv8vGib94JRZsXivd54WefbJ3ndFudEYe76xpeJINNqdV0XF3OSbPd72rR1sbxIdyGtv+T/AdOWKsArBQAA',
                            _mode: 'binary'
                        }
                    }]
                };
                const request = { protocol, port, stubs: [stub] };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.get('/', port);
                }).then((response: any) => {
                    expect(response.headers['content-length']).toEqual('639');
                }).finally(() => api.del('/imposters'));
            });

            it('should correctly set content-length for binary data when using multiline base64', function () {
                const stub = {
                    responses: [{
                        is: {
                            headers: { 'Content-Length': 274 },
                            body: 'iVBORw0KGgoAAAANSUhEUgAAAGQAAAAyBAMAAABYG2ONAAAAFVBMVEUAAAD///9/f39fX1+fn58f\nHx8/Pz8rYiDqAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAo0lEQVRIie2Qyw7CIBBFb2DwO5q+1o0L\n1w0NrrHRPQnV//8EAUl0ga1ujIs5CZAz4YYZAIZhmN/QQOkjzq3LLuv6xUrQHmTJGphcEGE9rUQ3\nY4bqqrDjAlgQoJK9Z8YBmFy8Gp8DeSeTfRSBCf2I6/JN5ORiRfrNiIfqh9S9SVPL27A1C0G4EX2e\nJR7J1iI7rbG0Vf4x0UwPW0Uh3i0bwzD/yR11mBj1DIKiVwAAAABJRU5ErkJggg==\n',
                            _mode: 'binary'
                        }
                    }]
                };
                const request = { protocol, port, stubs: [stub] };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.get('/', port);
                }).then((response: any) => {
                    expect(response.headers['content-length']).toEqual('274');
                }).finally(() => api.del('/imposters'));
            });

            it('should handle JSON null values', function () {
                // https://github.com/bbyars/mountebank/issues/209
                const stub = { responses: [{ is: { body: { name: 'test', type: null } } }] };
                const request = { protocol, port, stubs: [stub] };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.get('/', port);
                }).then((response: any) => {
                    expect(JSON.parse(response.body)).toEqual({ name: 'test', type: null });
                }).finally(() => api.del('/imposters'));
            });

            it('should handle null values in deepEquals predicate (issue #229)', function () {
                const stub = {
                    predicates: [{ deepEquals: { body: { field: null } } }],
                    responses: [{ is: { body: 'SUCCESS' } }]
                };
                const request = { protocol, port, stubs: [stub] };

                return api.post('/imposters', request).then((response: any) => {
                    expect(201).toEqual(response.statusCode);
                    return client.post('/', { field: null }, port);
                }).then((response: any) => {
                    expect(response.body).toEqual('SUCCESS');
                }).finally(() => api.del('/imposters'));
            });

            it('should support array predicates with xpath', function () {
                const stub = {
                    responses: [{ is: { body: 'SUCCESS' } }],
                    predicates: [{
                        equals: { body: ['first', 'third', 'second'] },
                        xpath: { selector: '//value' }
                    }]
                };
                const xml = '<values><value>first</value><value>second</value><value>third</value></values>';
                const request = { protocol, port, stubs: [stub] };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.post('/', xml, port);
                }).then((response: any) => {
                    expect(response.body).toEqual('SUCCESS');
                }).finally(() => api.del('/imposters'));
            });

            it('should support matches predicate on uppercase JSON key (issue #228)', function () {
                const stub = {
                    predicates: [{ matches: { body: { Key: '^Value' } } }],
                    responses: [{ is: { body: 'SUCCESS' } }]
                };
                const request = { protocol, port, stubs: [stub] };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.post('/', { Key: 'Value' }, port);
                }).then((response: any) => {
                    expect(response.body).toEqual('SUCCESS');
                }).finally(() => api.del('/imposters'));
            });

            it('should support predicate matching with null value (issue #262)', function () {
                const stub = {
                    predicates: [{ equals: { body: { version: null } } }],
                    responses: [{ is: { body: 'SUCCESS' } }]
                };
                const request = { protocol, port, stubs: [stub] };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.post('/', { version: null }, port);
                }).then((response: any) => {
                    expect(response.body).toEqual('SUCCESS');
                }).finally(() => api.del('/imposters'));
            });

            it('should support predicate form matching', function () {
                const spec = {
                    path: '/',
                    port,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: 'firstname=ruud&lastname=mountebank'
                };

                const stub = {
                    predicates: [{ deepEquals: { form: { firstname: 'ruud', lastname: 'mountebank' } } }],
                    responses: [{ is: { body: 'SUCCESS' } }]
                };
                const request = { protocol, port, stubs: [stub] };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.responseFor(spec);
                }).then((response: any) => {
                    expect(response.body).toEqual('SUCCESS');
                }).finally(() => api.del('/imposters'));
            });

            it('should support overwriting the stubs without restarting the imposter', function () {
                const stub = { responses: [{ is: { body: 'ORIGINAL' } }] };
                const request = { protocol, port, stubs: [stub] };

                return api.post('/imposters', request)
                    .then(() => api.put(`/imposters/${port}/stubs`, {
                        stubs: [
                            { responses: [{ is: { body: 'FIRST' } }] },
                            { responses: [{ is: { body: 'ORIGINAL' } }] },
                            { responses: [{ is: { body: 'THIRD' } }] }
                        ]
                    }))
                    .then((response: any) => {
                        const sanitizedBody = sanitizeBody(response);
                        expect(response.statusCode).toEqual(200);
                        expect(sanitizedBody.stubs).toEqual([
                            {
                                _uuid: '696969696969',
                                responses: [{ is: { body: 'FIRST' } }],
                                _links: { self: { href: `${api.url}/imposters/${port}/stubs/0` } }
                            },
                            {
                                _uuid: '696969696969',
                                responses: [{ is: { body: 'ORIGINAL' } }],
                                _links: { self: { href: `${api.url}/imposters/${port}/stubs/1` } }
                            },
                            {
                                _uuid: '696969696969',
                                responses: [{ is: { body: 'THIRD' } }],
                                _links: { self: { href: `${api.url}/imposters/${port}/stubs/2` } }
                            }
                        ]);
                        return client.get('/', port);
                    })
                    .then((response: any) => {
                        expect(response.body).toEqual('FIRST');
                    })
                    .finally(() => api.del('/imposters'));
            });

            it('should support overwriting a single stub without restarting the imposter', function () {
                const request = {
                    protocol,
                    port,
                    stubs: [
                        { responses: [{ is: { body: 'first' } }], predicates: [{ equals: { path: '/first' } }] },
                        { responses: [{ is: { body: 'SECOND' } }] },
                        { responses: [{ is: { body: 'third' } }] }
                    ]
                };
                const changedStub = { responses: [{ is: { body: 'CHANGED' } }] };

                return api.post('/imposters', request)
                    .then((response: any) => {
                        expect(201).toEqual(response.statusCode);
                        return api.put(`/imposters/${port}/stubs/1`, changedStub);
                    })
                    .then((response: any) => {
                        const sanitizedBody = sanitizeBody(response);
                        expect(response.statusCode).toEqual(200);
                        expect(sanitizedBody.stubs).toEqual([
                            {
                                _uuid: '696969696969',
                                responses: [{ is: { body: 'first' } }],
                                predicates: [{ equals: { path: '/first' } }],
                                _links: { self: { href: `${api.url}/imposters/${port}/stubs/0` } }
                            },
                            {
                                _uuid: '696969696969',
                                responses: [{ is: { body: 'CHANGED' } }],
                                _links: { self: { href: `${api.url}/imposters/${port}/stubs/1` } }
                            },
                            {
                                _uuid: '696969696969',
                                responses: [{ is: { body: 'third' } }],
                                _links: { self: { href: `${api.url}/imposters/${port}/stubs/2` } }
                            }
                        ]);
                        return client.get('/', port);
                    })
                    .then((response: any) => {
                        expect(response.body).toEqual('CHANGED');
                    })
                    .finally(() => api.del('/imposters'));
            });

            it('should support deleting single stub without restarting the imposter', function () {
                const request = {
                    protocol,
                    port,
                    stubs: [
                        { responses: [{ is: { body: 'first' } }], predicates: [{ equals: { path: '/first' } }] },
                        { responses: [{ is: { body: 'SECOND' } }] },
                        { responses: [{ is: { body: 'third' } }] }
                    ]
                };

                return api.post('/imposters', request)
                    .then((response: any) => {
                        expect(201).toEqual(response.statusCode);
                        return api.del(`/imposters/${port}/stubs/1`);
                    })
                    .then((response: any) => {
                        const sanitizedBody = sanitizeBody(response);
                        expect(response.statusCode).toEqual(200);
                        expect(sanitizedBody.stubs).toEqual([
                            {
                                _uuid: '696969696969',
                                responses: [{ is: { body: 'first' } }], predicates: [{ equals: { path: '/first' } }],
                                _links: { self: { href: `${api.url}/imposters/${port}/stubs/0` } }
                            },
                            {
                                _uuid: '696969696969',
                                responses: [{ is: { body: 'third' } }],
                                _links: { self: { href: `${api.url}/imposters/${port}/stubs/1` } }
                            }
                        ]);
                        return client.get('/', port);
                    })
                    .then((response: any) => {
                        expect(response.body).toEqual('third');
                    })
                    .finally(() => api.del('/imposters'));
            });

            it('should support adding single stub without restarting the imposter', function () {
                const request = {
                    protocol,
                    port,
                    stubs: [
                        { responses: [{ is: { body: 'first' } }], predicates: [{ equals: { path: '/first' } }] },
                        { responses: [{ is: { body: 'third' } }] }
                    ]
                };
                const newStub = { responses: [{ is: { body: 'SECOND' } }] };

                return api.post('/imposters', request)
                    .then((response: any) => {
                        expect(201).toEqual(response.statusCode);
                        return api.post(`/imposters/${port}/stubs`, { index: 1, stub: newStub });
                    })
                    .then((response: any) => {
                        const sanitizedBody = sanitizeBody(response);
                        expect(response.statusCode).toEqual(200);
                        expect(sanitizedBody.stubs).toEqual([
                            {
                                _uuid: '696969696969',
                                responses: [{ is: { body: 'first' } }], predicates: [{ equals: { path: '/first' } }],
                                _links: { self: { href: `${api.url}/imposters/${port}/stubs/0` } }
                            },
                            {
                                _uuid: '696969696969',
                                responses: [{ is: { body: 'SECOND' } }],
                                _links: { self: { href: `${api.url}/imposters/${port}/stubs/1` } }
                            },
                            {
                                _uuid: '696969696969',
                                responses: [{ is: { body: 'third' } }],
                                _links: { self: { href: `${api.url}/imposters/${port}/stubs/2` } }
                            }
                        ]);
                        return client.get('/', port);
                    })
                    .then((response: any) => {
                        expect(response.body).toEqual('SECOND');
                    })
                    .finally(() => api.del('/imposters'));
            });

            it('should support adding single stub at end without index ', function () {
                const request = {
                    protocol,
                    port,
                    stubs: [
                        { responses: [{ is: { body: 'first' } }], predicates: [{ equals: { path: '/first' } }] },
                        { responses: [{ is: { body: 'third' } }] }
                    ]
                };
                const newStub = { responses: [{ is: { body: 'LAST' } }] };

                return api.post('/imposters', request)
                    .then((response: any) => {
                        expect(201).toEqual(response.statusCode);
                        return api.post(`/imposters/${port}/stubs`, { stub: newStub });
                    })
                    .then((response: any) => {
                        const sanitizedBody = sanitizeBody(response);
                        expect(response.statusCode).toEqual(200);
                        expect(sanitizedBody.stubs).toEqual([
                            {
                                _uuid: '696969696969',
                                responses: [{ is: { body: 'first' } }], predicates: [{ equals: { path: '/first' } }],
                                _links: { self: { href: `${api.url}/imposters/${port}/stubs/0` } }
                            },
                            {
                                _uuid: '696969696969',
                                responses: [{ is: { body: 'third' } }],
                                _links: { self: { href: `${api.url}/imposters/${port}/stubs/1` } }
                            },
                            {
                                _uuid: '696969696969',
                                responses: [{ is: { body: 'LAST' } }],
                                _links: { self: { href: `${api.url}/imposters/${port}/stubs/2` } }
                            }
                        ]);
                        return client.get('/', port);
                    })
                    .then((response: any) => {
                        expect(response.body).toEqual('third');
                    })
                    .finally(() => api.del('/imposters'));
            });
        });
    });
});
