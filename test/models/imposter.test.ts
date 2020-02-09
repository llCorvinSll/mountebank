import { Imposter } from '../../src/models/imposters/imposter';
import * as Q from 'q';
import { IImposter } from '../../src/models/imposters/IImposter';
const FakeLogger = require('../fakes/fakeLogger');

function allow () { return true; }
function deny () { return false; }

describe('imposter', function () {
    describe('#create', function () {
        let Protocol: any;
        let metadata: any;
        let server: any;
        let logger: any;
        let stubs: any;

        beforeEach(() => {
            metadata = {};
            stubs = [];
            server = {
                stubs: {
                    addStub: (stub: any) => { stubs.push(stub); },
                    stubs: () => stubs,
                    getJSON: () => Q.resolve(stubs)
                },
                resolver: jest.fn(),
                port: 3535,
                metadata: metadata,
                close: jest.fn(),
                proxy: { to: jest.fn() },
                encoding: 'utf8'
            };
            Protocol = {
                testRequest: {},
                testProxyResponse: {},
                createServer: jest.fn().mockReturnValue(Q(server))
            };
            logger = FakeLogger.create();
        });

        it('should return url', function () {
            server.port = 3535;

            return new Imposter(Protocol, {}, logger, {}, allow).init().then(imposter => {
                expect(imposter.url).toEqual('/imposters/3535');
            });
        });

        it('should return trimmed down JSON for lists', function () {
            server.port = 3535;

            return new Imposter(Protocol, { protocol: 'test' }, logger, {}, allow)
                .init()
                .then(imposter => imposter.getJSON({ list: true }))
                .then(imposter => {
                    expect(imposter).toEqual({
                        protocol: 'test',
                        port: 3535,
                        numberOfRequests: 0,
                        _links: {
                            self: { href: '/imposters/3535' },
                            stubs: { href: '/imposters/3535/stubs' }
                        }
                    });
                });
        });

        it('should not display imposter level recordRequests from the global parameter', function () {
            server.port = 3535;

            return new Imposter(Protocol, { protocol: 'test' }, logger, { recordRequests: true }, allow)
                .init()
                .then(imposter => imposter.getJSON())
                .then(imposter => {
                    expect(imposter).toEqual({
                        protocol: 'test',
                        port: 3535,
                        numberOfRequests: 0,
                        recordRequests: false,
                        requests: [],
                        stubs: [],
                        _links: {
                            self: { href: '/imposters/3535' },
                            stubs: { href: '/imposters/3535/stubs' }
                        }
                    });
                });
        });

        it('imposter-specific recordRequests should override global parameter', function () {
            const request = {
                protocol: 'test',
                port: 3535,
                recordRequests: true
            };

            return new Imposter(Protocol, request, logger, { recordRequests: false }, allow)
                .init()
                .then(imposter => imposter.getJSON())
                .then(imposter => {
                    expect(imposter).toEqual({
                        protocol: 'test',
                        port: 3535,
                        numberOfRequests: 0,
                        recordRequests: true,
                        requests: [],
                        stubs: [],
                        _links: {
                            self: { href: '/imposters/3535' },
                            stubs: { href: '/imposters/3535/stubs' }
                        }
                    });
                });
        });

        it('should return full JSON representation by default', function () {
            server.port = 3535;

            return new Imposter(Protocol, { protocol: 'test' }, logger, {}, allow)
                .init()
                .then(imposter => imposter.getJSON())
                .then(imposter => {
                    expect(imposter).toEqual({
                        protocol: 'test',
                        port: 3535,
                        numberOfRequests: 0,
                        recordRequests: false,
                        requests: [],
                        stubs: [],
                        _links: {
                            self: { href: '/imposters/3535' },
                            stubs: { href: '/imposters/3535/stubs' }
                        }
                    });
                });
        });

        it('should add protocol metadata to JSON representation', function () {
            server.port = 3535;
            metadata.key = 'value';

            return new Imposter(Protocol, { protocol: 'test' }, logger, {}, allow)
                .init()
                .then(imposter => imposter.getJSON())
                .then(imposter => {
                    expect(imposter).toEqual({
                        protocol: 'test',
                        port: 3535,
                        numberOfRequests: 0,
                        recordRequests: false,
                        requests: [],
                        stubs: [],
                        key: 'value',
                        _links: {
                            self: { href: '/imposters/3535' },
                            stubs: { href: '/imposters/3535/stubs' }
                        }
                    });
                });
        });

        it('should provide replayable JSON representation', function () {
            server.port = 3535;
            metadata.key = 'value';

            return new Imposter(Protocol, { protocol: 'test' }, logger, {}, allow)
                .init()
                .then(imposter => imposter.getJSON({ replayable: true }))
                .then(imposter => {
                    expect(imposter).toEqual({
                        protocol: 'test',
                        port: 3535,
                        recordRequests: false,
                        stubs: [],
                        key: 'value'
                    });
                });
        });

        it('should create protocol server on provided port with options', function () {
            return new Imposter(Protocol, { key: 'value' } as any, logger, {}, allow).init().then(() => {
                expect(Protocol.createServer.mock.calls[0][0]).toEqual({ key: 'value' });
            });
        });

        it('should return list of stubs', function () {
            const request: any = {
                stubs: [{ responses: ['FIRST'] }, { responses: ['SECOND'] }]
            };
            return new Imposter(Protocol, request, logger, {}, allow)
                .init()
                .then(imposter => imposter.getJSON())
                .then(imposter => {
                    expect(imposter.stubs).toEqual([
                        {
                            responses: ['FIRST'],
                            _links: { self: { href: '/imposters/3535/stubs/0' } }
                        },
                        {
                            responses: ['SECOND'],
                            _links: { self: { href: '/imposters/3535/stubs/1' } }
                        }
                    ]);
                });
        });

        it('replayable JSON should remove stub matches and links', function () {
            const request: any = {
                protocol: 'test',
                port: 3535,
                stubs: [
                    {
                        responses: ['FIRST'],
                        matches: ['MATCH']
                    },
                    {
                        responses: ['SECOND'],
                        matches: ['MATCH']
                    }
                ]
            };

            return new Imposter(Protocol, request, logger, {}, allow)
                .init()
                .then(imposter => imposter.getJSON({ replayable: true }))
                .then(imposter => {
                    expect(imposter).toEqual({
                        protocol: 'test',
                        port: 3535,
                        recordRequests: false,
                        stubs: [{ responses: ['FIRST'] },
                            { responses: ['SECOND'] }]
                    });
                });
        });

        it('replayable JSON should remove _proxyResponseTime fields', function () {
            const request = {
                protocol: 'test',
                port: 3535,
                stubs: [{ responses: [{ is: { body: 'body', _proxyResponseTime: 3 } }] }]
            };

            return new Imposter(Protocol, request, logger, {}, allow)
                .init()
                .then(imposter => imposter.getJSON({ replayable: true }))
                .then(imposter => {
                    expect(imposter).toEqual({
                        protocol: 'test',
                        port: 3535,
                        recordRequests: false,
                        stubs: [{ responses: [{ is: { body: 'body' } }] }]
                    });
                });
        });

        it('should remove proxies from responses if asked', function () {
            const request: any = {
                stubs: [
                    {
                        responses: [
                            { proxy: { to: 'http://localhost:3000' } },
                            { is: { body: 'first' } },
                            { inject: 'inject' }
                        ]
                    },
                    {
                        responses: [
                            { is: { body: 'second' } }
                        ]
                    }
                ]
            };
            return new Imposter(Protocol, request, logger, {}, allow)
                .init()
                .then(imposter => imposter.getJSON({ removeProxies: true }))
                .then(imposter => {
                    expect(imposter.stubs).toEqual([
                        {
                            responses: [
                                { is: { body: 'first' } },
                                { inject: 'inject' }
                            ],
                            _links: { self: { href: '/imposters/3535/stubs/0' } }
                        },
                        {
                            responses: [
                                { is: { body: 'second' } }
                            ],
                            _links: { self: { href: '/imposters/3535/stubs/1' } }
                        }]);
                });
        });

        it('should remove empty stubs after proxy removal', function () {
            const request: any = {
                stubs: [
                    {
                        responses: [
                            { proxy: { to: 'http://localhost:3000' } },
                            { is: { body: 'first' } },
                            { inject: 'inject' }
                        ]
                    },
                    {
                        responses: [
                            { proxy: { to: 'http://localhost:3001' } }
                        ]
                    }
                ]
            };

            return new Imposter(Protocol, request, logger, {}, allow)
                .init()
                .then(imposter => imposter.getJSON({ removeProxies: true }))
                .then(imposter => {
                    expect(imposter.stubs).toEqual([
                        {
                            responses: [
                                { is: { body: 'first' } },
                                { inject: 'inject' }
                            ],
                            _links: { self: { href: '/imposters/3535/stubs/0' } }
                        }
                    ]);
                });
        });

        it('responseFor should resolve using stubs and resolver', function () {
            server.stubs.getResponseFor = jest.fn().mockReturnValue('RESPONSE CONFIG');
            server.resolver.resolve = jest.fn().mockReturnValue(Q({ is: 'RESPONSE' }));

            return new Imposter(Protocol, {}, logger, {}, allow).init().then(imposter =>
                imposter.getResponseFor({})
            ).then(response => {
                expect(response).toEqual({ is: 'RESPONSE' });
            });
        });

        it('responseFor should increment numberOfRequests and not record requests if recordRequests = false', function () {
            server.stubs.getResponseFor = jest.fn().mockReturnValue('RESPONSE CONFIG');
            server.resolver.resolve = jest.fn().mockReturnValue(Q({}));
            let imposter: IImposter;

            return new Imposter(Protocol, { recordRequests: false }, logger, { recordRequests: false }, allow)
                .init()
                .then(imp => {
                    imposter = imp;
                    return imposter.getResponseFor({});
                }).then(() => imposter.getJSON())
                .then(json => {
                    expect(json.numberOfRequests).toEqual(1);
                    expect(json.requests).toEqual([]);
                });
        });

        it('responseFor should increment numberOfRequests and record requests if imposter recordRequests = true', function () {
            server.stubs.getResponseFor = jest.fn().mockReturnValue('RESPONSE CONFIG');
            server.resolver.resolve = jest.fn().mockReturnValue(Q({}));
            let imposter: IImposter;

            return new Imposter(Protocol, { recordRequests: true }, logger, { recordRequests: false }, allow)
                .init()
                .then(imp => {
                    imposter = imp;
                    return imposter.getResponseFor({ request: 1 });
                })
                .then(() => imposter.getJSON())
                .then(json => {
                    expect(json.numberOfRequests).toEqual(1);
                    expect(json.requests.length).toEqual(1);
                });
        });

        it('responseFor should increment numberOfRequests and record requests if global recordRequests = true', function () {
            server.stubs.getResponseFor = jest.fn().mockReturnValue('RESPONSE');
            server.resolver.resolve = jest.fn().mockReturnValue(Q({}));
            let imposter: IImposter;

            return new Imposter(Protocol, { recordRequests: false }, logger, { recordRequests: true }, allow)
                .init()
                .then(imp => {
                    imposter = imp;
                    return imposter.getResponseFor({ request: 1 });
                })
                .then(() => imposter.getJSON())
                .then(json => {
                    expect(json.numberOfRequests).toEqual(1);
                    expect(json.requests.length).toEqual(1);
                });
        });

        it('responseFor should add timestamp to recorded request', function () {
            server.stubs.getResponseFor = jest.fn().mockReturnValue('RESPONSE');
            server.resolver.resolve = jest.fn().mockReturnValue(Q({}));
            let imposter: IImposter;

            return new Imposter(Protocol, {}, logger, { recordRequests: true }, allow).init().then(imp => {
                imposter = imp;
                return imposter.getResponseFor({ request: 1 });
            })
                .then(() => imposter.getJSON())
                .then(json => {
                    expect(Object.keys(json.requests[0]).sort()).toEqual(['request', 'timestamp']);
                    expect(json.requests[0].request).toEqual(1);
                });
        });

        it('responseFor should return error if ip check denied', function () {
            return new Imposter(Protocol, {}, logger, {}, deny).init().then(imposter =>
                imposter.getResponseFor({})
            ).then(response => {
                expect(response).toEqual({ blocked: true, code: 'unauthorized ip address' });
            });
        });
    });
});
