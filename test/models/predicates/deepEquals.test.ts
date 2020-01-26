import * as predicates from '../../../src/models/predicates/predicates';


describe('predicates', function () {
    describe('#deepEquals', function () {
        it('should return false for mismatched strings', function () {
            const predicate: any = {deepEquals: {field: 'value'}};
            const request: any = {field: 'other'};
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return true for matching strings', function () {
            const predicate: any = {deepEquals: {field: 'value'}};
            const request: any = {field: 'value'};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should be case insensitive by default', function () {
            const predicate: any = {deepEquals: {field: 'VALUE'}};
            const request: any = {field: 'Value'};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should allow case sensitivity', function () {
            const predicate: any = {deepEquals: {field: 'VALUE'}, caseSensitive: true};
            const request: any = {field: 'Value'};
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should be true if empty object matches empty request field', function () {
            const predicate: any = {deepEquals: {query: {}}};
            const request: any = {query: {}};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should be false if empty object provided but request field not empty', function () {
            const predicate: any = {deepEquals: {query: {}}};
            const request: any = {query: {q: 'test'}};
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should match exact key-value pairs for objects', function () {
            const predicate: any = {deepEquals: {headers: {key: 'value'}}};
            const request: any = {headers: {key: 'value'}};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should not match if extra key exists in request field', function () {
            const predicate: any = {deepEquals: {headers: {key: 'value'}}};
            const request: any = {headers: {key: 'value', other: 'other'}};
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should match ignoring unspecified request fields', function () {
            const predicate: any = {deepEquals: {query: {key: 'value'}}};
            const request: any = {query: {key: 'value'}, field: 'true'};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return false if no key for object', function () {
            const predicate: any = {deepEquals: {headers: {key: 'value'}}};
            const request: any = {headers: {}};
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return false if mismatched key for object', function () {
            const predicate: any = {deepEquals: {headers: {key: 'value'}}};
            const request: any = {headers: {key: 'other'}};
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should match values in a case insensitive fashion for objects', function () {
            const predicate: any = {deepEquals: {headers: {key: 'VALUE'}}};
            const request: any = {headers: {key: 'Value'}};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should allow matching values in a case sensitive fashion for objects', function () {
            const predicate: any = {deepEquals: {headers: {key: 'VALUE'}}, caseSensitive: true};
            const request: any = {headers: {key: 'Value'}};
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should match keys in a case insensitive fashion for object', function () {
            const predicate: any = {deepEquals: {headers: {KEY: 'value'}}};
            const request: any = {headers: {Key: 'value'}};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should allow matching keys in a case sensitive fashion for object', function () {
            const predicate: any = {deepEquals: {headers: {KEY: 'value'}}, caseSensitive: true};
            const request: any = {headers: {Key: 'value'}};
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should be false if request has extra field', function () {
            const predicate: any = {deepEquals: {headers: {key: 'value'}}, caseSensitive: true};
            const request: any = {headers: {key: 'value', other: 'next'}};
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should not match missing field with empty string', function () {
            const predicate: any = {deepEquals: {field: ''}};
            const request: any = {};
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return true if equals binary sequence and encoding is base64', function () {
            const binary = Buffer.from([1, 2, 3, 4]).toString('base64');
            const predicate: any = {deepEquals: {field: binary}};
            const request: any = {field: binary};
            expect(predicates.evaluate(predicate, request, 'base64')).toBeTruthy();
        });

        it('should return false if is not binary sequence and encoding is base64', function () {
            const actual = Buffer.from([1, 2, 3, 4]).toString('base64');
            const expected = Buffer.from([1, 2, 4]).toString('base64');
            const predicate: any = {deepEquals: {field: expected}};
            const request: any = {field: actual};
            expect(!predicates.evaluate(predicate, request, 'base64')).toBeTruthy();
        });

        it('should be true if all fields equal', function () {
            const predicate: any = {deepEquals: {first: '1', second: '2'}};
            const request: any = {first: '1', second: '2'};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should be false if one field not equal', function () {
            const predicate: any = {deepEquals: {first: '1', second: '2'}};
            const request: any = {first: '1', second: '3'};
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should be true if all equal except pattern', function () {
            const predicate: any = {deepEquals: {field: 'This is a test'}, except: '\\d+'};
            const request: any = {field: '1This is 3a 2test'};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should be true for ints, bools, and floats when actual is strings', function () {
            const predicate: any = {deepEquals: {query: {int: 1, float: 1.1, bool: true}}};
            const request: any = {query: {int: '1', float: '1.1', bool: 'true'}};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should be true if all values in a multi-value key are present', function () {
            const predicate: any = {deepEquals: {query: {key: ['first', 'second']}}};
            const request: any = {query: {key: ['first', 'second']}, field: 'true'};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should be false if some values in a multi-value key are missing', function () {
            const predicate: any = {deepEquals: {query: {key: ['first', 'second', 'third']}}};
            const request: any = {query: {key: ['first', 'second']}, field: 'true'};
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should be true if values in a multi-value key are out of order', function () {
            // In cases where this comes up - querystrings and xpath selectors,
            // order is irrelevant
            const predicate: any = {deepEquals: {query: {key: ['first', 'second']}}};
            const request: any = {query: {key: ['second', 'first']}, field: 'true'};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should be true if equal with null object value', function () {
            const predicate: any = {deepEquals: {field: null}};
            const request: any = {field: null};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });
    });
});
