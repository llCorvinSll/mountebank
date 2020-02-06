import * as predicates from '../../../src/models/predicates/predicates';

describe('predicates', function () {
    describe('treating strings as json', function () {
        it('#equals should be false if field does not equal given value', function () {
            const predicate = { equals: { field: { key: 'VALUE' } } };
            const request: any = { field: 'KEY: VALUE' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#equals should be true if JSON string value equals JSON predicate', function () {
            const predicate = { equals: { field: { key: 'VALUE' } } };
            const request: any = { field: '{ "key": "VALUE" }' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#equals should be false if JSON string value does not equal JSON predicate', function () {
            const predicate = { equals: { field: { key: 'VALUE' } } };
            const request: any = { field: 'Not value' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#equals should be true if JSON string value equals JSON predicate except for case', function () {
            const predicate = { equals: { field: { KEY: 'value' } } };
            const request: any = { field: '{ "key": "VALUE" }' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#equals should not be true if JSON string value case different and caseSensitive is true', function () {
            const predicate = {
                equals: { field: { KEY: 'value' } },
                caseSensitive: true
            };
            const request: any = { field: '{ "key": "VALUE" }' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#equals should equal if case-sensitive predicate matches, stripping out the exception', function () {
            const predicate = {
                equals: { field: { key: 'VE' } },
                caseSensitive: true,
                except: 'ALU'
            };
            const request: any = { field: '{ "key": "VALUE" }' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#equals should not equal if case-sensitive predicate matches, but stripped values differ', function () {
            const predicate = {
                equals: { field: { key: 'V' } },
                caseSensitive: true,
                except: 'ALU'
            };
            const request: any = { field: '{ "key": "VALUE" }' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#deepEquals should be false if field is not JSON and JSON predicate used', function () {
            const predicate = { deepEquals: { field: { key: 'VALUE' } } };
            const request: any = { field: '"key": "VALUE"' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#deepEquals should equal value in provided JSON attribute', function () {
            const predicate = { deepEquals: { field: { key: 'VALUE' } } };
            const request: any = { field: '{"key": "VALUE"}' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#deepEquals should be false if value in provided JSON predicate does not equal', function () {
            const predicate = { deepEquals: { field: { key: 'test' } } };
            const request: any = { field: '{ "key": "VALUE"}' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#deepEquals should be true if all values in a JSON predicate match are present', function () {
            const predicate = {
                deepEquals: {
                    field: {
                        key: 'value',
                        outer: { inner: 'value' }
                    }
                }
            };
            const request: any = { field: '{"key": "VALUE", "outer": { "inner": "value" } }' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#deepEquals should be false if some values in a multi-value JSON predicate match are missing', function () {
            const predicate = {
                deepEquals: {
                    field: {
                        key: 'value',
                        outer: { inner: 'value' }
                    }
                }
            };
            const request: any = { field: '{"outer": { "inner": "value" } }' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#deepEquals should be true if all array values in a JSON predicate match are present regardless of order', function () {
            const predicate = { deepEquals: { field: { key: [2, 1, 3] } } };
            const request: any = { field: '{"key": [3, 1, 2] }' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#contains should be true if JSON value contains predicate', function () {
            const predicate = { contains: { field: { key: 'alu' } } };
            const request: any = { field: '{ "key": "VALUE" }' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#contains should be false if JSON value does not contain predicate', function () {
            const predicate = {
                contains: { field: { key: 'VALUE' } },
                caseSensitive: true
            };
            const request: any = { field: '{"key": "test"}' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#startsWith should be true if JSON field starts with value', function () {
            const predicate = { startsWith: { field: { key: 'Harry' } } };
            const request: any = { field: '{"key": "Harry Potter"}' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#startsWith should be false if JSON field does not start with value', function () {
            const predicate = { startsWith: { field: { key: 'Potter' } } };
            const request: any = { field: '{"key":"Harry Potter"}' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#endsWith should be true if JSON field ends with predicate', function () {
            const predicate = { endsWith: { field: { key: 'Potter' } } };
            const request: any = { field: '{"key": "Harry Potter"}' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#endsWith should be false if JSON field does not end with predicate', function () {
            const predicate = { endsWith: { field: { key: 'Harry' } } };
            const request: any = { field: '{"key": "Harry Potter"}' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#equals should be true if any array element equals the predicate value', function () {
            const predicate = { equals: { field: { key: 'Second' } } };
            const request: any = { field: '{"key": ["First", "Second", "Third"] }' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#equals should be false if no array elements match the predicate value', function () {
            //despite namespace aliases matching, urls do not
            const predicate = { equals: { field: { key: 'Second' } } };
            const request: any = { field: '{"key": ["first", "third"] }' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#matches should be false if field is not JSON', function () {
            const predicate = { matches: { field: { key: 'VALUE' } } };
            const request: any = { field: '"key": "value"' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#matches should be true if selected JSON value matches regex', function () {
            const predicate = { matches: { field: { key: '^v' } } };
            const request: any = { field: '{"key": "Value"}' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#matches should be false if selected JSON value does not match regex', function () {
            const predicate = { matches: { field: { key: 'v$' } } };
            const request: any = { field: '{"key":"value"}' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#exists should be true if JSON key exists', function () {
            const predicate = { exists: { field: { key: true } } };
            const request: any = { field: '{"key":"exists"}' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#exists should be false if JSON key does not exist', function () {
            const predicate = { exists: { field: { key: true } } };
            const request: any = { field: '{}' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#exists should be true if JSON array key exists', function () {
            const predicate = { exists: { field: { key: true } } };
            const request: any = { field: '{"key": []}' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#equals should be true if matches key for any object in array', function () {
            const predicate = { equals: { examples: { key: 'third' } } };
            const request: any = { examples: '[{ "key": "first" }, { "different": true }, { "key": "third" }]' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#equals should be false if all keys in an array do not match', function () {
            const predicate = { equals: { examples: { key: true } } };
            const request: any = { examples: '[{ "key": "first" }, { "different": true }, { "key": "third" }]' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#equals should be true if null value for key matches', function () {
            const predicate = { equals: { json: { key: null } } };
            const request: any = { json: '{ "key": null }' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#deepEquals should be true if all objects in an array have fields equaling predicate', function () {
            const predicate = { deepEquals: { examples: [{ key: 'first' }, { key: 'second' }] } };
            const request: any = { examples: '[{ "key": "first" }, { "key": "second" }]' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#deepEquals should be false if missing an object in an array in request', function () {
            const predicate = { deepEquals: { examples: [{ key: 'first' }, { key: 'second' }] } };
            const request: any = { examples: '[{ "key": "first" }, { "different": true }, { "key": "second" }]' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#deepEquals should be true if all objects in an array have fields equaling predicate regardless of order', function () {
            const predicate = { deepEquals: { examples: [{ key: 'second' }, { key: 'first' }] } };
            const request: any = { examples: '[{ "key": "first" }, { "key": "second" }]' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#matches should support upper case object key in JSON body (issue #228)', function () {
            const predicate = { matches: { body: { Key: '^Value' } } };
            const request: any = { body: '{ "Key": "Value" }' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#matches should support case-insensitive key matching in JSON body', function () {
            const predicate = { matches: { body: { KEY: '^Value' } } };
            const request: any = { body: '{ "Key": "Value" }' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#matches should support case sensitive key matching in JSON body is case sensitive configured', function () {
            const predicate = { matches: { body: { KEY: '^Value' } }, caseSensitive: true };
            const request: any = { body: '{ "Key": "Value" }' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#deepEquals should support case-insensitive key in JSON body', function () {
            const predicate = { deepEquals: { body: { KEY: 'Value' } } };
            const request: any = { body: '{ "Key": "value" }' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#deepEquals should support case-sensitive key in JSON body if case sensitive configured', function () {
            const predicate = { deepEquals: { body: { KEY: 'Value' } }, caseSensitive: true };
            const request: any = { body: '{ "Key": "value" }' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });
    });
});
