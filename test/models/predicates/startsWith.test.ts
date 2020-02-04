import * as predicates from '../../../src/models/predicates/predicates';

describe('predicates', function () {
    describe('#startsWith', function () {
        it('should return false for request field not starting with expected', function () {
            const predicate = { startsWith: { field: 'middle' } };
            const request = { field: 'begin middle end' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return true for request field starting with expected', function () {
            const predicate = { startsWith: { field: 'begin' } };
            const request = { field: 'begin middle end' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should be case insensitive by defaul', function () {
            const predicate = { startsWith: { field: 'BEGIN' } };
            const request = { field: 'Begin middle end' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should allow case insensitive', function () {
            const predicate = { startsWith: { field: 'BEGIN' }, caseSensitive: true };
            const request = { field: 'Begin middle end' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should match key-value pairs for objects', function () {
            const predicate = { startsWith: { headers: { key: 'begin' } } };
            const request = { headers: { key: 'begin middle end' } };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return false if no key for object', function () {
            const predicate = { startsWith: { headers: { key: 'begin' } } };
            const request = { headers: {} };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return false if key for object does not start with string', function () {
            const predicate = { startsWith: { headers: { key: 'begin' } } };
            const request = { headers: { key: 'middle end' } };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return true if starts with binary sequence and encoding is base64', function () {
            const predicate = { startsWith: { field: Buffer.from([1, 2]).toString('base64') } };
            const request = { field: Buffer.from([1, 2, 3, 4]).toString('base64') };
            expect(predicates.evaluate(predicate, request, 'base64')).toBeTruthy();
        });

        it('should return false if does not start with binary sequence and encoding is base64', function () {
            const predicate = { startsWith: { field: Buffer.from([2]).toString('base64') } };
            const request = { field: Buffer.from([1, 2, 3, 4]).toString('base64') };
            expect(!predicates.evaluate(predicate, request, 'base64')).toBeTruthy();
        });

        it('should return true if repeating query key has value starting with string', function () {
            const predicate = { startsWith: { query: { key: 'mid' } } };
            const request = { query: { key: ['begin', 'middle', 'end'] } };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return false if repeating query key does not have value starting with string', function () {
            const predicate = { startsWith: { query: { key: 'egin' } } };
            const request = { query: { key: ['begin', 'middle', 'end'] } };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });
    });
});
