import * as Validator from '../../src/models/dryRunValidator';
import { StorageCreator } from '../../src/models/storage/StorageCreator';
const Logger = require('../fakes/fakeLogger');

describe('dryRunValidator', function () {
    let testRequest: any;
    let storageCreator: StorageCreator;

    beforeEach(() => {
        testRequest = { requestFrom: '', path: '/', query: {}, method: 'GET', headers: {}, body: '' };
        storageCreator = new StorageCreator(false);
    });

    describe('#validate', function () {
        it('should be valid for an empty request', function () {
            const request = {};
            const validator = Validator.create({ testRequest }, storageCreator);

            return validator.validate(request, Logger.create()).then(result => {
                expect(result).toEqual({
                    isValid: true,
                    errors: []
                });
            });
        });

        it('should not be valid for a missing responses field', function () {
            const request = { stubs: [{}] };
            const validator = Validator.create({ testRequest }, storageCreator);

            return validator.validate(request, Logger.create()).then(result => {
                expect(result).toEqual({
                    isValid: false,
                    errors: [{
                        code: 'bad data',
                        message: "'responses' must be a non-empty array",
                        source: {}
                    }]
                });
            });
        });

        it('should be valid for an empty stubs list', function () {
            const request = { stubs: [] };
            const validator = Validator.create({ testRequest }, storageCreator);

            return validator.validate(request, Logger.create()).then(result => {
                expect(result).toEqual({
                    isValid: true,
                    errors: []
                });
            });
        });

        it('should be valid for valid stub', function () {
            const request = { stubs: [{ responses: [{ is: { statusCode: 400 } }] }] };
            const validator = Validator.create({ testRequest }, storageCreator);

            return validator.validate(request, Logger.create()).then(result => {
                expect(result).toEqual({
                    isValid: true,
                    errors: []
                });
            });
        });

        it('should be valid for a valid predicate', function () {
            const request = {
                stubs: [{
                    responses: [{ is: { body: 'test' } }],
                    predicates: [
                        { equals: { path: '/test' } },
                        { equals: { method: 'GET' } },
                        { equals: { body: 'BODY' } },
                        { exists: { headers: { TEST: true } } }
                    ]
                }]
            };
            const validator = Validator.create({ testRequest }, storageCreator);

            return validator.validate(request, Logger.create()).then(result => {
                expect(result).toEqual({
                    isValid: true,
                    errors: []
                });
            });
        });

        it('should be valid for a well formed predicate inject if injections are allowed', function () {
            const request = {
                stubs: [{
                    predicates: [{ inject: '() => { return true; }' }],
                    responses: [{ is: { body: 'Matched' } }]
                }]
            };
            const validator = Validator.create({ testRequest, allowInjection: true }, storageCreator);

            return validator.validate(request, Logger.create()).then(result => {
                expect(result).toEqual({
                    isValid: true,
                    errors: []
                });
            });
        });

        it('should be true for a well formed response inject if injections are allowed', function () {
            const request = {
                stubs: [{
                    responses: [{ inject: '() => { return {}; }' }]
                }]
            };
            const validator = Validator.create({ testRequest, allowInjection: true }, storageCreator);

            return validator.validate(request, Logger.create()).then(result => {
                expect(result).toEqual({
                    isValid: true,
                    errors: []
                });
            });
        });

        it('should be true for a well formed decorator behavior if injections are allowed', function () {
            const decorator = (request: any, response: any) => {
                response.body = 'Hello';
            };
            const request = {
                stubs: [{
                    responses: [{ is: { statusCode: 400 }, _behaviors: { decorate: decorator.toString() } }]
                }]
            };
            const validator = Validator.create({ testRequest, allowInjection: true }, storageCreator);

            return validator.validate(request, Logger.create()).then(result => {
                expect(result).toEqual({
                    isValid: true,
                    errors: []
                });
            });
        });

        it('should not be valid for response injection if injections are disallowed', function () {
            const request = {
                stubs: [{
                    responses: [{ inject: '() => { return {}; }' }]
                }]
            };
            const validator = Validator.create({ testRequest, allowInjection: false }, storageCreator);

            return validator.validate(request, Logger.create()).then(result => {
                expect(result).toEqual({
                    isValid: false,
                    errors: [{
                        code: 'invalid injection',
                        message: 'JavaScript injection is not allowed unless mb is run with the --allowInjection flag',
                        source: request.stubs[0]
                    }]
                });
            });
        });

        it('should not be valid for predicate injections if allowInjection is false', function () {
            const request = {
                stubs: [{
                    predicates: [{ inject: '() => { return true; }' }],
                    responses: [{ is: { body: 'Matched' } }]
                }]
            };
            const validator = Validator.create({ testRequest, allowInjection: false }, storageCreator);

            return validator.validate(request, Logger.create()).then(result => {
                expect(result).toEqual({
                    isValid: false,
                    errors: [{
                        code: 'invalid injection',
                        message: 'JavaScript injection is not allowed unless mb is run with the --allowInjection flag',
                        source: request.stubs[0]
                    }]
                });
            });
        });

        it('should be false for a well formed decorator behavior if injections are not allowed', function () {
            const decorator = (request: any, response: any) => {
                response.body = 'Hello';
            };
            const request = {
                stubs: [{
                    responses: [{ is: { statusCode: 400 }, _behaviors: { decorate: decorator.toString() } }]
                }]
            };
            const validator = Validator.create({ testRequest, allowInjection: false }, storageCreator);

            return validator.validate(request, Logger.create()).then(result => {
                expect(result).toEqual({
                    isValid: false,
                    errors: [{
                        code: 'invalid injection',
                        message: 'JavaScript injection is not allowed unless mb is run with the --allowInjection flag',
                        source: request.stubs[0]
                    }]
                });
            });
        });

        it('should be valid with a valid proxy response', function () {
            const request: any = {
                stubs: [{
                    responses: [{ proxy: { to: 'http://google.com' } }]
                }]
            };
            const validator = Validator.create({ testRequest }, storageCreator);

            return validator.validate(request, Logger.create()).then(result => {
                expect(result).toEqual({
                    isValid: true,
                    errors: []
                });
            });
        });

        it('should not be valid if any stub is invalid', function () {
            const request = {
                stubs: [
                    { responses: [{ is: { statusCode: 400 } }] },
                    {}
                ]
            };
            const validator = Validator.create({ testRequest }, storageCreator);

            return validator.validate(request, Logger.create()).then(result => {
                expect(result).toEqual({
                    isValid: false,
                    errors: [{
                        code: 'bad data',
                        message: "'responses' must be a non-empty array",
                        source: {}
                    }]
                });
            });
        });

        it('should detect an invalid predicate', function () {
            const request = {
                stubs: [{
                    responses: [{}],
                    predicates: [{ invalidPredicate: { path: '/test' } }]
                }]
            };
            const validator = Validator.create({ testRequest }, storageCreator);

            return validator.validate(request, Logger.create()).then(result => {
                expect(result).toEqual({
                    isValid: false,
                    errors: [{
                        code: 'bad data',
                        message: 'malformed stub request',
                        data: 'missing predicate',
                        source: { invalidPredicate: { path: '/test' } }
                    }]
                });
            });
        });

        it('should detect an invalid predicate mixed with valid predicates', function () {
            const request = {
                stubs: [{
                    responses: [{}],
                    predicates: [
                        { equals: { path: '/test' } },
                        { invalidPredicate: { body: 'value' } }
                    ]
                }]
            };
            const validator = Validator.create({ testRequest }, storageCreator);

            return validator.validate(request, Logger.create()).then(result => {
                expect(result).toEqual({
                    isValid: false,
                    errors: [{
                        code: 'bad data',
                        message: 'malformed stub request',
                        data: 'missing predicate',
                        source: { invalidPredicate: { body: 'value' } }
                    }]
                });
            });
        });

        it('should detect a malformed predicate', function () {
            const request = {
                stubs: [{
                    responses: [{}],
                    predicates: [{ headers: [{ exists: 'Test' }] }]
                }]
            };
            const validator = Validator.create({ testRequest }, storageCreator);

            return validator.validate(request, Logger.create()).then(result => {
                expect(result).toEqual({
                    isValid: false,
                    errors: [{
                        code: 'bad data',
                        message: 'malformed stub request',
                        data: 'missing predicate',
                        source: { headers: [{ exists: 'Test' }] }
                    }]
                });
            });
        });

        it('should reject unrecognized response resolver', function () {
            const request = {
                stubs: [{
                    responses: [{ invalid: 'INVALID' }]
                }]
            };
            const validator = Validator.create({ testRequest }, storageCreator);

            return validator.validate(request, Logger.create()).then(result => {
                expect(result).toEqual({
                    isValid: false,
                    errors: [{
                        code: 'bad data',
                        message: 'unrecognized response type',
                        source: request.stubs[0].responses[0]
                    }]
                });
            });
        });

        it('should not be valid if any response is invalid', function () {
            const request = {
                stubs: [{
                    responses: [
                        { is: { statusCode: 400 } },
                        { invalid: true }
                    ]
                }]
            };
            const validator = Validator.create({ testRequest }, storageCreator);

            return validator.validate(request, Logger.create()).then(result => {
                expect(result).toEqual({
                    isValid: false,
                    errors: [{
                        code: 'bad data',
                        message: 'unrecognized response type',
                        source: request.stubs[0].responses[1]
                    }]
                });
            });
        });

        it('should not be valid if any response is invalid even if the predicates are false during dry run', function () {
            const request = {
                stubs: [{
                    responses: [{ invalid: true }],
                    predicates: [{ equals: { path: '/does-not-match' } }]
                }]
            };
            const validator = Validator.create({ testRequest }, storageCreator);

            return validator.validate(request, Logger.create()).then(result => {
                expect(result).toEqual({
                    isValid: false,
                    errors: [{
                        code: 'bad data',
                        message: 'unrecognized response type',
                        source: request.stubs[0].responses[0]
                    }]
                });
            });
        });

        it('should add behavior validation errors', function () {
            const request: any = {
                stubs: [{
                    responses: [{
                        is: { statusCode: 400 },
                        _behaviors: {
                            wait: -1,
                            repeat: -1
                        }
                    }]
                }]
            };
            const validator = Validator.create({ testRequest }, storageCreator);

            return validator.validate(request, Logger.create()).then(result => {
                expect(result).toEqual({
                    isValid: false,
                    errors: [
                        {
                            code: 'bad data',
                            message: 'wait behavior "wait" field must be an integer greater than or equal to 0',
                            source: { wait: -1, repeat: -1 }
                        },
                        {
                            code: 'bad data',
                            message: 'repeat behavior "repeat" field must be an integer greater than 0',
                            source: { wait: -1, repeat: -1 }
                        }
                    ]
                });
            });
        });

        it('should allow functions as wait behavior if injections allowed', function () {
            const request = { stubs: [{ responses: [{
                is: { statusCode: 400 },
                _behaviors: { wait: '() => { return 1000; }' }
            }] }] };
            const validator = Validator.create({ testRequest, allowInjection: true }, storageCreator);

            return validator.validate(request, Logger.create()).then(result => {
                expect(result).toEqual({
                    isValid: true,
                    errors: []
                });
            });
        });

        it('should not allow functions as wait behavior if injections not allowed', function () {
            const response = {
                is: { statusCode: 400 },
                _behaviors: { wait: '() => { return 1000; }' }
            };
            const request = { stubs: [{ responses: [response] }] };
            const validator = Validator.create({ testRequest, allowInjection: false }, storageCreator);

            return validator.validate(request, Logger.create()).then(result => {
                expect(result).toEqual({
                    isValid: false,
                    errors: [{
                        code: 'invalid injection',
                        message: 'JavaScript injection is not allowed unless mb is run with the --allowInjection flag',
                        source: { responses: [response] }
                    }]
                });
            });
        });

        it('should be false for a well formed endOfRequestResolver if injections are not allowed', function () {
            const endOfRequestResolver = () => true;
            const request = {
                protocol: 'tcp',
                stubs: [{ responses: [{ is: { data: 'test' } }] }],
                endOfRequestResolver: { inject: endOfRequestResolver.toString() as any }
            };
            const validator = Validator.create({ testRequest, allowInjection: false }, storageCreator);

            return validator.validate(request, Logger.create()).then(result => {
                expect(result).toEqual({
                    isValid: false,
                    errors: [{
                        code: 'invalid injection',
                        message: 'JavaScript injection is not allowed unless mb is run with the --allowInjection flag',
                        source: request.endOfRequestResolver
                    }]
                });
            });
        });

        it('should be true for a well formed endOfRequestResolver if injections are allowed', function () {
            const endOfRequestResolver = () => true;
            const request: any = {
                protocol: 'tcp',
                stubs: [{ responses: [{ is: { data: 'test' } }] }],
                endOfRequestResolver: { inject: endOfRequestResolver.toString() }
            };
            const validator = Validator.create({ testRequest, allowInjection: true }, storageCreator);

            return validator.validate(request, Logger.create()).then(result => {
                expect(result.isValid).toBeTruthy();
            });
        });

        it('should not be valid for shellTransform if injections are disallowed', function () {
            const request = {
                stubs: [{
                    responses: [{ is: {}, _behaviors: { shellTransform: ['command'] } }]
                }]
            };
            const validator = Validator.create({ testRequest, allowInjection: false }, storageCreator);

            return validator.validate(request, Logger.create()).then(result => {
                expect(result).toEqual({
                    isValid: false,
                    errors: [{
                        code: 'invalid injection',
                        message: 'Shell execution is not allowed unless mb is run with the --allowInjection flag',
                        source: request.stubs[0]
                    }]
                });
            });
        });

        it('should not be valid for proxy addDecorateBehavior if injections are disallowed', function () {
            const proxy = {
                to: 'http://google.com',
                addDecorateBehavior: '(request, response) => { response.body = ""; }'
            };
            const request: any = {
                stubs: [{
                    responses: [{ proxy: proxy }]
                }]
            };
            const validator = Validator.create({ testRequest, allowInjection: false }, storageCreator);

            return validator.validate(request, Logger.create()).then(result => {
                expect(result).toEqual({
                    isValid: false,
                    errors: [{
                        code: 'invalid injection',
                        message: 'JavaScript injection is not allowed unless mb is run with the --allowInjection flag',
                        source: request.stubs[0]
                    }]
                });
            });
        });
    });
});
