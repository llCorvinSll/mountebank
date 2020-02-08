import { ApiClient } from '../api';
const assert = require('assert');
import { BaseHttpClient } from './baseHttpClient';
const fs = require('fs');
const util = require('util');

['http', 'https'].forEach(protocol => {
    const client = new BaseHttpClient(protocol);
    let api: ApiClient;
    let port: number;

    beforeEach(() => {
        api = new ApiClient();
        port = api.port + 1;
    });

    describe(`${protocol} imposter`, function () {
        describe('POST /imposters with stubs', function () {
            it('should add latency when using behaviors.wait', function () {
                const stub = {
                    responses: [{
                        is: { body: 'stub' },
                        _behaviors: { wait: 1000 }
                    }]
                };
                const stubs = [stub];
                const request = { protocol, port, stubs: stubs };
                let timer: number;

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    timer = Date.now();
                    return client.get('/', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('stub');
                    const time = Date.now() - timer;

                    //Occasionally there's some small inaccuracies
                    assert.ok(time >= 990, `actual time: ${time}`);
                }).finally(() => api.del('/imposters'));
            });

            it('should add latency when using behaviors.wait as a function', function () {
                const fn = () => 1000;
                const stub = {
                    responses: [{
                        is: { body: 'stub' },
                        _behaviors: { wait: fn.toString() }
                    }]
                };
                const stubs = [stub];
                const request = { protocol, port, stubs: stubs };
                let timer: number;

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    timer = Date.now();
                    return client.get('/', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('stub');
                    const time = Date.now() - timer;

                    //Occasionally there's some small inaccuracies
                    assert.ok(time >= 990, `actual time: ${time}`);
                }).finally(() => api.del('/imposters'));
            });

            it('should support post-processing when using behaviors.decorate (old interface)', function () {
                const decorator = (request: any, response: any) => {
                    response.body = response.body.replace('${YEAR}', new Date().getFullYear());
                };
                const stub = {
                    responses: [{
                        is: { body: 'the year is ${YEAR}' },
                        _behaviors: { decorate: decorator.toString() }
                    }]
                };
                const stubs = [stub];
                const request = { protocol, port, stubs: stubs };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.get('/', port);
                }).then((response: any) => {
                    expect(response.body).toEqual(`the year is ${new Date().getFullYear()}`);
                }).finally(() => api.del('/imposters'));
            });

            it('should support post-processing when using behaviors.decorate', function () {
                const decorator = (config: any) => {
                    config.response.body = config.response.body.replace('${YEAR}', new Date().getFullYear());
                };
                const stub = {
                    responses: [{
                        is: { body: 'the year is ${YEAR}' },
                        _behaviors: { decorate: decorator.toString() }
                    }]
                };
                const stubs = [stub];
                const request = { protocol, port, stubs: stubs };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.get('/', port);
                }).then((response: any) => {
                    expect(response.body).toEqual(`the year is ${new Date().getFullYear()}`);
                }).finally(() => api.del('/imposters'));
            });

            it('should fix content-length if set and adjusted using decoration (issue #155)', function () {
                const decorator = (request: any, response: any) => {
                    response.body = 'length-8';
                };
                const stub = {
                    responses: [{
                        is: {
                            body: 'len-5',
                            headers: { 'content-length': 5 }
                        },
                        _behaviors: { decorate: decorator.toString() }
                    }]
                };
                const stubs = [stub];
                const request = { protocol, port, stubs: stubs };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.get('/', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('length-8');
                    expect(response.headers['content-length']).toEqual('8');
                }).finally(() => api.del('/imposters'));
            });

            it('should support using request parameters during decorating (old interface)', function () {
                const decorator = (request: any, response: any) => {
                    response.body = response.body.replace('${PATH}', request.path);
                };
                const stub = {
                    responses: [{
                        is: { body: 'the path is ${PATH}' },
                        _behaviors: { decorate: decorator.toString() }
                    }]
                };
                const stubs = [stub];
                const request = { protocol, port, stubs: stubs };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.get('/test', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('the path is /test');
                }).finally(() => api.del('/imposters'));
            });

            it('should support using request parameters during decorating', function () {
                const decorator = (config: any) => {
                    config.response.body = config.response.body.replace('${PATH}', config.request.path);
                };
                const stub = {
                    responses: [{
                        is: { body: 'the path is ${PATH}' },
                        _behaviors: { decorate: decorator.toString() }
                    }]
                };
                const stubs = [stub];
                const request = { protocol, port, stubs: stubs };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.get('/test', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('the path is /test');
                }).finally(() => api.del('/imposters'));
            });

            it('should support using request parameters during decorating multiple times (issue #173)', function () {
                const decorator = (request: any, response: any) => {
                    response.body = response.body.replace('${id}', request.query.id);
                };
                const stub = {
                    responses: [{
                        is: { body: 'request ${id}' },
                        _behaviors: { decorate: decorator.toString() }
                    }]
                };
                const stubs = [stub];
                const request = { protocol, port, stubs: stubs };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.get('/test?id=100', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('request 100');
                    return api.get(`/imposters/${port}`);
                }).then(() => client.get('/test?id=200', port)
                ).then((response: any) => {
                    expect(response.body).toEqual('request 200');
                    return client.get('/test?id=300', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('request 300');
                }).finally(() => api.del('/imposters'));
            });

            it('should support decorate functions that return a value (old interface)', function () {
                const decorator = (request: any, response: any) => {
                    const clonedResponse = JSON.parse(JSON.stringify(response));
                    clonedResponse.body = 'This is a clone';
                    return clonedResponse;
                };
                const stub = {
                    responses: [{
                        is: { body: 'This is the original' },
                        _behaviors: { decorate: decorator.toString() }
                    }]
                };
                const stubs = [stub];
                const request = { protocol, port, stubs: stubs };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.get('/', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('This is a clone');
                }).finally(() => api.del('/imposters'));
            });

            it('should support decorate functions that return a value', function () {
                const decorator = (config: any) => {
                    const clonedResponse = JSON.parse(JSON.stringify(config.response));
                    clonedResponse.body = 'This is a clone';
                    return clonedResponse;
                };
                const stub = {
                    responses: [{
                        is: { body: 'This is the original' },
                        _behaviors: { decorate: decorator.toString() }
                    }]
                };
                const stubs = [stub];
                const request = { protocol, port, stubs: stubs };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.get('/', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('This is a clone');
                }).finally(() => api.del('/imposters'));
            });

            it('should not validate the decorate JavaScript function', function () {
                const decorator = "response.body = 'This should not work';";
                const stub = {
                    responses: [{
                        is: { body: 'This is the original' },
                        _behaviors: { decorate: decorator }
                    }]
                };
                const stubs = [stub];
                const request = { protocol, port, stubs: stubs };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                }).finally(() => api.del('/imposters'));
            });

            it('should repeat if behavior set and loop around responses with same repeat behavior (issue #165)', function () {
                const stub = {
                    responses: [
                        {
                            is: {
                                body: 'first response',
                                statusCode: 400,
                                headers: { 'Content-Type': 'text/plain' }
                            },
                            _behaviors: { repeat: 2 }
                        },
                        {
                            is: { body: 'second response' },
                            _behaviors: { repeat: 3 }
                        },
                        { is: { body: 'third response' } }
                    ]
                };
                const request = { protocol, port, stubs: [stub] };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.get('/', port);
                }).then((response: any) => {
                    expect(response.statusCode).toEqual(400);
                    expect(response.body).toEqual('first response');
                    return client.get('/', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('first response');
                    return client.get('/', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('second response');
                    return client.get('/', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('second response');
                    return client.get('/', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('second response');
                    return client.get('/', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('third response');
                    return client.get('/', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('first response');
                    return client.get('/', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('first response');
                    return client.get('/', port);
                }).finally(() => api.del('/imposters'));
            });

            it('should repeat consistently with headers (issue #158)', function () {
                const stub = {
                    responses: [
                        {
                            is: {
                                body: 'first response',
                                headers: { 'Content-Type': 'application/xml' }
                            },
                            _behaviors: { repeat: 2 }
                        },
                        { is: { body: 'second response' } }
                    ]
                };
                const request = { protocol, port, stubs: [stub] };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.get('/', port);
                }).then((response: any) => {
                    assert.deepEqual(response.body, 'first response', 'first try');
                    return client.get('/', port);
                }).then((response: any) => {
                    assert.deepEqual(response.body, 'first response', 'second try');
                    return client.get('/', port);
                }).then((response: any) => {
                    assert.deepEqual(response.body, 'second response', 'third try');
                }).finally(() => api.del('/imposters'));
            });

            it('should repeat with JSON key of repeat (issue #237)', function () {
                const stub = {
                    responses: [
                        {
                            is: { body: 'This should repeat 2 times' },
                            _behaviors: { repeat: 2 }
                        },
                        { is: { body: 'Then you should see this' } }
                    ],
                    predicates: [{
                        equals: {
                            body: { repeat: true }
                        }
                    }]
                };
                const request = { protocol, port, stubs: [stub] };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.post('/', { repeat: true }, port);
                }).then((response: any) => {
                    assert.deepEqual(response.body, 'This should repeat 2 times', 'first try');
                    return client.post('/', { repeat: true }, port);
                }).then((response: any) => {
                    assert.deepEqual(response.body, 'This should repeat 2 times', 'second try');
                    return client.post('/', { repeat: true }, port);
                }).then((response: any) => {
                    assert.deepEqual(response.body, 'Then you should see this', 'third try');
                }).finally(() => api.del('/imposters'));
            });

            it('should support shell transform without array for backwards compatibility', function () {
                //The string version of the shellTransform behavior is left for backwards
                //compatibility. It changed in v1.13.0 to accept an array.
                const stub = {
                    responses: [{
                        is: { body: 'Hello, {YOU}!' },
                        _behaviors: { shellTransform: 'node shellTransformTest.js' }
                    }]
                };
                const stubs = [stub];
                const request = { protocol, port, stubs: stubs };
                const shellFn = function exec () {
                    console.log(process.argv[3].replace('{YOU}', 'mountebank'));
                };

                fs.writeFileSync('shellTransformTest.js', util.format('%s\nexec();', shellFn.toString()));

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.get('/', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('Hello, mountebank!');
                }).finally(() => {
                    fs.unlinkSync('shellTransformTest.js');
                    return api.del('/imposters');
                });
            });

            it('should support array of shell transforms in order', function () {
                const stub = {
                    responses: [{
                        is: { body: 1 },
                        _behaviors: {
                            shellTransform: ['node double.js', 'node increment.js']
                        }
                    }]
                };
                const stubs = [stub];
                const request = { protocol, port, stubs: stubs };
                const doubleFn = function double () {
                    const response = JSON.parse(process.argv[3]);
                    response.body *= 2;
                    console.log(JSON.stringify(response));
                };
                const incrementFn = function increment () {
                    const response = JSON.parse(process.argv[3]);
                    response.body += 1;
                    console.log(JSON.stringify(response));
                };

                fs.writeFileSync('double.js', util.format('%s\ndouble();', doubleFn.toString()));
                fs.writeFileSync('increment.js', util.format('%s\nincrement();', incrementFn.toString()));

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.get('/', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('3');
                }).finally(() => {
                    fs.unlinkSync('double.js');
                    fs.unlinkSync('increment.js');
                    return api.del('/imposters');
                });
            });

            it('should support copying from request fields using regex', function () {
                const stub = {
                    responses: [{
                        is: {
                            statusCode: '${code}',
                            headers: {
                                'X-Test': '${header}'
                            },
                            body: '${body}'
                        },
                        _behaviors: {
                            copy: [
                                {
                                    from: 'path',
                                    into: '${code}',
                                    using: { method: 'regex', selector: '\\d+' }
                                },
                                {
                                    from: { headers: 'X-Request' },
                                    into: '${header}',
                                    using: { method: 'regex', selector: '.+' }
                                },
                                {
                                    from: { query: 'body' },
                                    into: '${body}',
                                    using: {
                                        method: 'regex',
                                        selector: 'he\\w+$',
                                        options: { ignoreCase: true }
                                    }
                                }
                            ]
                        }
                    }]
                };
                const request = { protocol, port, stubs: [stub] };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.responseFor({
                        port,
                        method: 'GET',
                        headers: { 'x-request': 'header value' },
                        path: '/400/this-will-be-ignored?body=body%20is%20HERE'
                    });
                }).then((response: any) => {
                    expect(response.statusCode).toEqual(400);
                    expect(response.headers['x-test']).toEqual('header value');
                    expect(response.body).toEqual('HERE');
                }).finally(() => api.del('/imposters'));
            });

            it('should support copying from request fields using xpath', function () {
                const stub = {
                    responses: [{
                        is: { body: 'Hello, NAME! Good to see you, NAME.' },
                        _behaviors: {
                            copy: [{
                                from: 'body',
                                into: 'NAME',
                                using: {
                                    method: 'xpath',
                                    selector: '//mb:name',
                                    ns: { mb: 'http://example.com/mb' }
                                }
                            }]
                        }
                    }]
                };
                const request = { protocol, port, stubs: [stub] };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.post('/', '<doc xmlns:mb="http://example.com/mb"><mb:name>mountebank</mb:name></doc>', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('Hello, mountebank! Good to see you, mountebank.');
                }).finally(() => api.del('/imposters'));
            });

            it('should support copying from request fields using jsonpath', function () {
                const stub = {
                    responses: [{
                        is: { body: 'Hello, NAME! Good to see you, NAME.' },
                        _behaviors: {
                            copy: [{
                                from: 'BODY',
                                into: 'NAME',
                                using: { method: 'jsonpath', selector: '$..name' }
                            }]
                        }
                    }]
                };
                const request = { protocol, port, stubs: [stub] };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.post('/', JSON.stringify({ name: 'mountebank' }), port);
                }).then((response: any) => {
                    expect(response.body).toEqual('Hello, mountebank! Good to see you, mountebank.');
                }).finally(() => api.del('/imposters'));
            });

            it('should support lookup from CSV file keyed by regex', function () {
                const stub = {
                    responses: [{
                        is: {
                            statusCode: '${mountebank}["code"]',
                            headers: {
                                'X-Occupation': '${mountebank}[occupation]'
                            },
                            body: "Hello ${mountebank}['name']. Have you been to ${bob}[location]?"
                        },
                        _behaviors: {
                            lookup: [
                                {
                                    key: { from: 'path', using: { method: 'regex', selector: '/(.*)$' }, index: 1 },
                                    fromDataSource: { csv: { path: 'lookupTest.csv', keyColumn: 'name' } },
                                    into: '${mountebank}'
                                },
                                {
                                    key: { from: { headers: 'X-Bob' }, using: { method: 'regex', selector: '.+' } },
                                    fromDataSource: { csv: { path: 'lookupTest.csv', keyColumn: 'occupation' } },
                                    into: '${bob}'
                                }
                            ]
                        }
                    }]
                };
                const request = { protocol, port, stubs: [stub] };

                fs.writeFileSync('lookupTest.csv',
                    'name,code,occupation,location\n' +
                    'mountebank,400,tester,worldwide\n' +
                    'Brandon,404,mountebank,Dallas\n' +
                    'Bob Barker,500,"The Price Is Right","Darrington, Washington"');

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.responseFor({
                        port,
                        method: 'GET',
                        headers: { 'x-bob': 'The Price Is Right' },
                        path: '/mountebank'
                    });
                }).then((response: any) => {
                    expect(response.statusCode).toEqual(400);
                    expect(response.headers['x-occupation']).toEqual('tester');
                    expect(response.body).toEqual('Hello mountebank. Have you been to Darrington, Washington?');
                }).finally(() => {
                    fs.unlinkSync('lookupTest.csv');
                    return api.del('/imposters');
                });
            });

            it('should support lookup from CSV file keyed by xpath', function () {
                const stub = {
                    responses: [{
                        is: { body: "Hello, YOU[name]! How is YOU['location'] today?" },
                        _behaviors: {
                            lookup: [{
                                key: {
                                    from: 'body',
                                    using: {
                                        method: 'xpath',
                                        selector: '//mb:name',
                                        ns: { mb: 'http://example.com/mb' }
                                    }
                                },
                                fromDataSource: { csv: { path: 'lookupTest.csv', keyColumn: 'occupation' } },
                                into: 'YOU'
                            }]
                        }
                    }]
                };
                const request = { protocol, port, stubs: [stub] };

                fs.writeFileSync('lookupTest.csv',
                    'name,occupation,location\n' +
                    'mountebank,tester,worldwide\n' +
                    'Brandon,mountebank,Dallas\n' +
                    'Bob Barker,"The Price Is Right","Darrington, Washington"');

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.post('/', '<doc xmlns:mb="http://example.com/mb"><mb:name>mountebank</mb:name></doc>', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('Hello, Brandon! How is Dallas today?');
                }).finally(() => {
                    fs.unlinkSync('lookupTest.csv');
                    return api.del('/imposters');
                });
            });

            it('should support lookup from CSV file keyed by jsonpath', function () {
                const stub = {
                    responses: [{
                        is: { body: 'Hello, YOU["name"]! How is YOU[location] today?' },
                        _behaviors: {
                            lookup: [{
                                key: { from: 'body', using: { method: 'jsonpath', selector: '$..occupation' } },
                                fromDataSource: { csv: { path: 'lookupTest.csv', keyColumn: 'occupation' } },
                                into: 'YOU'
                            }]
                        }
                    }]
                };
                const request = { protocol, port, stubs: [stub] };

                fs.writeFileSync('lookupTest.csv',
                    'name,occupation,location\n' +
                    'mountebank,tester,worldwide\n' +
                    'Brandon,mountebank,Dallas\n' +
                    'Bob Barker,"The Price Is Right","Darrington, Washington"');

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.post('/', JSON.stringify({ occupation: 'mountebank' }), port);
                }).then((response: any) => {
                    expect(response.body).toEqual('Hello, Brandon! How is Dallas today?');
                }).finally(() => {
                    fs.unlinkSync('lookupTest.csv');
                    return api.del('/imposters');
                });
            });

            it('should compose multiple behaviors together', function () {
                const shellFn = function exec () {
                    console.log(process.argv[3].replace('${SALUTATION}', 'Hello'));
                };
                const decorator = (request: any, response: any) => {
                    response.body = response.body.replace('${SUBJECT}', 'mountebank');
                };
                const stub = {
                    responses: [
                        {
                            is: { body: '${SALUTATION}, ${SUBJECT}${PUNCTUATION}' },
                            _behaviors: {
                                wait: 300,
                                repeat: 2,
                                shellTransform: ['node shellTransformTest.js'],
                                decorate: decorator.toString(),
                                copy: [{
                                    from: { query: 'punctuation' },
                                    into: '${PUNCTUATION}',
                                    using: { method: 'regex', selector: '[,.?!]' }
                                }]
                            }
                        },
                        {
                            is: { body: 'No behaviors' }
                        }
                    ]
                };
                const stubs = [stub];
                const request = { protocol, port, stubs: stubs };
                const timer = Date.now();

                fs.writeFileSync('shellTransformTest.js', util.format('%s\nexec();', shellFn.toString()));

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return client.get('/?punctuation=!', port);
                }).then((response: any) => {
                    const time = Date.now() - timer;
                    expect(response.body).toEqual('Hello, mountebank!');
                    assert.ok(time >= 250, `actual time: ${time}`);
                    return client.get('/?punctuation=!', port);
                }).then((response: any) => {
                    const time = Date.now() - timer;
                    expect(response.body).toEqual('Hello, mountebank!');
                    assert.ok(time >= 250, `actual time: ${time}`);
                    return client.get('/?punctuation=!', port);
                }).then((response: any) => {
                    expect(response.body).toEqual('No behaviors');
                }).finally(() => {
                    fs.unlinkSync('shellTransformTest.js');
                    return api.del('/imposters');
                });
            });
        });
    });
});
