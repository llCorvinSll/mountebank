import {FakeResponse} from '../fakes/fakeResponse';
import * as Q from 'q';
import {ImposterController} from  '../../src/controllers/imposterController';
import {Request} from 'express';


describe('ImposterController', function () {
    let response: FakeResponse;

    beforeEach(() => {
        response = new FakeResponse();

    })

    describe('#get', function () {
        it('should return JSON for imposter at given id', function () {
            const imposters = {
                    1: { toJSON: jest.fn().mockReturnValue('firstJSON') },
                    2: { toJSON: jest.fn().mockReturnValue('secondJSON') }
                };
            const controller = new ImposterController({}, imposters as any);

            controller.get({ url: '/imposters/2', params: { id: 2 } } as unknown as Request, response as any);

            expect(response.body).toEqual('secondJSON');
        });

        it('should return replayable JSON for imposter at given id if replayable querystring set', function () {
            const imposters = {
                1: {toJSON: jest.fn().mockReturnValue('firstJSON') },
                2: {toJSON: jest.fn().mockReturnValue('secondJSON') }
            };
            const controller = new ImposterController({}, imposters as any);

            controller.get({ url: '/imposters/2?replayable=true', params: { id: 2 } } as any, response as any);

            expect(response.body).toEqual('secondJSON');
            expect(imposters[2].toJSON).toHaveBeenCalledWith({ replayable: true, removeProxies: false });
        });

        it('should return removeProxies JSON for imposter at given id if removeProxies querystring set', function () {
            const imposters = {
                    1: { toJSON: jest.fn().mockReturnValue('firstJSON') },
                    2: { toJSON: jest.fn().mockReturnValue('secondJSON') }
                },
                controller = new ImposterController({}, imposters as any);

            controller.get({ url: '/imposters/2?removeProxies=true', params: { id: 2 } } as any, response as any);

            expect(response.body).toEqual('secondJSON');
            expect(imposters['2'].toJSON).toHaveBeenCalledWith({ replayable: false, removeProxies: true });
        });

        it('should return replayable and removeProxies JSON for imposter at given id if both querystring values set', function () {
            const imposters = {
                    1: { toJSON: jest.fn().mockReturnValue('firstJSON') },
                    2: { toJSON: jest.fn().mockReturnValue('secondJSON') }
                },
                controller = new ImposterController({}, imposters as any);

            controller.get({ url: '/imposters/2?removeProxies=true&replayable=true', params: { id: 2 } } as any, response as any);

            expect(response.body).toEqual('secondJSON');
            expect(imposters['2'].toJSON).toHaveBeenCalledWith({ replayable: true, removeProxies: true });
        });

        it('should return normal JSON for imposter at given id if both replayable and removeProxies querystrings are false', function () {
            const imposters = {
                    1: { toJSON: jest.fn().mockReturnValue('firstJSON') },
                    2: { toJSON: jest.fn().mockReturnValue('secondJSON') }
                },
                controller = new ImposterController({}, imposters as any);

            controller.get({ url: '/imposters/2?replayable=false&removeProxies=false', params: { id: 2 } } as any, response as any);

            expect(response.body).toEqual('secondJSON');
            expect(imposters['2'].toJSON).toHaveBeenCalledWith({ replayable: false, removeProxies: false });
        });
    });

    describe('#del', function () {
        it('should stop the imposter', function () {
            const imposter = {
                stop: jest.fn().mockReturnValue(Q(true)),
                toJSON: jest.fn().mockReturnValue('JSON')
            };
            const controller = new ImposterController({}, {1: imposter} as any);

            return controller.del({ url: '/imposters/1', params: { id: 1 } } as any, response as any).then(() => {
                expect(imposter.stop).toHaveBeenCalled();
            });
        });

        it('should remove the imposter from the list', function () {
            const imposters = {
                1: {
                    stop: jest.fn().mockReturnValue(Q(true)),
                    toJSON: jest.fn().mockReturnValue('JSON')
                }
            };
            const controller = new ImposterController({}, imposters as any);

            return controller.del({ url: '/imposters/1', params: { id: 1 } } as any, response as any).then(() => {
                expect(imposters).toEqual({});
            });
        });

        it('should send request even if no imposter exists', function () {
            const imposters = {};
            const controller = new ImposterController({}, imposters);

            return controller.del({ url: '/imposters/1', params: { id: 1 } } as any, response as any).then(() => {
                expect(response.body).toEqual({});
            });
        });

        it('should return replayable JSON for imposter at given id if replayable querystring set', function () {
            const imposter = {
                stop: jest.fn().mockReturnValue(Q(true)),
                toJSON: jest.fn().mockReturnValue('JSON')
            };
            const controller = new ImposterController({}, {1: imposter} as any);

            return controller.del({ url: '/imposters/1?replayable=true', params: { id: 1 } } as any, response as any).then(() => {
                expect(imposter.toJSON).toHaveBeenCalledWith({ replayable: true, removeProxies: false });
            });
        });

        it('should return removeProxies JSON for imposter at given id if removeProxies querystring set', function () {
            const imposter = {
                stop: jest.fn().mockReturnValue(Q(true)),
                toJSON: jest.fn().mockReturnValue('JSON')
            };
            const controller = new ImposterController({}, {1: imposter} as any);

            return controller.del({ url: '/imposters/1?removeProxies=true', params: { id: 1 } } as any, response as any).then(() => {
                expect(imposter.toJSON).toHaveBeenCalledWith({ replayable: false, removeProxies: true });
            });
        });

        it('should return replayable and removeProxies JSON for imposter at given id if both querystring values set', function () {
            const imposter = {
                stop: jest.fn().mockReturnValue(Q(true)),
                toJSON: jest.fn().mockReturnValue('JSON')
            };
            const controller = new ImposterController({}, {1: imposter} as any);

            return controller.del({ url: '/imposters/1?removeProxies=true&replayable=true', params: { id: 1 } } as any, response as any).then(() => {
                expect(imposter.toJSON).toHaveBeenCalledWith({ replayable: true, removeProxies: true });
            });
        });

        it('should send default JSON for the deleted the imposter if both replayable and removeProxies querystrings are missing', function () {
            const imposter = {
                stop: jest.fn().mockReturnValue(Q(true)),
                toJSON: jest.fn().mockReturnValue('JSON')
            };
            const controller = new ImposterController({}, {1: imposter} as any);

            return controller.del({ url: '/imposters/1', params: { id: 1 } } as any, response as any).then(() => {
                expect(imposter.toJSON).toHaveBeenCalledWith({ replayable: false, removeProxies: false });
            });
        });

        it('should delete requests recorded with the imposter', function () {
            const imposter = {
                toJSON: jest.fn().mockReturnValue('JSON'),
                stubRepository: {
                    resetProxies: jest.fn()
                }
            };
            const controller = new ImposterController({}, {1: imposter} as any);

            return controller.resetProxies({ url: '/imposters/1/requests', params: { id: 1 } } as any, response as any).then(() => {
                expect(imposter.stubRepository.resetProxies).toHaveBeenCalled();
            });
        });
    });

    describe('#putStubs', function () {
        it('should return a 400 if no stubs element', function () {
            const imposter = {
                toJSON: jest.fn().mockReturnValue({}),
                overwriteStubs: jest.fn()
            };
            const logger = require('../fakes/fakeLogger').create();
            const controller = new ImposterController({}, {1: imposter} as any, logger, false);

            return controller.putStubs({ params: { id: 1 } , body: {} } as any, response as any).then(() => {
                expect(response.statusCode).toEqual(400);
                expect(response.body.errors.length).toEqual(1);
                expect(response.body.errors[0].code).toEqual('bad data');
            });
        });

        it('should return a 400 if no stubs is not an array', function () {
            const imposter = {
                toJSON: jest.fn().mockReturnValue({}),
                overwriteStubs: jest.fn()
            };
            const logger = require('../fakes/fakeLogger').create();
            const controller = new ImposterController({}, {1: imposter} as any, logger, false);
            const request = {
                params: {id: 1},
                body: {stubs: 1}
            };

            return controller.putStubs(request as any, response as any).then(() => {
                expect(response.statusCode).toEqual(400);
                expect(response.body.errors.length).toEqual(1);
                expect(response.body.errors[0].code).toEqual('bad data');
            });
        });

        it('should return a 400 if no stub fails dry run validation', function () {
            const imposters = {
                1: {protocol: 'test'}
            };
            const Protocol = {testRequest: {}};
            const logger = require('../fakes/fakeLogger').create();
            const controller = new ImposterController({test: Protocol} as any, imposters as any, logger, false);
            const request = {
                params: {id: 1},
                body: {stubs: [{responses: [{invalid: 1}]}]}
            };

            return controller.putStubs(request as any, response as any).then(() => {
                expect(response.statusCode).toEqual(400);
                expect(response.body.errors.length).toEqual(1);
                expect(response.body.errors[0].code).toEqual('bad data');
            });
        });

        it('should return a 400 if trying to add injection without --allowInjection set', function () {
            const imposters = {
                1: {protocol: 'test'}
            };
            const Protocol = {testRequest: {}};
            const logger = require('../fakes/fakeLogger').create();
            const controller = new ImposterController({test: Protocol} as any, imposters as any, logger, false);
            const request = {
                params: {id: 1},
                body: {stubs: [{responses: [{inject: '() => {}'}]}]}
            };

            return controller.putStubs(request as any, response as any).then(() => {
                expect(response.statusCode).toEqual(400);
                expect(response.body.errors.length).toEqual(1);
                expect(response.body.errors[0].code).toEqual('invalid injection');
            });
        });
    });

    describe('#putStub', function () {
        it('should return a 404 if stubIndex is not an integer', function () {
            const imposters = {
                1: {
                    protocol: 'test',
                    stubRepository: {
                        stubs: jest.fn().mockReturnValue([])
                    }
                }
            };
            const Protocol = {testRequest: {}};
            const logger = require('../fakes/fakeLogger').create();
            const controller = new ImposterController({test: Protocol} as any, imposters as any, logger, false);
            const request = {
                params: {id: 1, stubIndex: 'test'},
                body: {stubs: [{responses: [{is: 'response'}]}]}
            };

            return controller.putStub(request as any, response as any).then(() => {
                expect(response.statusCode).toEqual(404);
                expect(response.body.errors.length).toEqual(1);
                expect(response.body.errors[0]).toEqual({
                    code: 'bad data',
                    message: "'stubIndex' must be a valid integer, representing the array index position of the stub to replace"
                });
            });
        });

        it('should return a 404 if stubIndex is less than 0', function () {
            const imposters = {
                1: {
                    protocol: 'test',
                    stubRepository: {
                        stubs: jest.fn().mockReturnValue([])
                    }
                }
            };
            const Protocol = {testRequest: {}};
            const logger = require('../fakes/fakeLogger').create();
            const controller = new ImposterController({test: Protocol} as any, imposters as any, logger, false);
            const request = {
                params: {id: 1, stubIndex: -1},
                body: {stubs: [{responses: [{is: 'response'}]}]}
            };

            return controller.putStub(request as any, response as any).then(() => {
                expect(response.statusCode).toEqual(404);
                expect(response.body.errors.length).toEqual(1);
                expect(response.body.errors[0]).toEqual({
                    code: 'bad data',
                    message: "'stubIndex' must be a valid integer, representing the array index position of the stub to replace"
                });
            });
        });

        it('should return a 404 if stubIndex is greater then highest index of stubs array', function () {
            const imposters = {
                1: {
                    protocol: 'test',
                    stubRepository: {
                        stubs: jest.fn().mockReturnValue([0, 1, 2])
                    }
                }
            };
            const Protocol = {testRequest: {}};
            const logger = require('../fakes/fakeLogger').create();
            const controller = new ImposterController({test: Protocol} as any, imposters as any, logger, false);
            const request = {
                params: {id: 1, stubIndex: 3},
                body: {stubs: [{responses: [{is: 'response'}]}]}
            };

            return controller.putStub(request as any, response as any).then(() => {
                expect(response.statusCode).toEqual(404);
                expect(response.body.errors.length).toEqual(1);
                expect(response.body.errors[0]).toEqual({
                    code: 'bad data',
                    message: "'stubIndex' must be a valid integer, representing the array index position of the stub to replace"
                });
            });
        });

        it('should return a 400 if no stub fails dry run validation', function () {
            const imposters = {
                1: {
                    protocol: 'test',
                    stubRepository: {
                        stubs: jest.fn().mockReturnValue([0, 1, 2])
                    }
                }
            };
            const Protocol = {testRequest: {}};
            const logger = require('../fakes/fakeLogger').create();
            const controller = new ImposterController({test: Protocol} as any, imposters as any, logger, false);
            const request: any = {
                params: {id: 1, stubIndex: 0},
                body: {responses: [{INVALID: 'response'}]}
            };

            return controller.putStub(request, response as any).then(() => {
                expect(response.statusCode).toEqual(400);
                expect(response.body.errors.length).toEqual(1);
                expect(response.body.errors[0]).toEqual({
                    code: 'bad data',
                    message: 'unrecognized response type',
                    source: { INVALID: 'response' }
                });
            });
        });

        it('should return a 400 if no adding inject without --allowInjection', function () {
            const imposters = {
                1: {
                    protocol: 'test',
                    stubRepository: {
                        stubs: jest.fn().mockReturnValue([0, 1, 2])
                    }
                }
            };
            const Protocol = {testRequest: {}};
            const logger = require('../fakes/fakeLogger').create();
            const controller = new ImposterController({test: Protocol} as any, imposters as any, logger, false);
            const request = {
                params: {id: 1, stubIndex: 0},
                body: {responses: [{inject: '() => {}'}]}
            };

            return controller.putStub(request as any, response as any).then(() => {
                expect(response.statusCode).toEqual(400);
                expect(response.body.errors.length).toEqual(1);
                expect(response.body.errors[0]).toEqual({
                    code: 'invalid injection',
                    message: 'JavaScript injection is not allowed unless mb is run with the --allowInjection flag',
                    source: { responses: [{ inject: '() => {}' }] }
                });
            });
        });
    });

    describe('#deleteStub', function () {
        it('should return a 404 if stubIndex is greater then highest index of stubs array', function () {
            const imposters = {
                1: {
                    protocol: 'test',
                    stubRepository: {
                        stubs: jest.fn().mockReturnValue([0, 1, 2])
                    }
                }
            };
            const Protocol = {testRequest: {}};
            const logger = require('../fakes/fakeLogger').create();
            const controller = new ImposterController({test: Protocol} as any, imposters as any, logger, false);
            const request = {
                params: {id: 1, stubIndex: 3},
                body: {stubs: [{responses: [{is: 'response'}]}]}
            };

            return controller.deleteStub(request as any, response as any).then(() => {
                expect(response.statusCode).toEqual(404);
                expect(response.body.errors.length).toEqual(1);
                expect(response.body.errors[0]).toEqual({
                    code: 'bad data',
                    message: "'stubIndex' must be a valid integer, representing the array index position of the stub to replace"
                });
            });
        });
    });
});
