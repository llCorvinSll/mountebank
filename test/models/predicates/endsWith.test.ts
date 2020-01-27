import * as predicates from '../../../src/models/predicates/predicates';

describe('predicates', function () {
    describe('#endsWith', function () {
        it('should return false for request field not ending with expected', function () {
            const predicate = {endsWith: {field: 'middle'}};
            const request: any = {field: 'begin middle end'};
            expect(predicates.evaluate(predicate, request)).toBeFalsy();
        });

        it('should return true for request field starting with expected', function () {
            const predicate = {endsWith: {field: 'end'}};
            const request: any = {field: 'begin middle end'};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should be case insensitive by default', function () {
            const predicate = {endsWith: {field: 'END'}};
            const request: any = {field: 'begin middle End'};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should be allow for case isensitivity', function () {
            const predicate = {endsWith: {field: 'END'}, caseSensitive: true};
            const request: any = {field: 'begin middle End'};
            expect(predicates.evaluate(predicate, request)).toBeFalsy();
        });

        it('should match key-value pairs for objects', function () {
            const predicate = {endsWith: {headers: {field: 'end'}}};
            const request: any = {headers: {field: 'begin middle end'}};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return false if no key for object', function () {
            const predicate = {endsWith: {headers: {field: 'end'}}};
            const request: any = {headers: {}};
            expect(predicates.evaluate(predicate, request)).toBeFalsy();
        });

        it('should return false if key for object does not ending with string', function () {
            const predicate = {endsWith: {headers: {field: 'begin'}}};
            const request: any = {headers: {field: 'begin middle end'}};
            expect(predicates.evaluate(predicate, request)).toBeFalsy();
        });

        it('should return true if ends with binary sequence and encoding is base64', function () {
            const predicate = {endsWith: {field: Buffer.from([2, 3, 4]).toString('base64')}};
            const request: any = {field: Buffer.from([1, 2, 3, 4]).toString('base64')};
            expect(predicates.evaluate(predicate, request, 'base64')).toBeTruthy();
        });

        it('should return false if does not end with binary sequence and encoding is base64', function () {
            const predicate = {endsWith: {field: Buffer.from([1, 2, 3]).toString('base64')}};
            const request: any = {field: Buffer.from([1, 2, 3, 4]).toString('base64')};
            expect(predicates.evaluate(predicate, request, 'base64')).toBeFalsy();
        });

        it('should return true if repeating query key has value ending with string', function () {
            const predicate = {endsWith: {query: {key: 'gin'}}};
            const request: any = {query: {key: ['begin', 'middle', 'end']}};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return false if repeating query key does not have value ending with string', function () {
            const predicate = {endsWith: {query: {key: 'begi'}}};
            const request: any = {query: {key: ['begin', 'middle', 'end']}};
            expect(predicates.evaluate(predicate, request)).toBeFalsy();
        });
    });
});
