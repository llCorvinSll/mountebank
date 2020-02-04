import * as predicates from '../../../src/models/predicates/predicates';


describe('predicates', function () {
    describe('#contains', function () {
        it('should return false for request field not containing expected', function () {
            const predicate = { contains: { field: 'middle' } };
            const request: any = { field: 'begin end' };
            expect(predicates.evaluate(predicate, request)).toBeFalsy();
        });

        it('should return true for request field containing expected', function () {
            const predicate = { contains: { field: 'middle' } };
            const request: any = { field: 'begin middle end' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should be case insensitive by default', function () {
            const predicate = { contains: { field: 'MIDDLE' } };
            const request: any = { field: 'begin Middle end' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should allow case sensitivity', function () {
            const predicate = { contains: { field: 'MIDDLE' }, caseSensitive: true };
            const request: any = { field: 'begin Middle end' };
            expect(predicates.evaluate(predicate, request)).toBeFalsy();
        });

        it('should match key-value pairs for objects', function () {
            const predicate = { contains: { headers: { key: 'middle' } } };
            const request: any = { headers: { key: 'begin middle end' } };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return false if no key for object', function () {
            const predicate = { contains: { headers: { key: 'middle' } } };
            const request: any = { headers: {} };
            expect(predicates.evaluate(predicate, request)).toBeFalsy();
        });

        it('should return false if key for object does not contain string', function () {
            const predicate = { contains: { headers: { key: 'middle' } } };
            const request: any = { headers: { key: 'begin end' } };
            expect(predicates.evaluate(predicate, request)).toBeFalsy();
        });

        it('should match values in a case insensitive fashion for objects', function () {
            const predicate = { contains: { headers: { key: 'Middle' } } };
            const request: any = { headers: { key: 'begin MIDDLE end' } };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should allow case sensitivity when matching values for objects', function () {
            const predicate = { contains: { headers: { key: 'Middle' } }, caseSensitive: true };
            const request: any = { headers: { key: 'begin MIDDLE end' } };
            expect(predicates.evaluate(predicate, request)).toBeFalsy();
        });

        it('should return true if contains binary sequence and encoding is base64', function () {
            const predicate = { contains: { field: Buffer.from([2, 3]).toString('base64') } };
            const request: any = { field: Buffer.from([1, 2, 3, 4]).toString('base64') };
            expect(predicates.evaluate(predicate, request, 'base64')).toBeTruthy();
        });

        it('should return false if not contains binary sequence and encoding is base64', function () {
            const predicate = { contains: { field: Buffer.from([2, 4]).toString('base64') } };
            const request: any = { field: Buffer.from([1, 2, 3, 4]).toString('base64') };
            expect(predicates.evaluate(predicate, request, 'base64')).toBeFalsy();
        });

        it('should return true if repeating query key contains value', function () {
            const predicate = { contains: { query: { key: '123' } } };
            const request: any = { query: { key: ['123', '234'] } };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return true if repeating query key contains value with the right substring', function () {
            const predicate = { contains: { query: { key: 'mid' } } };
            const request: any = { query: { key: ['begin', 'middle', 'end'] } };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return false if repeating query key does not contain value', function () {
            const predicate = { contains: { query: { key: 'bid' } } };
            const request: any = { query: { key: ['begin', 'middle', 'end'] } };
            expect(predicates.evaluate(predicate, request)).toBeFalsy();
        });

        it('should return true if array predicate matches actual array', function () {
            const predicate = { contains: { field: ['be', 'nd', 'iddl'] } };
            const request: any = { field: ['begin', 'middle', 'end'] };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return false if repeating query key does not have value matching array', function () {
            const predicate = { contains: { query: { key: ['be', 'nd', 'iddl', 'wtf'] } } };
            const request: any = { query: { key: ['begin', 'middle', 'end'] } };
            expect(predicates.evaluate(predicate, request)).toBeFalsy();
        });

        it('should return true if all values in predicate definition in array even if array has more elements', function () {
            const predicate = { contains: { query: { key: ['fi', 'se'] } } };
            const request: any = { query: { key: ['first', 'second', 'third'] } };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return true if repeating query key has value matching array object', function () {
            const predicate = { contains: { query: { key: [{ key1: '1' }, { key1: '2' }] } } };
            const request: any = { query: { key: [{ key1: 'value1' }, { key1: 'value2' }] } };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return false if repeating query key does not have matching array object', function () {
            const predicate = { contains: { query: { key: [{ key1: '1' }, { key1: '2' }] } } };
            const request: any = { query: { key: [{ key1: 'value1' }, { key1: 'value3' }] } };
            expect(predicates.evaluate(predicate, request)).toBeFalsy();
        });
    });
});
