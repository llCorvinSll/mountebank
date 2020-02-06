import * as predicates from '../../../src/models/predicates/predicates';

describe('predicates', function () {
    describe('#equals', function () {
        it('should return false for mismatched strings', function () {
            const predicate = { equals: { field: 'value' } };
            const request: any = { field: 'other' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return true for matching strings', function () {
            const predicate = { equals: { field: 'value' } };
            const request: any = { field: 'value' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should be case insensitive by default', function () {
            const predicate = { equals: { field: 'VALUE' } };
            const request: any = { field: 'Value' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should allow case sensitivity', function () {
            const predicate = { equals: { field: 'VALUE' }, caseSensitive: true };
            const request: any = { field: 'Value' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should match key-value pairs for objects', function () {
            const predicate = { equals: { headers: { key: 'value' } } };
            const request: any = { headers: { key: 'value' } };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return false if no key for object', function () {
            const predicate = { equals: { headers: { key: 'value' } } };
            const request: any = { headers: {} };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return false if mismatched key for object', function () {
            const predicate = { equals: { headers: { key: 'value' } } };
            const request: any = { headers: { key: 'other' } };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should match values in a case insensitive fashion for objects', function () {
            const predicate = { equals: { headers: { key: 'VALUE' } } };
            const request: any = { headers: { key: 'Value' } };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should allow matching values in a case sensitive fashion for objects', function () {
            const predicate = { equals: { headers: { key: 'VALUE' } }, caseSensitive: true };
            const request: any = { headers: { key: 'Value' } };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should match keys in a case insensitive fashion for object', function () {
            const predicate = { equals: { headers: { KEY: 'value' } } };
            const request: any = { headers: { Key: 'value' } };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should allow matching keys in a case sensitive fashion for object', function () {
            const predicate = { equals: { headers: { KEY: 'value' } }, caseSensitive: true };
            const request: any = { headers: { Key: 'value' } };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should match missing field with empty string', function () {
            const predicate = { equals: { field: '' } };
            const request: any = {};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return true if equals binary sequence and encoding is base64', function () {
            const binary = Buffer.from([1, 2, 3, 4]).toString('base64');
            const predicate = { equals: { field: binary } };
            const request: any = { field: binary };
            expect(predicates.evaluate(predicate, request, 'base64')).toBeTruthy();
        });

        it('should return false if is not binary sequence and encoding is base64', function () {
            const actual = Buffer.from([1, 2, 3, 4]).toString('base64');
            const expected = Buffer.from([1, 2, 4]).toString('base64');
            const predicate = { equals: { field: expected } };
            const request: any = { field: actual };
            expect(!predicates.evaluate(predicate, request, 'base64')).toBeTruthy();
        });

        it('should be true if all fields equal', function () {
            const predicate = { equals: { first: '1', second: '2' } };
            const request: any = { first: '1', second: '2' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should be false if one field not equal', function () {
            const predicate = { equals: { first: '1', second: '2' } };
            const request: any = { first: '1', second: '3' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should be true if all equal except pattern', function () {
            const predicate = { equals: { field: 'This is a test' }, except: '\\d+' };
            const request: any = { field: '1This is 3a 2test' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should obey be case-insensitive except match by default', function () {
            const predicate = { equals: { field: 'is is a test' }, except: '^tH' };
            const request: any = { field: 'This is a test' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should be case-sensitive except match if configured', function () {
            const predicate = { equals: { field: 'his is a test' }, except: '^t', caseSensitive: true };
            const request: any = { field: 'This is a test' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return true if any value in a multi-value key is equal', function () {
            const predicate = { equals: { query: { key: '234' } } };
            const request: any = { query: { key: ['123', '234'] } };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return false if no value in a multi-value key is equal', function () {
            const predicate = { equals: { query: { key: '23' } } };
            const request: any = { query: { key: ['123', '234'] } };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should match numbers as strings', function () {
            const predicate = { equals: { query: { key: 23 } } };
            const request: any = { query: { key: '23' } };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });
    });
});
