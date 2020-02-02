const assert = require('assert');
import {ResponseResolver} from '../../src/models/responseResolver';
import {StubRepository} from '../../src/models/stubs/StubRepository';
const helpers = require('../../src/util/helpers');
const mock = require('../mock').mock;
const Q = require('q');
const Logger = require('../fakes/fakeLogger');
import * as util from 'util';

describe('responseResolver', function () {

    function cleanedProxyResponse (response: any) {
        if (helpers.defined(response.is) && helpers.defined(response.is._proxyResponseTime)) { // eslint-disable-line no-underscore-dangle
            delete response.is._proxyResponseTime; // eslint-disable-line no-underscore-dangle
        }
        return response;
    }

    function proxyResponses (responses: any[]) {
        return responses.map(response => cleanedProxyResponse(response));
    }

    function stubList (stubs: any) {
        const result = stubs.stubs();
        result.forEach((stub: any) => {
            delete stub.recordMatch;
            delete stub.addResponse;
            stub.responses = proxyResponses(stub.responses);
        });
        return JSON.parse(JSON.stringify(result));
    }

    describe('#resolve', function () {
        let stubs: StubRepository;

        beforeEach(() => {
            stubs = new StubRepository('utf8', true);
        });

        it('should resolve "is" without transformation', function () {
            const proxy: any = {};
            const resolver = new ResponseResolver(stubs, proxy);
            const logger = Logger.create();
            const responseConfig = {is: 'value'};

            return resolver.resolve(responseConfig, 'request' as any, logger, {}).then(response => {
                assert.strictEqual(response, 'value');
            });
        });

        it('should resolve "proxy" by delegating to the proxy for in process resolution', function () {
            const proxy = { to: mock().returns(Q({ key: 'value' })) },
                resolver = new ResponseResolver(stubs, proxy),
                logger = Logger.create();

            // Call through the stubRepository to have it add the setMetadata function
            stubs.addStub({ responses: [{ proxy: { to: 'where' } }] } as any);
            const responseConfig = stubs.getResponseFor({}, logger, {});

            return resolver.resolve(responseConfig, 'request' as any, logger, {}).then((response: any) => {
                assert.strictEqual(response.key, 'value');
                assert.ok(proxy.to.wasCalledWith('where', 'request', {
                    to: 'where',
                    mode: 'proxyOnce'
                }), proxy.to.message());
            });
        });

        it('should resolve "proxy" by returning proxy configuration for out of process resolution', function () {
            const resolver = new ResponseResolver(stubs, null, 'CALLBACK URL');
            const logger = Logger.create();

            // Call through the stubRepository to have it add the setMetadata function
            stubs.addStub({ responses: [{ proxy: { to: 'where' } }] } as any);
            const responseConfig = stubs.getResponseFor({}, logger, {});

            return resolver.resolve(responseConfig, 'request' as any, logger, {}).then(response => {
                assert.deepEqual(response, {
                    proxy: { to: 'where', mode: 'proxyOnce' },
                    request: 'request',
                    callbackURL: 'CALLBACK URL/0'
                });
            });
        });

        it('should default to "proxyOnce" mode', function () {
            const proxy = { to: mock().returns(Q({ key: 'value' })) },
                resolver = new ResponseResolver(stubs, proxy),
                logger = Logger.create();

            // Call through the stubRepository to have it add the setMetadata function
            stubs.addStub({ responses: [{ proxy: { to: 'where' } }] } as any);
            const responseConfig = stubs.getResponseFor({}, logger, {});

            return resolver.resolve(responseConfig, 'request' as any, logger, {}).then(() => {
                assert.strictEqual(responseConfig.proxy!.mode, 'proxyOnce');
            });
        });

        it('should change unrecognized mode to "proxyOnce" mode', function () {
            const proxy = { to: mock().returns(Q({ key: 'value' })) },
                resolver = new ResponseResolver(stubs, proxy),
                logger = Logger.create();

            // Call through the stubRepository to have it add the setMetadata function
            stubs.addStub({ responses: [{ proxy: { to: 'where', mode: 'unrecognized' } }] } as any);
            const responseConfig = stubs.getResponseFor({}, logger, {});

            return resolver.resolve(responseConfig, 'request' as any, logger, {}).then(() => {
                assert.strictEqual(responseConfig.proxy!.mode, 'proxyOnce');
            });
        });

        it('should resolve proxy in proxyOnce mode by adding a new "is" stub to the front of the list', function () {
            const proxy = { to: mock().returns(Q({ key: 'value' })) },
                resolver = new ResponseResolver(stubs, proxy),
                logger = Logger.create();

            stubs.addStub({ responses: [], predicates: [{ equals: { ignore: 'true' } }] });
            stubs.addStub({ responses: [{ proxy: { to: 'where' } }] }  as any);
            const responseConfig = stubs.getResponseFor({}, logger, {});

            return resolver.resolve(responseConfig, {}, logger, {}).then((response: any) => {
                assert.strictEqual(response.key, 'value');
                const stubResponses = stubs.stubs().map((stub: any) => proxyResponses(stub.responses));
                assert.deepEqual(stubResponses, [
                    [],
                    [{ is: { key: 'value' } }],
                    [{ proxy: { to: 'where', mode: 'proxyOnce' } }]
                ]);
            });
        });

        it('should support adding wait behavior to newly created stub for in process imposters', function () {
            const proxy = {to: mock().returns(Q.delay(100).then(() => Q({data: 'value'})))};
            const resolver = new ResponseResolver(stubs, proxy);
            const logger = Logger.create();
            const request = {};

            stubs.addStub({ responses: [{ proxy: { to: 'where', addWaitBehavior: true } }] } as any);
            const responseConfig = stubs.getResponseFor({}, logger, {});

            return resolver.resolve(responseConfig, request, logger, {}).then(() => {
                const stubResponses = stubs.stubs().map(stub => stub.responses),
                    wait = stubResponses[0]![0].is._proxyResponseTime; // eslint-disable-line no-underscore-dangle
                assert.ok(wait > 90); // allow some variability
                assert.deepEqual(stubResponses, [
                    [{ is: { data: 'value', _proxyResponseTime: wait }, _behaviors: { wait: wait } }],
                    [{ proxy: { to: 'where', addWaitBehavior: true, mode: 'proxyOnce' } }]
                ]);
            });
        });

        it('should support adding wait behavior to newly created response in proxyAlways mode', function () {
            let call = 0;
            function proxyReturn () {
                return Q.delay(100).then(() => {
                    call += 1;
                    return Q({ data: call });
                });
            }

            const proxy = { to: proxyReturn },
                resolver = new ResponseResolver(stubs, proxy),
                logger = Logger.create(),
                request = {};

            stubs.addStub({ responses: [{ proxy: { to: 'where', mode: 'proxyAlways', addWaitBehavior: true } }] }  as any);
            const responseConfig = stubs.getResponseFor({}, logger, {});

            return resolver.resolve(responseConfig, request, logger, {}).then(() =>
                // First call adds the stub, second call adds a response
                resolver.resolve(responseConfig, request, logger, {})
            ).then(() => {
                const stubResponses = stubs.stubs().map(stub => stub.responses),
                    firstWait = stubResponses[1]![0].is._proxyResponseTime, // eslint-disable-line no-underscore-dangle
                    secondWait = stubResponses[1]![1].is._proxyResponseTime; // eslint-disable-line no-underscore-dangle
                assert.deepEqual(stubResponses, [
                    [{ proxy: { to: 'where', mode: 'proxyAlways', addWaitBehavior: true } }],
                    [
                        { is: { data: 1, _proxyResponseTime: firstWait }, _behaviors: { wait: firstWait } },
                        { is: { data: 2, _proxyResponseTime: secondWait }, _behaviors: { wait: secondWait } }
                    ]
                ]);
            });
        });

        it('should run behaviors on proxy response before recording it', function () {
            const decorateFunc = (request: any, response: any) => { response.data += '-DECORATED'; };
            const proxy = { to: mock().returns(Q({ data: 'RESPONSE' })) },
                resolver = new ResponseResolver(stubs, proxy),
                logger = Logger.create(),
                response = {
                    proxy: { to: 'where' },
                    _behaviors: { decorate: decorateFunc.toString() }
                },
                request = {};

            stubs.addStub({ responses: [response] } as any);
            const responseConfig = stubs.getResponseFor({}, logger, {});

            return resolver.resolve(responseConfig, request, logger, {}).then(() => {
                const stubResponses = stubs.stubs().map(stub => proxyResponses(stub.responses!));
                assert.deepEqual(stubResponses, [
                    [{ is: { data: 'RESPONSE-DECORATED' } }],
                    [{ proxy: { to: 'where', mode: 'proxyOnce' }, _behaviors: { decorate: decorateFunc.toString() } }]
                ]);
            });
        });

        it('should support adding decorate behavior to newly created stub', function () {
            const decorateFunc = '(request, response) => {}';
            const proxy = { to: mock().returns(Q({ data: 'value' })) },
                resolver = new ResponseResolver(stubs, proxy),
                logger = Logger.create(),
                request = {};

            stubs.addStub({ responses: [{ proxy: { to: 'where', addDecorateBehavior: decorateFunc } }] } as any);
            const responseConfig = stubs.getResponseFor({}, logger, {});

            return resolver.resolve(responseConfig, request, logger, {}).then(() => {
                const stubResponses = stubs.stubs().map(stub => proxyResponses(stub.responses!));
                assert.deepEqual(stubResponses, [
                    [{ is: { data: 'value' }, _behaviors: { decorate: decorateFunc } }],
                    [{ proxy: { to: 'where', addDecorateBehavior: decorateFunc, mode: 'proxyOnce' } }]
                ]);
            });
        });

        it('should support adding decorate behavior to newly created response in proxyAlways mode', function () {
            const decorateFunc = '(request, response) => {}';
            const proxy = { to: mock().returns(Q({ data: 'value' })) },
                resolver = new ResponseResolver(stubs, proxy),
                logger = Logger.create(),
                request = {};

            stubs.addStub({ responses: [{ proxy: { to: 'where', mode: 'proxyAlways', addDecorateBehavior: decorateFunc } }] } as any);
            const responseConfig = stubs.getResponseFor({}, logger, {});

            return resolver.resolve(responseConfig, request, logger, {}).then(() =>
                // First call adds the stub, second call adds a response
                resolver.resolve(responseConfig, request, logger, stubs)
            ).then(() => {
                const stubResponses = stubs.stubs().map(stub => proxyResponses(stub.responses!));
                assert.deepEqual(stubResponses, [
                    [{ proxy: { to: 'where', mode: 'proxyAlways', addDecorateBehavior: decorateFunc } }],
                    [
                        { is: { data: 'value' }, _behaviors: { decorate: decorateFunc } },
                        { is: { data: 'value' }, _behaviors: { decorate: decorateFunc } }
                    ]
                ]);
            });
        });

        it('should resolve "proxy" and remember full objects as "deepEquals" predicates', function () {
            const proxy = { to: mock().returns(Q({ key: 'value' })) },
                resolver = new ResponseResolver(stubs, proxy),
                logger = Logger.create(),
                response = {
                    proxy: {
                        to: 'where',
                        predicateGenerators: [{ matches: { key: true } }]
                    }
                },
                request = { key: { nested: { first: 'one', second: 'two' }, third: 'three' } };

            stubs.addStub({ responses: [response] } as any);
            const responseConfig = stubs.getResponseFor({}, logger, {});

            return resolver.resolve(responseConfig, request, logger, {}).then(() => {
                assert.deepEqual(stubList(stubs), [
                    {
                        _uuid: 'stub',
                        predicates: [{
                            deepEquals: {
                                key: {
                                    nested: { first: 'one', second: 'two' },
                                    third: 'three'
                                }
                            }
                        }],
                        responses: [{ is: { key: 'value' } }]
                    },
                    {
                        _uuid: 'stub',
                        responses: [{
                            proxy: { to: 'where', mode: 'proxyOnce', predicateGenerators: [{ matches: { key: true } }] }
                        }]
                    }
                ]);
            });
        });

        it('should resolve "proxy" and remember nested keys as "equals" predicates', function () {
            const proxy = { to: mock().returns(Q({ key: 'value' })) },
                resolver = new ResponseResolver(stubs, proxy),
                logger = Logger.create(),
                response = {
                    proxy: {
                        to: 'where',
                        mode: 'proxyOnce',
                        predicateGenerators: [{ matches: { key: { nested: { first: true } } } }]
                    }
                },
                request = { key: { nested: { first: 'one', second: 'two' }, third: 'three' } };

            stubs.addStub({ responses: [response] } as any);
            const responseConfig = stubs.getResponseFor({}, logger, {});

            return resolver.resolve(responseConfig, request, logger, {}).then(() => {
                assert.deepEqual(stubList(stubs), [
                    {
                        _uuid: 'stub',
                        predicates: [{ equals: { key: { nested: { first: 'one' } } } }],
                        responses: [{ is: { key: 'value' } }]
                    },
                    {
                        _uuid: 'stub',
                        responses: [{
                            proxy: {
                                to: 'where',
                                mode: 'proxyOnce',
                                predicateGenerators: [{ matches: { key: { nested: { first: true } } } }]
                            }
                        }]
                    }
                ]);
            });
        });

        it('should add predicate parameters from predicateGenerators', function () {
            const proxy = { to: mock().returns(Q({ key: 'value' })) },
                resolver = new ResponseResolver(stubs, proxy),
                logger = Logger.create(),
                response = {
                    proxy: {
                        to: 'where',
                        mode: 'proxyOnce',
                        predicateGenerators: [{
                            matches: { key: true },
                            caseSensitive: true,
                            except: 'xxx'
                        }]
                    }
                },
                request = { key: 'Test' };

            stubs.addStub({ responses: [response] } as any);
            const responseConfig = stubs.getResponseFor({}, logger, {});

            return resolver.resolve(responseConfig, request, logger, {}).then(() => {
                assert.deepEqual(stubList(stubs), [
                    {
                        _uuid: 'stub',
                        predicates: [{
                            deepEquals: { key: 'Test' },
                            caseSensitive: true,
                            except: 'xxx'
                        }],
                        responses: [{ is: { key: 'value' } }]
                    },
                    {
                        _uuid: 'stub',
                        responses: [response]
                    }
                ]);
            });
        });

        it('should choose predicate operator from predicateGenerators', function () {
            const proxy = { to: mock().returns(Q({ key: 'value' })) },
                resolver = new ResponseResolver(stubs, proxy),
                logger = Logger.create(),
                response = {
                    proxy: {
                        to: 'where',
                        mode: 'proxyOnce',
                        predicateGenerators: [{
                            matches: { key: true },
                            predicateOperator: 'contains'
                        }]
                    }
                },
                request = { key: 'Test' };

            stubs.addStub({ responses: [response] } as any);
            const responseConfig = stubs.getResponseFor({}, logger, {});


            return resolver.resolve(responseConfig, request, logger, {}).then(() => {
                assert.deepEqual(stubList(stubs), [
                    {
                        _uuid: 'stub',
                        predicates: [{
                            contains: { key: 'Test' }
                        }],
                        responses: [{ is: { key: 'value' } }]
                    },
                    {
                        _uuid: 'stub',
                        responses: [response]
                    }
                ]);
            });
        });

        it('should format exists matcher from predicateOperator', function () {
            const proxy = { to: mock().returns(Q({ key: 'value' })) },
                resolver = new ResponseResolver(stubs, proxy),
                logger = Logger.create(),
                response = {
                    proxy: {
                        to: 'where',
                        mode: 'proxyOnce',
                        predicateGenerators: [{
                            matches: { key: true },
                            predicateOperator: 'exists'
                        }]
                    }
                },
                request = { key: 'Test' };

            stubs.addStub({ responses: [response] } as any);
            const responseConfig = stubs.getResponseFor({}, logger, {});


            return resolver.resolve(responseConfig, request, logger, {}).then(() => {
                assert.deepEqual(stubList(stubs), [
                    {
                        _uuid: 'stub',
                        predicates: [{
                            exists: { key: true }
                        }],
                        responses: [{ is: { key: 'value' } }]
                    },
                    {
                        _uuid: 'stub',
                        responses: [response]
                    }
                ]);
            });
        });

        it('should format exists matcher from predicateOperator with nested match', function () {
            const proxy = {to: mock().returns(Q({key: 'value'}))};
            const resolver = new ResponseResolver(stubs, proxy);
            const logger = Logger.create();
            const response = {
                proxy: {
                    to: 'where',
                    mode: 'proxyOnce',
                    predicateGenerators: [{
                        matches: {key: {nested: true}},
                        predicateOperator: 'exists'
                    }]
                }
            };
            const request = {key: {nested: 'Test'}};

            stubs.addStub({ responses: [response] } as any);
            const responseConfig = stubs.getResponseFor({}, logger, {});


            return resolver.resolve(responseConfig, request, logger, {}).then(() => {
                assert.deepEqual(stubList(stubs), [
                    {
                        _uuid: 'stub',
                        predicates: [{
                            exists: { key: { nested: true } }
                        }],
                        responses: [{ is: { key: 'value' } }]
                    },
                    {
                        _uuid: 'stub',
                        responses: [response]
                    }
                ]);
            });
        });


        it('should support "inject" predicateGenerators', function () {
            const proxy = { to: mock().returns(Q({ key: 'value' })) },
                resolver = new ResponseResolver(stubs, proxy),
                logger = Logger.create(),
                response = {
                    proxy: {
                        to: 'where',
                        mode: 'proxyOnce',
                        predicateGenerators: [{
                            inject: 'function(config) { return [{ deepEquals: config.request, caseSensitive: true }, { not: { equals: { foo: "bar" }}}]; }'
                        }]
                    }
                },
                request = { key: 'Test' };

            stubs.addStub({ responses: [response] } as any);
            const responseConfig = stubs.getResponseFor({}, logger, {});

            return resolver.resolve(responseConfig, request, logger, {}).then(() => {
                assert.deepEqual(stubList(stubs), [
                    {
                        _uuid: 'stub',
                        predicates: [{
                            deepEquals: { key: 'Test' },
                            caseSensitive: true
                        }, {
                            not: {
                                equals: { foo: 'bar' }
                            }
                        }],
                        responses: [{ is: { key: 'value' } }]
                    },
                    {
                        _uuid: 'stub',
                        responses: [response]
                    }
                ]);
            });
        });

        it('should log "inject" predicateGenerator exceptions', function () {
            const errorsLogged: any[] = [];
            const proxy = {to: mock().returns(Q({key: 'value'}))};
            const resolver = new ResponseResolver(stubs, proxy);
            const logger = Logger.create();
            const response = {
                proxy: {
                    to: 'where',
                    mode: 'proxyOnce',
                    predicateGenerators: [{
                        inject: 'function(config) { throw Error("BOOM!!!"); }'
                    }]
                }
            };
            const request = {key: 'Test'};

            logger.error = function () {
                const message = util.format.apply(this, Array.prototype.slice.call(arguments));
                errorsLogged.push(message);
            };

            stubs.addStub({ responses: [response] } as any);
            const responseConfig = stubs.getResponseFor({}, logger, {});

            return resolver.resolve(responseConfig, request, logger, {}).then(() => {
                assert.fail('should have thrown exception');
            }).catch(error => {
                assert.strictEqual(error.message, 'invalid predicateGenerator injection');
                assert.ok(errorsLogged.indexOf('injection X=> Error: BOOM!!!') >= 0);
            });
        });

        it('should add xpath predicate parameter in predicateGenerators with one match', function () {
            const proxy = { to: mock().returns(Q({ key: 'value' })) },
                resolver = new ResponseResolver(stubs, proxy),
                logger = Logger.create(),
                response = {
                    proxy: {
                        to: 'where',
                        predicateGenerators: [{
                            matches: { field: true },
                            xpath: { selector: '//title' }
                        }]
                    }
                },
                request = { field: '<books><book><title>Harry Potter</title></book></books>' };

            stubs.addStub({ responses: [response] } as any);
            const responseConfig = stubs.getResponseFor({}, logger, {});

            return resolver.resolve(responseConfig, request, logger, {}).then(() => {
                assert.deepEqual(stubList(stubs), [
                    {
                        _uuid: 'stub',
                        predicates: [{
                            deepEquals: { field: 'Harry Potter' },
                            xpath: { selector: '//title' }
                        }],
                        responses: [{ is: { key: 'value' } }]
                    },
                    {
                        _uuid: 'stub',
                        responses: [response]
                    }
                ]);
            });
        });

        it('should add xpath predicate parameter in predicateGenerators with one match and a nested match key', function () {
            const proxy = { to: mock().returns(Q({ key: 'value' })) },
                resolver = new ResponseResolver(stubs, proxy),
                logger = Logger.create(),
                response = {
                    proxy: {
                        to: 'where',
                        predicateGenerators: [{
                            matches: { parent: { child: true } },
                            xpath: { selector: '//title' }
                        }]
                    }
                },
                request = { parent: { child: '<books><book><title>Harry Potter</title></book></books>' } };

            stubs.addStub({ responses: [response] } as any);
            const responseConfig = stubs.getResponseFor({}, logger, {});

            return resolver.resolve(responseConfig, request, logger, {}).then(() => {
                assert.deepEqual(stubList(stubs), [
                    {
                        _uuid: 'stub',
                        predicates: [{
                            equals: { parent: { child: 'Harry Potter' } },
                            xpath: { selector: '//title' }
                        }],
                        responses: [{ is: { key: 'value' } }]
                    },
                    {
                        _uuid: 'stub',
                        responses: [response]
                    }
                ]);
            });
        });

        it('should add xpath predicate parameter in predicateGenerators with multiple matches', function () {
            const proxy = { to: mock().returns(Q({ key: 'value' })) },
                resolver = new ResponseResolver(stubs, proxy),
                logger = Logger.create(),
                response = {
                    proxy: {
                        to: 'where',
                        predicateGenerators: [{
                            matches: { field: true },
                            xpath: {
                                selector: '//isbn:title',
                                ns: { isbn: 'http://schemas.isbn.org/ns/1999/basic.dtd' }
                            }
                        }]
                    }
                },
                xml = '<root xmlns:isbn="http://schemas.isbn.org/ns/1999/basic.dtd">' +
                      '  <isbn:book><isbn:title>Harry Potter</isbn:title></isbn:book>' +
                      '  <isbn:book><isbn:title>The Hobbit</isbn:title></isbn:book>' +
                      '  <isbn:book><isbn:title>Game of Thrones</isbn:title></isbn:book>' +
                      '</root>',
                request = { field: xml };

            stubs.addStub({ responses: [response] } as any);
            const responseConfig = stubs.getResponseFor({}, logger, {});

            return resolver.resolve(responseConfig, request, logger, {}).then(() => {
                assert.deepEqual(stubList(stubs), [
                    {
                        _uuid: 'stub',
                        predicates: [{
                            deepEquals: { field: ['Harry Potter', 'The Hobbit', 'Game of Thrones'] },
                            xpath: {
                                selector: '//isbn:title',
                                ns: { isbn: 'http://schemas.isbn.org/ns/1999/basic.dtd' }
                            }
                        }],
                        responses: [{ is: { key: 'value' } }]
                    },
                    {
                        _uuid: 'stub',
                        responses: [response]
                    }
                ]);
            });
        });

        it('should add xpath predicate parameter in predicateGenerators even if no xpath match', function () {
            const proxy = { to: mock().returns(Q({ key: 'value' })) },
                resolver = new ResponseResolver(stubs, proxy),
                logger = Logger.create(),
                response = {
                    proxy: {
                        to: 'where',
                        predicateGenerators: [{
                            matches: { field: true },
                            xpath: { selector: '//title' }
                        }]
                    }
                },
                request = { field: '<books />' };

            stubs.addStub({ responses: [response] } as any);
            const responseConfig = stubs.getResponseFor({}, logger, {});

            return resolver.resolve(responseConfig, request, logger, {}).then(() => {
                assert.deepEqual(stubList(stubs), [
                    {
                        _uuid: 'stub',
                        predicates: [{
                            deepEquals: { field: '' },
                            xpath: { selector: '//title' }
                        }],
                        responses: [{ is: { key: 'value' } }]
                    },
                    {
                        _uuid: 'stub',
                        responses: [response]
                    }
                ]);
            });
        });

        it('should add xpath predicate parameter in predicateGenerators even if scalar xpath match', function () {
            const proxy = { to: mock().returns(Q({ key: 'value' })) },
                resolver = new ResponseResolver(stubs, proxy),
                logger = Logger.create(),
                response = {
                    proxy: {
                        to: 'where',
                        predicateGenerators: [{
                            matches: { field: true },
                            xpath: { selector: 'count(//title)' }
                        }]
                    }
                },
                request = { field: '<doc><title>first</title><title>second</title></doc>' };

            stubs.addStub({ responses: [response] } as any);
            const responseConfig = stubs.getResponseFor({}, logger, {});

            return resolver.resolve(responseConfig, request, logger, {}).then(() => {
                assert.deepEqual(stubList(stubs), [
                    {
                        _uuid: 'stub',
                        predicates: [{
                            deepEquals: { field: 2 },
                            xpath: { selector: 'count(//title)' }
                        }],
                        responses: [{ is: { key: 'value' } }]
                    },
                    {
                        _uuid: 'stub',
                        responses: [response]
                    }
                ]);
            });
        });

        it('should add xpath predicate parameter in predicateGenerators even if boolean match', function () {
            const proxy = { to: mock().returns(Q({ key: 'value' })) },
                resolver = new ResponseResolver(stubs, proxy),
                logger = Logger.create(),
                response = {
                    proxy: {
                        to: 'where',
                        predicateGenerators: [{
                            matches: { field: true },
                            xpath: { selector: 'boolean(//title)' }
                        }]
                    }
                },
                request = { field: '<doc></doc>' };

            stubs.addStub({ responses: [response] } as any);
            const responseConfig = stubs.getResponseFor({}, logger, {});

            return resolver.resolve(responseConfig, request, logger, {}).then(() => {
                assert.deepEqual(stubList(stubs), [
                    {
                        _uuid: 'stub',
                        predicates: [{
                            deepEquals: { field: false },
                            xpath: { selector: 'boolean(//title)' }
                        }],
                        responses: [{ is: { key: 'value' } }]
                    },
                    {
                        _uuid: 'stub',
                        responses: [response]
                    }
                ]);
            });
        });

        it('should add jsonpath predicate parameter in predicateGenerators with one match', function () {
            const proxy = { to: mock().returns(Q({ key: 'value' })) },
                resolver = new ResponseResolver(stubs, proxy),
                logger = Logger.create(),
                response = {
                    proxy: {
                        to: 'where',
                        predicateGenerators: [{
                            matches: { field: true },
                            jsonpath: { selector: '$..title' }
                        }]
                    }
                },
                request = { field: { title: 'Harry Potter' } };

            stubs.addStub({ responses: [response] } as any);
            const responseConfig = stubs.getResponseFor({}, logger, {});

            return resolver.resolve(responseConfig, request, logger, {}).then(() => {
                assert.deepEqual(stubList(stubs), [
                    {
                        _uuid: 'stub',
                        predicates: [{
                            deepEquals: { field: 'Harry Potter' },
                            jsonpath: { selector: '$..title' }
                        }],
                        responses: [{ is: { key: 'value' } }]
                    },
                    {
                        _uuid: 'stub',
                        responses: [response]
                    }
                ]);
            });
        });

        it('should add jsonpath predicate parameter in predicateGenerators with multiple matches', function () {
            const proxy = { to: mock().returns(Q({ key: 'value' })) },
                resolver = new ResponseResolver(stubs, proxy),
                logger = Logger.create(),
                response = {
                    proxy: {
                        to: 'where',
                        predicateGenerators: [{
                            matches: { field: true },
                            jsonpath: { selector: '$.books[*].title' }
                        }]
                    }
                },
                request = {
                    field: {
                        books: [
                            { title: 'Harry Potter' },
                            { title: 'The Hobbit' },
                            { title: 'Game of Thrones' }
                        ]
                    }
                };

            stubs.addStub({ responses: [response] } as any);
            const responseConfig = stubs.getResponseFor({}, logger, {});

            return resolver.resolve(responseConfig, request, logger, {}).then(() => {
                assert.deepEqual(stubList(stubs), [
                    {
                        _uuid: 'stub',
                        predicates: [{
                            deepEquals: { field: ['Harry Potter', 'The Hobbit', 'Game of Thrones'] },
                            jsonpath: { selector: '$.books[*].title' }
                        }],
                        responses: [{ is: { key: 'value' } }]
                    },
                    {
                        _uuid: 'stub',
                        responses: [response]
                    }
                ]);
            });
        });

        it('should add jsonpath predicate parameter in predicateGenerators with no match', function () {
            const proxy = { to: mock().returns(Q({ key: 'value' })) },
                resolver = new ResponseResolver(stubs, proxy),
                logger = Logger.create(),
                response = {
                    proxy: {
                        to: 'where',
                        predicateGenerators: [{
                            matches: { field: true },
                            jsonpath: { selector: '$..title' }
                        }]
                    }
                },
                request = { field: false };

            stubs.addStub({ responses: [response] } as any);
            const responseConfig = stubs.getResponseFor({}, logger, {});

            return resolver.resolve(responseConfig, request, logger, {}).then(() => {
                assert.deepEqual(stubList(stubs), [
                    {
                        _uuid: 'stub',
                        predicates: [{
                            deepEquals: { field: '' },
                            jsonpath: { selector: '$..title' }
                        }],
                        responses: [{ is: { key: 'value' } }]
                    },
                    {
                        _uuid: 'stub',
                        responses: [response]
                    }
                ]);
            });
        });

        it('should log warning if request not JSON', function () {
            const proxy = { to: mock().returns(Q({ key: 'value' })) },
                resolver = new ResponseResolver(stubs, proxy),
                logger = Logger.create(),
                response = {
                    proxy: {
                        to: 'where',
                        predicateGenerators: [{
                            matches: { field: true },
                            jsonpath: { selector: '$..title' }
                        }]
                    }
                },
                request = { field: 'Hello, world' };

            stubs.addStub({ responses: [response] } as any);
            const responseConfig = stubs.getResponseFor({}, logger, {});

            return resolver.resolve(responseConfig, request, logger, {}).then(() => {
                assert.deepEqual(stubList(stubs), [
                    {
                        _uuid: 'stub',
                        predicates: [{
                            deepEquals: { field: '' },
                            jsonpath: { selector: '$..title' }
                        }],
                        responses: [{ is: { key: 'value' } }]
                    },
                    {
                        _uuid: 'stub',
                        responses: [response]
                    }
                ]);
                logger.warn.assertLogged('Cannot parse as JSON: "Hello, world"');
            });
        });

        it('should allow "inject" response', function () {
            const resolver = new ResponseResolver(stubs, {} as any);
            const logger = Logger.create();
            const fn = (request:any) => request.data + ' injected';
            const responseConfig = {inject: fn.toString()};
            const request = {data: 'request'};

            return resolver.resolve(responseConfig, request, logger, {}).then(response => {
                assert.strictEqual(response, 'request injected');
            });
        });

        it('should log injection exceptions', function () {
            const resolver = new ResponseResolver(stubs, {} as any);
            const logger = Logger.create();
            const fn = () => {
                throw Error('BOOM!!!');
            };
            const responseConfig: any = {inject: fn};

            return resolver.resolve(responseConfig, {}, logger, {}).then(() => {
                assert.fail('should not have resolved');
            }, (error: any) => {
                assert.strictEqual(error.message, 'invalid response injection');
                logger.error.assertLogged('injection X=> Error: BOOM!!!');
            });
        });

        it('should allow injection request state across calls to resolve', function () {
            const stubs = new StubRepository('utf8');
            const resolver = new ResponseResolver(stubs, {} as any);
            const logger = Logger.create();
            const fn = (request: any, state: any) => {
                state.counter = state.counter || 0;
                state.counter += 1;
                return state.counter;
            };
            const responseConfig = {inject: fn.toString()};
            const request = {key: 'request'};

            return resolver.resolve(responseConfig, request, logger, {}).then(response => {
                assert.strictEqual(response, 1);
                return resolver.resolve(responseConfig, request, logger, []);
            }).then((response: any) => {
                assert.strictEqual(response, 2);
            });
        });

        it('should allow injection imposter state across calls to resolve', function () {
            const stubs = new StubRepository('utf8');
            const resolver = new ResponseResolver(stubs, {} as any);
            const mockedLogger = Logger.create();
            const imposterState = {foo: 'bar', counter: 0};
            const fn = (request: any, localState: any, logger: any, deferred: any, globalState: any) => {
                globalState.foo = 'barbar';
                globalState.counter += 1;
                return globalState.foo + globalState.counter;
            };
            const responseConfig = {inject: fn.toString()};
            const request = {key: 'request'};

            return resolver.resolve(responseConfig, request, mockedLogger, imposterState).then((response: any) => {
                assert.strictEqual(response, 'barbar1');
                return resolver.resolve(responseConfig, request, mockedLogger, imposterState);
            }).then((response: any) => {
                assert.strictEqual(response, 'barbar2');
            });
        });

        it('should allow wait behavior', function () {
            const start = Date.now();

            const stubs = new StubRepository('utf8');
            const resolver = new ResponseResolver(stubs, {} as any);
            const logger = Logger.create();
            const responseConfig: any = {
                is: 'value',
                _behaviors: {wait: 50}
            };
            const request = {key: 'request'};

            return resolver.resolve(responseConfig, request, logger, {}).then(() => {
                const end = Date.now();
                const elapsed = end - start;

                // allow some approximation
                assert.ok(elapsed >= 45, 'Did not wait longer than 50 ms, only waited for ' + elapsed);
            });
        });

        it('should allow wait behavior based on a function', function () {
            const start = Date.now();

            const stubs = new StubRepository('utf8');
            const resolver = new ResponseResolver(stubs, {} as any);
            const logger = Logger.create();
            const fn = () => 50;
            const responseConfig = {
                is: 'value',
                _behaviors: {wait: fn.toString()}
            };
            const request = {key: 'request'};

            return resolver.resolve(responseConfig, request, logger, {}).then(() => {
                const end = Date.now();
                const elapsed = end - start;

                // allow for some lack of precision
                assert.ok(elapsed >= 48, 'Did not wait longer than 50 ms, only waited for ' + elapsed);
            });
        });

        it('should reject the promise when the wait function fails', function () {
            const stubs = new StubRepository('utf8');
            const resolver = new ResponseResolver(stubs, {} as any);
            const logger = Logger.create();
            const fn = () => {
                throw new Error('Error message');
            };
            const responseConfig = {
                is: 'value',
                _behaviors: {wait: fn.toString()}
            };
            const request = {key: 'request'};

            return resolver.resolve(responseConfig, request, logger, {}).then(() => {
                assert.fail('Promise resolved, should have been rejected');
            }, error => {
                assert.equal(error.message, 'invalid wait injection');
            });
        });

        it('should allow asynchronous injection', function () {
            const stubs = new StubRepository('utf8');
            const resolver = new ResponseResolver(stubs, {} as any);
            const fn = (request: any, state: any, logger: any, callback: any) => {
                setTimeout(() => {
                    callback('value');
                }, 1);
            };
            const responseConfig: any = {inject: fn};
            const request = {key: 'request'};

            return resolver.resolve(responseConfig, request, { debug: jest.fn() } as any, {}).then((response) => {
                assert.strictEqual(response, 'value');
            });
        });

        it('should not be able to change state through inject', function () {
            const stubs = new StubRepository('utf8');
            const resolver = new ResponseResolver(stubs, {} as any);
            const logger = Logger.create();
            const fn = (request: any) => {
                request.key = 'CHANGED';
                return 0;
            };
            const responseConfig = {inject: fn.toString()};
            const request = {key: 'ORIGINAL'};

            return resolver.resolve(responseConfig, request, logger, {}).then(() => {
                assert.strictEqual(request.key, 'ORIGINAL');
            });
        });

        it('should not run injection during dry run validation', function () {
            const stubs = new StubRepository('utf8');
            const resolver = new ResponseResolver(stubs, {} as any);
            const logger = Logger.create();
            const fn = () => {
                throw Error('BOOM!!!');
            };
            const responseConfig: any = {inject: fn.toString()};
            const request = {isDryRun: true};

            return resolver.resolve(responseConfig, request, logger, {}).then((response: any) => {
                assert.deepEqual(response, {});
            });
        });

        it('should throw error if multiple response types given', function () {
            const stubs = new StubRepository('utf8');
            const resolver = new ResponseResolver(stubs, {} as any);
            const logger = Logger.create();
            const responseConfig: any = {is: 'value', proxy: {to: 'http://www.google.com'}};

            return resolver.resolve(responseConfig, {}, logger, {}).then(() => {
                assert.fail('should not have resolved');
            }, error => {
                assert.strictEqual(error.message, 'each response object must have only one response type');
            });
        });
    });

    describe('#resolveProxy', function () {
        function jsonResponse (response: any) {
            delete response.recordMatch;
            if (helpers.defined(response._proxyResponseTime)) { // eslint-disable-line no-underscore-dangle
                delete response._proxyResponseTime; // eslint-disable-line no-underscore-dangle
            }
            return response;
        }

        function matches (stubs: any) {
            const matchList = stubs.stubs().map((stub: any) => stub.matches || []);
            matchList.forEach((matchesForOneStub: any) => {
                matchesForOneStub.forEach((match: any) => {
                    if (match.timestamp) {
                        match.timestamp = 'NOW';
                    }
                });
            });
            return matchList;
        }

        it('should error if called with invalid proxyResolutionKey', function () {
            const stubs = new StubRepository('utf8');
            const resolver = new ResponseResolver(stubs, null, 'CALLBACK-URL');
            const logger = Logger.create();

            return resolver.resolveProxy({ field: 'value' } as any, 0, logger).then(() => {
                assert.fail('should have errored');
            }, error => {
                assert.deepEqual(error, {
                    code: 'no such resource',
                    message: 'invalid proxy resolution key',
                    source: 'CALLBACK-URL/0'
                });
                logger.error.assertLogged('Invalid proxy resolution key: 0');
            });
        });

        it('should save new response in front of proxy for "proxyOnce" mode', function () {
            const stubs = new StubRepository('utf8');
            const resolver = new ResponseResolver(stubs, null, 'CALLBACK-URL');
            const logger = Logger.create();
            const responseConfig = {proxy: {to: 'where', mode: 'proxyOnce'}};
            const request = {};

            stubs.addStub({ responses: [responseConfig] } as any);

            return resolver.resolve(responseConfig, request, logger, {}).then((response: any) => {
                const proxyResolutionKey = parseInt(response.callbackURL.replace('CALLBACK-URL/', ''));

                return resolver.resolveProxy({ data: 'RESPONSE' } as any, proxyResolutionKey, logger);
            }).then(response => {
                assert.deepEqual(jsonResponse(response), { data: 'RESPONSE' });
                const stubResponses = stubs.stubs().map(stub => proxyResponses(stub.responses!));
                assert.deepEqual(stubResponses, [
                    [{ is: { data: 'RESPONSE' } }],
                    [responseConfig]
                ]);
            });
        });

        it('should save new response after proxy for "proxyAlways" mode', function () {
            const stubs = new StubRepository('utf8');
            const resolver = new ResponseResolver(stubs, null, 'CALLBACK-URL');
            const logger = Logger.create();
            const responseConfig: any = {proxy: {to: 'where', mode: 'proxyAlways'}};
            const request: any = {};

            stubs.addStub({ responses: [responseConfig] } as any);

            return resolver.resolve(responseConfig, request, logger, {}).then((response) => {
                const proxyResolutionKey = parseInt(response.callbackURL!.replace('CALLBACK-URL/', ''));

                return resolver.resolveProxy({ data: 'RESPONSE' } as any, proxyResolutionKey, logger);
            }).then(response => {
                assert.deepEqual(jsonResponse(response), { data: 'RESPONSE' });
                const stubResponses = stubs.stubs().map(stub => proxyResponses(stub.responses!));
                assert.deepEqual(stubResponses, [
                    [responseConfig],
                    [{ is: { data: 'RESPONSE' } }]
                ]);
            });
        });

        it('should run behaviors from original proxy config on proxy response before recording it', function () {
            const decorateFunc = (request: any, response: any) => {
                response.data += '-DECORATED';
            };
            const stubs = new StubRepository('utf8');
            const resolver = new ResponseResolver(stubs, null, 'CALLBACK-URL');
            const logger = Logger.create();
            const proxyResponse = {
                proxy: {to: 'where', mode: 'proxyOnce'},
                _behaviors: {decorate: decorateFunc.toString()}
            };
            const request = {};

            stubs.addStub({ responses: [proxyResponse] } as any);
            const responseConfig = stubs.getResponseFor({}, logger, {});

            return resolver.resolve(responseConfig, request, logger, {}).then(response => {
                const proxyResolutionKey = parseInt(response.callbackURL!.replace('CALLBACK-URL/', ''));

                return resolver.resolveProxy({ data: 'RESPONSE' } as any, proxyResolutionKey, logger);
            }).then(response => {
                assert.deepEqual(jsonResponse(response), { data: 'RESPONSE-DECORATED' });
                const stubResponses = stubs.stubs().map(stub => proxyResponses(stub.responses!));
                assert.deepEqual(stubResponses, [
                    [{ is: { data: 'RESPONSE-DECORATED' } }],
                    [proxyResponse]
                ]);
            });
        });

        it('should add wait behavior based on the proxy resolution time', function () {
            const stubs = new StubRepository('utf8'),
                resolver = new ResponseResolver(stubs, null, 'CALLBACK-URL'),
                logger = Logger.create(),
                proxyResponse = { proxy: { to: 'where', mode: 'proxyOnce', addWaitBehavior: true } },
                request = {};

            stubs.addStub({ responses: [proxyResponse] } as any);
            const responseConfig = stubs.getResponseFor({}, logger, {});

            return resolver.resolve(responseConfig, request, logger, {}).then(response => {
                const proxyResolutionKey = parseInt(response.callbackURL!.replace('CALLBACK-URL/', ''));
                return Q.delay(proxyResolutionKey, 100);
            }).then(proxyResolutionKey =>
                resolver.resolveProxy({ data: 'RESPONSE' } as any, proxyResolutionKey, logger)
            ).then(() => {
                const stubResponses = stubs.stubs().map(stub => stub.responses),
                    wait = stubResponses[0]![0].is._proxyResponseTime; // eslint-disable-line no-underscore-dangle
                assert.ok(wait > 90); // allow some variability
                assert.deepEqual(stubResponses, [
                    [{ is: { data: 'RESPONSE', _proxyResponseTime: wait }, _behaviors: { wait: wait } }],
                    [proxyResponse]
                ]);
            });
        });

        it('should support recording the match', function () {
            const stubs = new StubRepository('utf8'),
                resolver = new ResponseResolver(stubs, null, 'CALLBACK-URL'),
                logger = Logger.create(),
                request = { key: 'REQUEST' };

            stubs.addStub({ responses: [{ proxy: { to: 'where', mode: 'proxyOnce' } }] } as any);

            // Call through the stubRepository to have it add the recordMatch function
            const responseConfig = stubs.getResponseFor(request, logger, {});
            return resolver.resolve(responseConfig, request, logger, {}).then(response => {
                const proxyResolutionKey = parseInt(response.callbackURL!.replace('CALLBACK-URL/', ''));

                return resolver.resolveProxy({ data: 'RESPONSE' } as any, proxyResolutionKey, logger);
            }).then(response => {
                response.recordMatch!();
                assert.deepEqual(matches(stubs), [
                    [],
                    [{ timestamp: 'NOW', request: { key: 'REQUEST' }, response: { data: 'RESPONSE' } }]
                ]);
            });
        });

        it('should avoid race conditions when recording the match', function () {
            const stubs = new StubRepository('utf8'),
                resolver = new ResponseResolver(stubs, null, 'CALLBACK-URL'),
                logger = Logger.create(),
                request = { key: 'REQUEST' };

            stubs.addStub({ responses: [{ proxy: { to: 'where', mode: 'proxyAlways' } }] } as any);

            // Call through the stubRepository to have it add the recordMatch function
            const responseConfig = stubs.getResponseFor({ key: 'REQUEST-1' }, logger, {});
            return resolver.resolve(responseConfig, request, logger, {}).then(response => {
                const proxyResolutionKey = parseInt(response.callbackURL!.replace('CALLBACK-URL/', ''));

                // Now call with a second request on the same stub before resolving the proxy
                stubs.getResponseFor({ key: 'REQUEST-2' }, logger, {});

                return resolver.resolveProxy({ data: 'RESPONSE' } as any, proxyResolutionKey, logger);
            }).then(response => {
                response.recordMatch!();
                assert.deepEqual(matches(stubs), [
                    [{ timestamp: 'NOW', request: { key: 'REQUEST-1' }, response: { data: 'RESPONSE' } }],
                    []
                ]);
            });
        });

        it('should not resolve the same proxyResolutionKey twice', function () {
            const stubs = new StubRepository('utf8');
            const resolver = new ResponseResolver(stubs, null, 'CALLBACK-URL');
            const logger = Logger.create();
            const proxyResponse = {proxy: {to: 'where'}};
            const request = {};
            let proxyResolutionKey: any;

            stubs.addStub({ responses: [proxyResponse] } as any);
            const responseConfig = stubs.getResponseFor({}, logger, {});

            return resolver.resolve(responseConfig, request, logger, {}).then(response => {
                proxyResolutionKey = parseInt(response.callbackURL!.replace('CALLBACK-URL/', ''));

                return resolver.resolveProxy({ data: 'RESPONSE' } as any, proxyResolutionKey, logger);
            }).then(() => resolver.resolveProxy({ data: 'RESPONSE' } as any, proxyResolutionKey, logger)).then(() => {
                assert.fail('should have errored');
            }, (error: any) => {
                assert.deepEqual(error, {
                    code: 'no such resource',
                    message: 'invalid proxy resolution key',
                    source: 'CALLBACK-URL/0'
                });
                logger.error.assertLogged('Invalid proxy resolution key: 0');
            });
        });
    });
});
