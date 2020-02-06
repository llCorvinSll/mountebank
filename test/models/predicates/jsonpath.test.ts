import * as predicates from '../../../src/models/predicates/predicates';

describe('predicates', function () {
    describe('jsonpath', function () {
        it('#equals should be false if field is not JSON', function () {
            const predicate = {
                equals: { field: 'VALUE' },
                jsonpath: { selector: '$..title' }
            };
            const request: any = { field: 'VALUE' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#equals should be true if value in provided json', function () {
            const predicate = {
                equals: { field: 'VALUE' },
                jsonpath: { selector: '$..title' }
            };
            const request: any = { field: JSON.stringify({ title: 'VALUE' }) };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#equals should be false if value provided json expression does not equal', function () {
            const predicate = {
                equals: { field: 'NOT VALUE' },
                jsonpath: { selector: '$..title' }
            };
            const request: any = { field: JSON.stringify({ title: 'VALUE' }) };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#equals should use case-insensitive json selector by default', function () {
            const predicate = {
                equals: { field: 'VALUE' },
                jsonpath: { selector: '$..Title' }
            };
            const request: any = { field: JSON.stringify({ title: 'VALUE' }) };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#equals should not equal if case-sensitive json selector does not match', function () {
            const predicate = {
                equals: { field: 'value' },
                jsonpath: { selector: '$..title' },
                caseSensitive: true
            };
            const request: any = { field: JSON.stringify({ TITLE: 'value' }) };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#equals should equal if case-sensitive jsonpath selector matches', function () {
            const predicate = {
                equals: { field: 'value' },
                jsonpath: { selector: '$..Title' },
                caseSensitive: true
            };
            const request: any = { field: JSON.stringify({ Title: 'value' }) };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#equals should equal if case-sensitive jsonpath selector matches, stripping out the exception', function () {
            const predicate = {
                equals: { field: 've' },
                jsonpath: { selector: '$..Title' },
                caseSensitive: true,
                except: 'alu'
            };
            const request: any = { field: JSON.stringify({ Title: 'value' }) };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#equals should not equal if case-sensitive jsonpath selector matches, but stripped values differ', function () {
            const predicate = {
                equals: { field: 'v' },
                jsonpath: { selector: '$..Title' },
                caseSensitive: true,
                except: 'alu'
            };
            const request: any = { field: JSON.stringify({ Title: 'value' }) };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#deepEquals should be false if field is not JSON and jsonpath selector used', function () {
            const predicate = {
                deepEquals: { field: 'VALUE' },
                jsonpath: { selector: '$..title' }
            };
            const request: any = { field: 'VALUE' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#deepEquals should be false if value in provided jsonpath attribute expression does not equal', function () {
            const predicate = {
                deepEquals: { field: 'NOT VALUE' },
                jsonpath: { selector: '$.title..attribute' }
            };
            const request: any = { field: JSON.stringify({ Title: { attribute: 'value' } }) };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#deepEquals should be true if singly embedded value in provided jsonpath attribute expression does equal', function () {
            const predicate = {
                deepEquals: { field: 'value' },
                jsonpath: { selector: '$.title.attribute' }
            };
            const request: any = { field: JSON.stringify({ title: { attribute: 'value' } }) };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#deepEquals should be true if doubly embedded value in provided jsonpath attribute expression does equal', function () {
            const predicate = {
                deepEquals: { field: 'value' },
                jsonpath: { selector: '$.title.attribute.test' }
            };
            const request: any = { field: JSON.stringify({ title: { attribute: { test: 'value' } } }) };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#deepEquals should be true if embedded values are provided jsonpath attribute expression does equal', function () {
            const predicate = {
                deepEquals: { field: ['value', 'other value'] },
                jsonpath: { selector: '$.title..attribute' }
            };
            const request: any = { field: JSON.stringify({ title: [{ attribute: 'value' }, { attribute: 'other value' }] }) };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#deepEquals should return a string if looking at an index of 1 item', function () {
            const predicate = {
                deepEquals: { field: 'value' },
                jsonpath: { selector: '$..title[0].attribute' }
            };
            const request: any = { field: JSON.stringify({ title: [{ attribute: 'value' }, { attribute: 'other value' }] }) };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#deepEquals should be true if embedded values are provided jsonpath attribute expression out of order', function () {
            const predicate = {
                deepEquals: { field: ['other value', 'value'] },
                jsonpath: { selector: '$.title..attribute' }
            };
            const request: any = { field: JSON.stringify({ title: [{ attribute: 'value' }, { attribute: 'other value' }] }) };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#deepEquals should be false if does not get all embedded values provided jsonpath attribute expression', function () {
            const predicate = {
                deepEquals: { field: ['value', 'other value'] },
                jsonpath: { selector: '$.title..attribute' }
            };
            const request: any = { field: JSON.stringify({ title: [{ attribute: 'value' }, { attribute: 'other value' }, { attribute: 'last value' }] }) };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#contains should be true if direct text value contains predicate', function () {
            const predicate = {
                contains: { field: 'value' },
                jsonpath: { selector: '$..title' }
            };
            const request: any = { field: JSON.stringify({ title: 'this is a value' }) };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#contains should be false if direct text value does not contain predicate', function () {
            const predicate = {
                contains: { field: 'VALUE' },
                jsonpath: { selector: '$..title' },
                caseSensitive: true
            };
            const request: any = { field: JSON.stringify({ title: 'this is a value' }) };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#startsWith should be true if direct namespaced jsonpath selection starts with value', function () {
            const predicate = {
                startsWith: { field: 'this' },
                jsonpath: { selector: '$..title' }
            };
            const request: any = { field: JSON.stringify({ title: 'this is a value' }) };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#startsWith should be false if direct namespaced jsonpath selection does not start with value', function () {
            const predicate = {
                startsWith: { field: 'this' },
                jsonpath: { selector: '$..title' }
            };
            const request: any = { field: JSON.stringify({ title: 'if this is a value, it is a value' }) };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#exists should be true if jsonpath selector has at least one result', function () {
            const predicate = {
                exists: { field: true },
                jsonpath: { selector: '$..title' }
            };
            const request: any = { field: JSON.stringify({ title: 'value' }) };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#exists should be false if jsonpath selector does not match', function () {
            const predicate = {
                exists: { field: true },
                jsonpath: { selector: '$..title' }
            };
            const request: any = { field: JSON.stringify({ newTitle: 'if this is a value, it is a value' }) };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#matches should be true if selected value matches regex', function () {
            const predicate = {
                matches: { field: '^v' },
                jsonpath: { selector: '$..title' }
            };
            const request: any = { field: JSON.stringify({ title: 'value' }) };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#matches should be false if selected value does not match regex', function () {
            const predicate = {
                matches: { field: 'v$' },
                jsonpath: { selector: '$..title' }
            };
            const request: any = { field: JSON.stringify({ title: 'value' }) };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#deepEquals should be true if boolean value matches', function () {
            const predicate = {
                deepEquals: { field: false },
                jsonpath: { selector: '$..active' }
            };
            const request: any = { field: '{ "active": false }' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#equals should be true if boolean value matches', function () {
            const predicate = {
                equals: { field: false },
                jsonpath: { selector: '$..active' }
            };
            const request: any = { field: '{ "active": false }' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#matches without case sensitivity should maintain selector to match JSON (issue #361)', function () {
            const predicate = {
                matches: { body: '111\\.222\\.333\\.*' },
                jsonpath: { selector: '$.ipAddress' }
            };
            const request: any = { body: '{ "ipAddress": "111.222.333.456" }' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });
    });
});
