'use strict';

import {FakeResponse} from "../fakes/fakeResponse";
const mock = require('../mock').mock;
import {ImpostersController} from '../../src/controllers/impostersController';
const FakeLogger = require('../fakes/fakeLogger');
import * as Q from 'q';


describe('ImpostersController', function () {
    let response: FakeResponse;

    beforeEach(() => {
        response = new FakeResponse();
    });

    describe('#get', function () {
        it('should send an empty array if no imposters', function () {
            const controller = new ImpostersController({}, {}, undefined, false);

            controller.get({ url: '/imposters' } as any, response as any);

            expect(response.body).toEqual( { imposters: [] });
        });

        it('should send list JSON for all imposters by default', function () {
            const firstImposter = {toJSON: jest.fn().mockReturnValue('firstJSON')};
            const secondImposter = {toJSON: jest.fn().mockReturnValue('secondJSON')};
            const controller = new ImpostersController({}, {
                1: firstImposter,
                2: secondImposter
            } as any, undefined, false);

            controller.get({ url: '/imposters' } as any, response as any);

            expect(response.body).toEqual({ imposters: ['firstJSON', 'secondJSON'] });
            expect(firstImposter.toJSON).toHaveBeenCalledWith({ replayable: false, removeProxies: false, list: true });
            expect(secondImposter.toJSON).toHaveBeenCalledWith({ replayable: false, removeProxies: false, list: true });
        });

        it('should send replayable JSON for all imposters if querystring present', function () {
            const firstImposter = { toJSON: jest.fn().mockReturnValue('firstJSON') },
                secondImposter = { toJSON: jest.fn().mockReturnValue('secondJSON') },
                controller = new ImpostersController({}, { 1: firstImposter, 2: secondImposter } as any, undefined, false);

            controller.get({ url: '/imposters?replayable=true' } as any, response as any);

            expect(response.body).toEqual({ imposters: ['firstJSON', 'secondJSON'] });
            expect(firstImposter.toJSON).toHaveBeenCalledWith({ replayable: true, removeProxies: false, list: false });
            expect(secondImposter.toJSON).toHaveBeenCalledWith({ replayable: true, removeProxies: false, list: false });
        });

        it('should send replayable and removeProxies JSON for all imposters if querystring present', function () {
            const firstImposter = {toJSON: jest.fn().mockReturnValue('firstJSON')};
            const secondImposter = {toJSON: jest.fn().mockReturnValue('secondJSON')};
            const controller = new ImpostersController({}, {
                1: firstImposter,
                2: secondImposter
            } as any, undefined, false);

            controller.get({ url: '/imposters?replayable=true&removeProxies=true' } as any, response as any);

            expect(response.body).toEqual({ imposters: ['firstJSON', 'secondJSON'] });
            expect(firstImposter.toJSON).toHaveBeenCalledWith({ replayable: true, removeProxies: true, list: false });
            expect(secondImposter.toJSON).toHaveBeenCalledWith({ replayable: true, removeProxies: true, list: false });
        });
    });

    describe('#post', function () {
        let request: any;
        let imposter: any;
        let imposters: any;
        let Protocol: any;
        let controller: ImpostersController;
        let logger: any;

        beforeEach(() => {
            request = { body: {}, socket: { remoteAddress: 'host', remotePort: 'port' } };
            imposter = {
                url: 'imposter-url',
                toJSON: mock().returns('JSON')
            };
            imposters = {};
            Protocol = {
                name: 'http',
                Validator: {
                    create: jest.fn().mockReturnValue({ validate: jest.fn().mockReturnValue(Q({ isValid: true })) })
                },
                createImposterFrom: jest.fn().mockReturnValue(Q(imposter))
            };
            logger = FakeLogger.create();
            controller = new ImpostersController({ http: Protocol }, imposters, logger, false);
        });

        it('should return a 201 with the Location header set', function () {
            request.body = { port: 3535, protocol: 'http' };

            return controller.post(request, response as any).then(() => {
                expect(response.headers.Location).toEqual('imposter-url');
                expect(response.statusCode).toEqual(201);
            });
        });

        it('should return imposter JSON', function () {
            request.body = { port: 3535, protocol: 'http' };

            return controller.post(request, response as any).then(() => {
                expect(response.body).toEqual('JSON');
            });
        });

        it('should add new imposter to list of all imposters', function () {
            imposter.port = 3535;
            request.body = { protocol: 'http' };

            return controller.post(request, response as any).then(() => {
                expect(imposters).toEqual({ 3535: imposter });
            });
        });

        it('should return a 400 for a floating point port', function () {
            request.body = { protocol: 'http', port: '123.45' };

            return controller.post(request, response as any).then(() => {
                expect(response.statusCode).toEqual(400);
                expect(response.body).toEqual({
                    errors: [{
                        code: 'bad data',
                        message: "invalid value for 'port'"
                    }]
                });
            });
        });

        it('should return a 400 for a missing protocol', function () {
            request.body = { port: 3535 };

            return controller.post(request, response as any).then(() => {
                expect(response.statusCode).toEqual(400);
                expect(response.body).toEqual({
                    errors: [{
                        code: 'bad data',
                        message: "'protocol' is a required field"
                    }]
                });
            });
        });

        it('should return a 400 for unsupported protocols', function () {
            request.body = { port: 3535, protocol: 'unsupported' };

            return controller.post(request, response as any).then(() => {
                expect(response.statusCode).toEqual(400);
                expect(response.body.errors.length).toEqual(1);
                expect(response.body.errors[0].code).toEqual('bad data');
            });
        });

        it('should aggregate multiple errors', function () {
            request.body = { port: -1, protocol: 'invalid' };

            return controller.post(request, response as any).then(() => {
                expect(response.body.errors.length).toEqual(2);
            });
        });

        it('should return a 403 for insufficient access', function () {
            Protocol.createImposterFrom = jest.fn().mockReturnValue(Q.reject({
                code: 'insufficient access',
                key: 'value'
            }));
            request.body = { port: 3535, protocol: 'http' };

            return controller.post(request, response as any).then(() => {
                expect(response.statusCode).toEqual(403);
                expect(response.body).toEqual({
                    errors: [{
                        code: 'insufficient access',
                        key: 'value'
                    }]
                });
            });
        });

        it('should return a 400 for other protocol creation errors', function () {
            Protocol.createImposterFrom = jest.fn().mockReturnValue(Q.reject('ERROR'));
            request.body = { port: 3535, protocol: 'http' };

            return controller.post(request, response as any).then(() => {
                expect(response.statusCode).toEqual(400);
                expect(response.body).toEqual({ errors: ['ERROR'] });
            });
        });

        it('should not call protocol validation if there are common validation failures', function () {
            Protocol.Validator = { create: mock() };
            request.body = { protocol: 'invalid' };

            return controller.post(request, response as any).then(() => {
                expect(!Protocol.Validator.create.wasCalled());
            });
        });

        it('should validate with Protocol if there are no common validation failures', function () {
            Protocol.validate = jest.fn().mockReturnValue(Q(['ERRORS']));
            request.body = { port: 3535, protocol: 'http' };

            return controller.post(request, response as any).then(() => {
                expect(response.statusCode).toEqual(400);
                expect(response.body).toEqual({ errors: ['ERRORS'] });
            });
        });
    });

    describe('#del', function () {
        const stopMock = () => jest.fn().mockReturnValue(Q(true));

        it('should delete all imposters', function () {
            const firstImposter = { stop: stopMock(), toJSON: jest.fn().mockReturnValue('firstJSON') },
                secondImposter = { stop: stopMock(), toJSON: jest.fn().mockReturnValue('secondJSON') },
                imposters = { 1: firstImposter, 2: secondImposter },
                controller = new ImpostersController({}, imposters as any, undefined, false);

            return controller.del({ url: '/imposters' } as any, response as any).then(() => {
                expect(imposters).toEqual({});
            });
        });

        it('should call stop on all imposters', function () {
            const firstImposter = { stop: stopMock(), toJSON: jest.fn().mockReturnValue('firstJSON') },
                secondImposter = { stop: stopMock(), toJSON: jest.fn().mockReturnValue('secondJSON') },
                imposters = { 1: firstImposter, 2: secondImposter },
                controller = new ImpostersController({}, imposters as any, undefined, false);

            return controller.del({ url: '/imposters' } as any, response as any).then(() => {
                expect(firstImposter.stop).toHaveBeenCalled();
                expect(secondImposter.stop).toHaveBeenCalled();
            });
        });

        it('should send replayable JSON for all imposters by default', function () {
            const firstImposter = { stop: stopMock(), toJSON: jest.fn().mockReturnValue('firstJSON') },
                secondImposter = { stop: stopMock(), toJSON: jest.fn().mockReturnValue('secondJSON') },
                imposters = { 1: firstImposter, 2: secondImposter },
                controller = new ImpostersController({}, imposters as any, undefined, false);

            return controller.del({ url: '/imposters' } as any, response as any).then(() => {
                expect(response.body).toEqual({ imposters: ['firstJSON', 'secondJSON'] });
                expect(firstImposter.toJSON).toHaveBeenCalledWith({ replayable: true, removeProxies: false });
                expect(secondImposter.toJSON).toHaveBeenCalledWith({ replayable: true, removeProxies: false });
            });
        });

        it('should send default JSON for all imposters if replayable is false on querystring', function () {
            const firstImposter = {stop: stopMock(), toJSON: jest.fn().mockReturnValue('firstJSON')};
            const secondImposter = {stop: stopMock(), toJSON: jest.fn().mockReturnValue('secondJSON')};
            const controller = new ImpostersController({}, {1: firstImposter, 2: secondImposter} as any, undefined, false);

            return controller.del({ url: '/imposters?replayable=false' } as any, response as any).then(() => {
                expect(firstImposter.toJSON).toHaveBeenCalledWith({ replayable: false, removeProxies: false });
                expect(secondImposter.toJSON).toHaveBeenCalledWith({ replayable: false, removeProxies: false });
            });
        });

        it('should send removeProxies JSON for all imposters if querystring present', function () {
            const firstImposter = { stop: stopMock(), toJSON: jest.fn().mockReturnValue('firstJSON') },
                secondImposter = { stop: stopMock(), toJSON: jest.fn().mockReturnValue('secondJSON') },
                controller = new ImpostersController({}, { 1: firstImposter, 2: secondImposter } as any, undefined, false);

            return controller.del({ url: '/imposters?removeProxies=true' } as any, response as any).then(() => {
                expect(firstImposter.toJSON).toHaveBeenCalledWith({ replayable: true, removeProxies: true });
                expect(secondImposter.toJSON).toHaveBeenCalledWith({ replayable: true, removeProxies: true });
            });
        });
    });

    describe('#put', function () {
        let request: any;
        let logger: any;
        let Protocol: any;

        beforeEach(() => {
            request = { body: {}, socket: { remoteAddress: 'host', remotePort: 'port' } };
            logger = FakeLogger.create();
            Protocol = {
                name: 'http',
                Validator: {
                    create: jest.fn().mockReturnValue({ validate: jest.fn().mockReturnValue(Q({ isValid: true, errors: [] })) })
                }
            };
        });

        it('should return a 400 if the "imposters" key is not present', function () {
            const existingImposter = {stop: mock()};
            const imposters = {0: existingImposter};
            const controller = new ImpostersController({http: Protocol}, imposters as any, logger, false);

            request.body = {};

            return controller.put(request, response as any).then(() => {
                expect(response.statusCode).toEqual(400);
                expect(response.body).toEqual({
                    errors: [{
                        code: 'bad data',
                        message: "'imposters' is a required field"
                    }]
                });

                expect(imposters).toEqual({ 0: existingImposter });
            });
        });

        it('should return an empty array if no imposters provided', function () {
            const existingImposter = { stop: mock() },
                imposters = { 0: existingImposter },
                controller = new ImpostersController({ http: Protocol }, imposters as any, logger, false);
            request.body = { imposters: [] };

            return controller.put(request, response as any).then(() => {
                expect(response.body).toEqual({ imposters: [] });
                expect(imposters).toEqual({});
            });
        });

        it('should return imposter list JSON for all imposters', function () {
            let creates = 0;
            const firstImposter = { toJSON: jest.fn().mockReturnValue({ first: true }) },
                secondImposter = { toJSON: jest.fn().mockReturnValue({ second: true }) },
                imposters = [firstImposter, secondImposter],
                controller = new ImpostersController({ http: Protocol }, {}, logger, false);

            Protocol.createImposterFrom = () => {
                const result = imposters[creates];
                creates += 1;
                return result;
            };

            request.body = { imposters: [{ protocol: 'http' }, { protocol: 'http' }] };

            return controller.put(request, response as any).then(() => {
                expect(response.body).toEqual({ imposters: [{ first: true }, { second: true }] });
                expect(firstImposter.toJSON).toHaveBeenCalledWith({ list: true });
                expect(secondImposter.toJSON).toHaveBeenCalledWith({ list: true });
            });
        });

        it('should replace imposters list', function () {
            let creates = 0;
            const oldImposter = { stop: mock() },
                imposters = { 0: oldImposter },
                firstImposter = { toJSON: jest.fn().mockReturnValue({ first: true }), port: 1 },
                secondImposter = { toJSON: jest.fn().mockReturnValue({ second: true }), port: 2 },
                impostersToCreate = [firstImposter, secondImposter],
                controller = new ImpostersController({ http: Protocol }, imposters as any, logger, false);

            Protocol.createImposterFrom = () => {
                const result = impostersToCreate[creates];
                creates += 1;
                return result;
            };

            request.body = { imposters: [{ protocol: 'http' }, { protocol: 'http' }] };

            return controller.put(request, response as any).then(() => {
                expect(imposters).toEqual({ 1: firstImposter, 2: secondImposter });
                expect(firstImposter.toJSON).toHaveBeenCalledWith({ list: true });
                expect(secondImposter.toJSON).toHaveBeenCalledWith({ list: true });
            });
        });

        it('should return a 400 for any invalid imposter', function () {
            const controller = new ImpostersController({ http: Protocol }, {}, logger, false);

            request.body = { imposters: [{ protocol: 'http' }, {}] };

            return controller.put(request, response as any).then(() => {
                expect(response.statusCode).toEqual(400);
                expect(response.body).toEqual({
                    errors: [{
                        code: 'bad data',
                        message: "'protocol' is a required field"
                    }]
                });
            });
        });

        it('should return a 403 for insufficient access on any imposter', function () {
            let creates = 0;
            const controller = new ImpostersController({ http: Protocol }, {}, logger, false);
            Protocol.createImposterFrom = () => {
                creates += 1;
                if (creates === 2) {
                    return Q.reject({
                        code: 'insufficient access',
                        key: 'value'
                    });
                }
                else {
                    return Q({});
                }
            };

            request.body = { imposters: [{ protocol: 'http' }, { protocol: 'http' }] };

            return controller.put(request, response as any).then(() => {
                expect(response.statusCode).toEqual(403);
                expect(response.body).toEqual({
                    errors: [{
                        code: 'insufficient access',
                        key: 'value'
                    }]
                });
            });
        });
    });
});
