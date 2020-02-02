import * as predicates from '../../../src/models/predicates/predicates';

describe('predicates', function () {
    describe('#matches', function () {
        it('should return false for request field not matching expected', function () {
            const predicate = {matches: {field: 'middle$'}};
            const request: any = {field: 'begin middle end'};
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return true for request field matching expected', function () {
            const predicate = {matches: {field: 'end$'}};
            const request: any = {field: 'begin middle end'};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should be case-insensitive by default', function () {
            const predicate = {matches: {field: 'END$'}};
            const request: any = {field: 'begin middle End'};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should allow case sensitivity', function () {
            const predicate = {matches: {field: 'END$'}, caseSensitive: true};
            const request: any = {field: 'begin middle End'};
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should not provide case-insensitivity by transforming regex', function () {
            const predicate = {matches: {field: '\\d\\D\\d'}};
            const request: any = {field: '1a2'};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should match key-value pairs for objects', function () {
            const predicate = {matches: {headers: {field: 'end$'}}};
            const request: any = {headers: {field: 'begin middle end'}};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return false if no key for object', function () {
            const predicate = {matches: {headers: {field: 'end$'}}};
            const request: any = {headers: {}};
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return false if key for object does not matches string', function () {
            const predicate = {matches: {headers: {field: 'begin\\d+'}}};
            const request: any = {headers: {field: 'begin middle end'}};
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should throw an error if encoding is base64', function () {
            try {
                const predicate = {matches: {field: 'dGVzdA=='}};
                const request: any = {field: 'dGVzdA=='};
                predicates.evaluate(predicate, request, 'base64');
                assert.fail('should have thrown');
            }
            catch (error) {
                expect(error.code).toEqual('bad data');
                expect(error.message).toEqual('the matches predicate is not allowed in binary mode');
            }
        });

        it('should return true if repeating query key has value matching string', function () {
            const predicate = {matches: {query: {key: 'iddle$'}}};
            const request: any = {query: {key: ['begin', 'middle', 'end']}};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return false if repeating query key does not have value matching string', function () {
            const predicate = {matches: {query: {key: '^iddle'}}};
            const request: any = {query: {key: ['begin', 'middle', 'end']}};
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return true if repeating query key has value matching array', function () {
            const predicate = {matches: {query: {key: ['^begin', '^middle', 'end$']}}};
            const request: any = {query: {key: ['begin', 'middle', 'end']}};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return false if repeating query key does not have value matching array', function () {
            const predicate = {matches: {query: {key: ['^begin', '^middle', '^nd']}}};
            const request: any = {query: {key: ['begin', 'middle', 'end']}};
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return true if repeating query key has value matching array object', function () {
            const predicate = {matches: {query: {key: [{key1: 'value1$'}, {key1: '^value2'}]}}};
            const request: any = {query: {key: [{key1: 'value1'}, {key1: 'value2'}]}};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return false if repeating query key does not have matching array object', function () {
            const predicate = {matches: {query: {key: [{key1: 'value1$'}, {key1: '^value2'}]}}};
            const request: any = {query: {key: [{key1: 'value1'}, {key1: '^alue2'}]}};
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should be case insensitive for object keys by default (issue #169)', function () {
            const predicate = {matches: {headers: {field: 'end$'}}};
            const request: any = {headers: {FIELD: 'begin middle end'}};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should be false if case on object key differs and configured to be case sensitive', function () {
            const predicate = {matches: {headers: {field: 'end$'}}, caseSensitive: true};
            const request: any = {headers: {FIELD: 'begin middle end'}};
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should be false if case on value differs and configured to be case sensitive', function () {
            const predicate = {matches: {headers: {field: 'end$'}}, caseSensitive: true};
            const request: any = {headers: {field: 'begin middle END'}};
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should be true if case on object key same and configured to be case sensitive', function () {
            const predicate = {matches: {headers: {field: 'end$'}}, caseSensitive: true};
            const request: any = {headers: {field: 'begin middle end'}};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });
        it('should correctly strip "except" predicate from request field and return false', function () {
            const predicate = {matches: {field: 'ab'}, except: 'ab'};
            const request: any = {field: 'abcde'};
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });
        it('should correctly strip "except" predicate from request field and return true', function () {
            const predicate = {matches: {field: '^\\d{1,10}$'}, except: '\\D'};
            const request: any = {field: '1+2'};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });
    });
});
