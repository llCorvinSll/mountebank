

const assert = require('assert');
import * as predicates from '../../../src/models/predicates/predicates';

describe('predicates', function () {
    describe('xpath', function () {
        it('#equals should be false if field is not XML', function () {
            const predicate = {
                equals: { field: 'VALUE' },
                xpath: { selector: '//title' }
            };
            const request = { field: 'VALUE' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#equals should be false if field is empty', function () {
            const predicate = {
                equals: { field: 'VALUE' },
                xpath: { selector: '//title' }
            };
            const request = { field: '' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#equals should be true if value in provided xpath expression', function () {
            const predicate = {
                equals: { field: 'VALUE' },
                xpath: { selector: '//title' }
            };
            const request = { field: '<doc><title>value</title></doc>' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#equals should be false if value provided xpath expression does not equal', function () {
            const predicate = {
                equals: { field: 'NOT VALUE' },
                xpath: { selector: '//title' }
            };
            const request = { field: '<doc><title>value</title></doc>' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#equals should use case-insensitive xpath selector by default', function () {
            const predicate = {
                equals: { field: 'VALUE' },
                xpath: { selector: '//Title' }
            };
            const request = { field: '<DOC><TITLE>value</TITLE></DOC>' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#equals should not equal if case-sensitive xpath selector does not match', function () {
            const predicate = {
                equals: { field: 'value' },
                xpath: { selector: '//Title' },
                caseSensitive: true
            };
            const request = { field: '<DOC><TITLE>value</TITLE></DOC>' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#equals should equal if case-sensitive xpath selector matches', function () {
            const predicate = {
                equals: { field: 'value' },
                xpath: { selector: '//Title' },
                caseSensitive: true
            };
            const request = { field: '<Doc><Title>value</Title></Doc>' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#equals should equal if case-sensitive xpath selector matches, stripping out the exception', function () {
            const predicate = {
                equals: { field: 've' },
                xpath: { selector: '//Title' },
                caseSensitive: true,
                except: 'alu'
            };
            const request = { field: '<Doc><Title>value</Title></Doc>' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#equals should not equal if case-sensitive xpath selector matches, but stripped values differ', function () {
            const predicate = {
                equals: { field: 'v' },
                xpath: { selector: '//Title' },
                caseSensitive: true,
                except: 'alu'
            };
            const request = { field: '<Doc><Title>value</Title></Doc>' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#deepEquals should be false if field is not XML and xpath selector used', function () {
            const predicate = {
                deepEquals: { field: 'VALUE' },
                xpath: { selector: '//title' }
            };
            const request = { field: 'VALUE' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#deepEquals should equal value in provided xpath attribute', function () {
            const predicate = {
                deepEquals: { field: 'VALUE' },
                xpath: { selector: '//title/@href' }
            };
            const request = { field: '<doc><title href="value">text</title></doc>' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#deepEquals should be false if value in provided xpath attribute expression does not equal', function () {
            const predicate = {
                deepEquals: { field: 'NOT VALUE' },
                xpath: { selector: '//title/@attr' }
            };
            const request = { field: '<doc><title attr="value">text</title></doc>' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#deepEquals should be true if all values in a multi-value selector match are present', function () {
            const predicate = {
                deepEquals: { field: ['first', 'second'] },
                xpath: { selector: '//title' }
            };
            const request = { field: '<doc><title>first</title><title>second</title></doc>' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#deepEquals should be false if some values in a multi-value selector match are missing', function () {
            const predicate = {
                deepEquals: { field: ['first', 'second'] },
                xpath: { selector: '//title' }
            };
            const request = { field: '<doc><title>first</title><title>second</title><title>third</title></doc>' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#deepEquals should be true if values in a multi-value selector match are out of order', function () {
            const predicate = {
                deepEquals: { field: ['first', 'second'] },
                xpath: { selector: '//title' }
            };
            const request = { field: '<doc><title>second</title><title>first</title></doc>' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#contains should be true if direct text value contains predicate', function () {
            const predicate = {
                contains: { field: 'value' },
                xpath: { selector: '//title/text()' }
            };
            const request = { field: '<doc><title>this is a value</title></doc>' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#contains should be false if direct text value does not contain predicate', function () {
            const predicate = {
                contains: { field: 'VALUE' },
                xpath: { selector: '//title/text()' },
                caseSensitive: true
            };
            const request = { field: '<doc><title>this is a value</title></doc>' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#startsWith should be true if direct namespaced xpath selection starts with value', function () {
            const predicate = {
                startsWith: { field: 'Harry' },
                xpath: { selector: '//*[local-name(.)="title" and namespace-uri(.)="myns"]' }
            };
            const request = { field: '<book><title xmlns="myns">Harry Potter</title></book>' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#startsWith should be false if direct namespaced xpath selection does not start with value', function () {
            const predicate = {
                startsWith: { field: 'Potter' },
                xpath: { selector: '//*[local-name(.)="title" and namespace-uri(.)="myns"]' }
            };
            const request = { field: '<book><title xmlns="myns">Harry Potter</title></book>' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#startsWith should be false if direct namespaced xpath selection does not match', function () {
            const predicate = {
                startsWith: { field: 'Harry' },
                xpath: { selector: '//*[local-name(.)="title" and namespace-uri(.)="myns"]' }
            };
            const request = { field: '<book><title>Harry Potter</title></book>' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#endsWith should be true if aliased namespace match endsWith predicate', function () {
            const predicate = {
                endsWith: { field: 'Potter' },
                xpath: {
                    selector: '//bookml:title/text()',
                    ns: {
                        bookml: 'http://example.com/book'
                    }
                }
            };
            const request = { field: '<book xmlns:bookml="http://example.com/book"><bookml:title>Harry Potter</bookml:title></book>' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#endsWith should be true if aliased namespace match but has capital letters in URL', function () {
            const predicate = {
                endsWith: { field: 'Potter' },
                xpath: {
                    selector: '//bookml:title/text()',
                    ns: {
                        bookml: 'http://EXAMPLE.COM/book'
                    }
                }
            };
            const request = { field: '<book xmlns:bookml="http://EXAMPLE.COM/book"><bookml:title>Harry Potter</bookml:title></book>' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#equals should be true if caseSensitive and namespace has capital letters in URL', function () {
            const predicate = {
                equals: { field: 'Harry Potter' },
                caseSensitive: true,
                xpath: {
                    selector: '//bookml:title/text()',
                    ns: { bookml: 'http://EXAMPLE.COM/book' }
                }
            };
            const request = { field: '<book xmlns:bookml="http://EXAMPLE.COM/book"><bookml:title>Harry Potter</bookml:title></book>' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#endsWith should be false if aliased namespace match does not end with predicate', function () {
            const predicate = {
                endsWith: { field: 'Harry' },
                xpath: {
                    selector: '//bookml:title/text()',
                    ns: {
                        bookml: 'http://example.com/book'
                    }
                }
            };
            const request = { field: '<b:book xmlns:b="http://example.com/book"><b:title>Harry Potter</b:title></b:book>' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#equals should be true if any matched node equals the predicate value', function () {
            const predicate = {
                equals: { field: 'Second' },
                xpath: {
                    selector: '//a:child',
                    ns: {
                        a: 'http://example.com/a',
                        b: 'http://example.com/b'
                    }
                }
            };
            const request = {
                field: '<root xmlns:thisa="http://example.com/a" xmlns:thisb="http://example.com/b">' +
                    '  <thisa:child>First</thisa:child>' +
                    '  <thisa:child>Second</thisa:child>' +
                    '  <thisa:child>Third</thisa:child>' +
                    '</root>'
            };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#equals should be false if no nodes match the selector', function () {
            // despite namespace aliases matching, urls do not
            const predicate = {
                equals: { field: 'Second' },
                xpath: {
                    selector: '//a:child',
                    ns: {
                        a: 'http://example.com/a',
                        b: 'http://example.com/b'
                    }
                }
            };
            const request = {
                field: '<root xmlns:b="http://example.com/a" xmlns:a="http://example.com/b">' +
                    '  <a:child>First</a:child>' +
                    '  <a:child>Second</a:child>' +
                    '  <a:child>Third</a:child>' +
                    '</root>'
            };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#matches should be false if field is not XML', function () {
            const predicate = {
                matches: { field: 'VALUE' },
                xpath: { selector: '//title' }
            };
            const request = { field: 'VALUE' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#matches should be true if selected value matches regex', function () {
            const predicate = {
                matches: { field: '^v' },
                xpath: { selector: '//title' }
            };
            const request = { field: '<doc><title>value</title></doc>' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#matches should be false if selected value does not match regex', function () {
            const predicate = {
                matches: { field: 'v$' },
                xpath: { selector: '//title' }
            };
            const request = { field: '<doc><title>value</title></doc>' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should throw an error if encoding is base64', function () {
            try {
                const predicate = {
                    equals: { field: 'dGVzdA==' },
                    xpath: { selector: 'dGVzdA==' }
                };
                const request = { field: 'dGVzdA==' };
                predicates.evaluate(predicate, request, 'base64');
                assert.fail('should have thrown');
            }
            catch (error) {
                assert.strictEqual(error.code, 'bad data');
                assert.strictEqual(error.message, 'the xpath predicate parameter is not allowed in binary mode');
            }
        });

        it('#exists should be true if xpath selector has at least one result', function () {
            const predicate = {
                exists: { field: true },
                xpath: { selector: '//title' }
            };
            const request = { field: '<doc><title>value</title></doc>' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#exists should be false if xpath selector does not match', function () {
            const predicate = {
                exists: { field: true },
                xpath: { selector: '//title' }
            };
            const request = { field: '<doc><summary>value</summary></doc>' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should throw error if xpath selector is malformed', function () {
            try {
                const predicate = {
                    equals: { field: 'value' },
                    xpath: { selector: '=*INVALID*=' }
                };
                const request = { field: '<doc><title>value</title></doc>' };
                predicates.evaluate(predicate, request);
                assert.fail('should have thrown');
            }
            catch (error) {
                assert.strictEqual(error.code, 'bad data');
                assert.strictEqual(error.message, 'malformed xpath predicate selector');
            }
        });

        it('should accept numbers using count()', function () {
            const predicate = {
                equals: { field: 2 },
                xpath: { selector: 'count(//title)' }
            };
            const request = { field: '<doc><title>first</title><title>second</title></doc>' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should accept booleans returning false', function () {
            const predicate = {
                equals: { field: false },
                xpath: { selector: 'boolean(//title)' }
            };
            const request = { field: '<doc></doc>' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return true if node exists even if no data in the node (issue #163)', function () {
            const predicate = {
                exists: { field: true },
                xpath: { selector: '//book' }
            };
            const request = { field: '<books><book></book></books>' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return false if node does not exist (issue #163)', function () {
            const predicate = {
                exists: { field: true },
                xpath: { selector: '//book' }
            };
            const request = { field: '<books></books>' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return true if node exists with child node data (issue #163)', function () {
            const predicate = {
                exists: { field: true },
                xpath: { selector: '//book' }
            };
            const request = { field: '<books><book><title>Game of Thrones</title></book></books>' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should support array predicates', function () {
            const predicate = {
                equals: { field: ['first', 'third', 'second'] },
                xpath: { selector: '//value' }
            };
            const request = { field: '<values><value>first</value><value>second</value><value>third</value></values>' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('#matches without case sensitivity should maintain selector to match XML (test for issue #361, already worked)', function () {
            const predicate = {
                matches: { body: '111\\.222\\.333\\.*' },
                xpath: { selector: '/ipAddress' }
            };
            const request = { body: '<ipAddress>111.222.333.456</ipAddress>' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });
    });
});
