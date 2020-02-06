const assert = require('assert');
const predicates = require('../../../src/models/predicates/predicates');
const util = require('util');

describe('predicates', function () {
    describe('#inject', function () {
        it('should return true if injected function returns true', function () {
            const predicate = { inject: 'function () { return true; }' };
            const request = {};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return false if injected function returns false', function () {
            const predicate = { inject: 'function () { return false; }' };
            const request = {};
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return true if injected function matches request', function () {
            const fn = function (obj: any) {
                return obj.path === '/' && obj.method === 'GET';
            };
            const predicate = { inject: fn.toString() };
            const request = { path: '/', method: 'GET' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should log injection exceptions', function () {
            const errorsLogged: any[] = [];
            const logger = {
                error: function () {
                    const message = util.format.apply(this, Array.prototype.slice.call(arguments));
                    errorsLogged.push(message);
                }
            };
            const predicate = { inject: 'function () {  throw Error("BOOM!!!"); }' };
            const request = {};

            try {
                predicates.evaluate(predicate, request, 'utf8', logger);
                assert.fail('should have thrown exception');
            }
            catch (error) {
                expect(error.message).toEqual('invalid predicate injection');
                expect(errorsLogged.indexOf('injection X=> Error: BOOM!!!') >= 0).toBeTruthy();
            }
        });

        it('should allow changing the state in the injection', function () {
            const mockedImposterState = { foo: 'bar' };
            const expectedImposterState = { foo: 'barbar' };
            const mockedLogger = {
                error: function () {
                }
            };
            const fn = function (request: any, logger: any, imposterState: any) {
                imposterState.foo = 'barbar';
                return true;
            };
            const predicate = { inject: fn.toString() };
            const request = { path: '/', method: 'GET' };
            expect(predicates.evaluate(predicate, request, 'utf8', mockedLogger, mockedImposterState)).toBeTruthy();
            expect(mockedImposterState).toEqual(expectedImposterState);
        });

        it('should not run injection during dry run validation', function () {
            const fn = function () {
                throw new Error('BOOM!');
            };
            const predicate = { inject: fn.toString() };
            const request = { isDryRun: true };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });
    });
});
