

import * as behaviors from '../../../src/models/behaviors/behaviors';
const Logger = require('../../fakes/fakeLogger');

describe('behaviors', () => {
    describe('#copy', () => {
        it('should support copying regex match from request', function () {
            const request: any = { data: 'My name is mountebank' };
            const response: any = { data: 'Hello, ${you}' };
            const logger: any = Logger.create();
            const config: any = {
                copy: [{
                    from: 'data',
                    into: '${you}',
                    using: { method: 'regex', selector: '\\w+$' }
                }]
            };

            return behaviors.execute(request, response, config, logger).then((actualResponse) => {
                expect(actualResponse).toEqual({ data: 'Hello, mountebank' });
            });
        });

        it('should support copying regex match from request with ignoreCase', function () {
            const request: any = { data: 'My name is mountebank' };
            const response: any = { data: 'Hello, ${you}' };
            const logger: any = Logger.create();
            const config: any = {
                copy: [{
                    from: 'data',
                    into: '${you}',
                    using: {
                        method: 'regex',
                        selector: 'MOUNT\\w+$',
                        options: { ignoreCase: true }
                    }
                }]
            };

            return behaviors.execute(request, response, config, logger).then(actualResponse => {
                expect(actualResponse).toEqual({ data: 'Hello, mountebank' });
            });
        });

        it('should support copying regex match from request with multiline', function () {
            const request: any = { data: 'First line\nMy name is mountebank\nThird line' };
            const response: any = { data: 'Hello, ${you}' };
            const logger: any = Logger.create();
            const config: any = {
                copy: [{
                    from: 'data',
                    into: '${you}',
                    using: {
                        method: 'regex',
                        selector: 'mount\\w+$',
                        options: { multiline: true }
                    }
                }]
            };

            return behaviors.execute(request, response, config, logger).then(actualResponse => {
                expect(actualResponse).toEqual({ data: 'Hello, mountebank' });
            });
        });

        it('should not replace if regex does not match', function () {
            const request: any = { data: 'My name is mountebank' };
            const response: any = { data: 'Hello, ${you}' };
            const logger: any = Logger.create();
            const config: any = {
                copy: [{
                    from: 'data',
                    into: '${you}',
                    using: {
                        method: 'regex',
                        selector: 'Mi nombre es (\\w+)$'
                    }
                }]
            };

            return behaviors.execute(request, response, config, logger).then(actualResponse => {
                expect(actualResponse).toEqual({ data: 'Hello, ${you}' });
            });
        });

        it('should support copying regex match into object response field', function () {
            const request: any = { data: 'My name is mountebank' };
            const response: any = { outer: { inner: 'Hello, ${you}' } };
            const logger: any = Logger.create();
            const config: any = {
                copy: [{
                    from: 'data',
                    into: '${you}',
                    using: { method: 'regex', selector: '\\w+$' }
                }]
            };

            return behaviors.execute(request, response, config, logger).then(actualResponse => {
                expect(actualResponse).toEqual({ outer: { inner: 'Hello, mountebank' } });
            });
        });

        it('should support copying regex match into all response fields', function () {
            const request: any = { data: 'My name is mountebank' };
            const response: any = { data: '${you}', outer: { inner: 'Hello, ${you}' } };
            const logger: any = Logger.create();
            const config: any = {
                copy: [{
                    from: 'data',
                    into: '${you}',
                    using: { method: 'regex', selector: '\\w+$' }
                }]
            };

            return behaviors.execute(request, response, config, logger).then(actualResponse => {
                expect(actualResponse).toEqual({ data: 'mountebank', outer: { inner: 'Hello, mountebank' } });
            });
        });

        it('should support copying regex match from object request field', function () {
            const request: any = { data: { name: 'My name is mountebank', other: 'ignore' } };
            const response: any = { data: 'Hello, ${you}' };
            const logger: any = Logger.create();
            const config: any = {
                copy: [{
                    from: { data: 'name' },
                    into: '${you}',
                    using: { method: 'regex', selector: '\\w+$' }
                }]
            };

            return behaviors.execute(request, response, config, logger).then(actualResponse => {
                expect(actualResponse).toEqual({ data: 'Hello, mountebank' });
            });
        });

        it('should support copying regex match from object request field ignoring case of key', function () {
            const request: any = { data: { name: 'My name is mountebank', other: 'ignore' } };
            const response: any= { data: 'Hello, ${you}' };
            const logger: any = Logger.create();
            const config: any = {
                copy: [{
                    from: { data: 'NAME' },
                    into: '${you}',
                    using: { method: 'regex', selector: '\\w+$' }
                }]
            };

            return behaviors.execute(request, response, config, logger).then(actualResponse => {
                expect(actualResponse).toEqual({ data: 'Hello, mountebank' });
            });
        });

        it('should support copying regex indexed groups from request', function () {
            const request: any = { name: 'The date is 2016-12-29' };
            const response: any= { data: 'Year ${DATE}[1], Month ${DATE}[2], Day ${DATE}[3]: ${DATE}' };
            const logger: any = Logger.create();
            const config: any = {
                copy: [{
                    from: 'name',
                    into: '${DATE}',
                    using: { method: 'regex', selector: '(\\d{4})-(\\d{2})-(\\d{2})' }
                }]
            };

            return behaviors.execute(request, response, config, logger).then(actualResponse => {
                expect(actualResponse).toEqual({ data: 'Year 2016, Month 12, Day 29: 2016-12-29' });
            });
        });

        it('should default to first value in multi-valued request field', function () {
            const request: any = { data: ['first', 'second', 'third'] };
            const response: any= { data: 'Grabbed the ${num}' };
            const logger: any = Logger.create();
            const config: any = {
                copy: [{
                    from: 'data',
                    into: '${num}',
                    using: { method: 'regex', selector: '\\w+$' }
                }]
            };

            return behaviors.execute(request, response, config, logger).then(actualResponse => {
                expect(actualResponse).toEqual({ data: 'Grabbed the first' });
            });
        });

        it('should support copying xpath match into response', function () {
            const request: any = { field: '<doc><name>mountebank</name></doc>' };
            const response: any= { data: 'Hello, ${you}' };
            const logger: any = Logger.create();
            const config: any = {
                copy: [{
                    from: 'field',
                    into: '${you}',
                    using: { method: 'xpath', selector: '//name' }
                }]
            };

            return behaviors.execute(request, response, config, logger).then(actualResponse => {
                expect(actualResponse).toEqual({ data: 'Hello, mountebank' });
            });
        });

        it('should ignore xpath if does not match', function () {
            const request: any = { field: '<doc><name>mountebank</name></doc>' };
            const response: any= { data: 'Hello, ${you}' };
            const logger: any = Logger.create();
            const config: any = {
                copy: [{
                    from: 'field',
                    into: '${you}',
                    using: { method: 'xpath', selector: '//title' }
                }]
            };

            return behaviors.execute(request, response, config, logger).then(actualResponse => {
                expect(actualResponse).toEqual({ data: 'Hello, ${you}' });
            });
        });

        it('should ignore xpath if field is not xml', function () {
            const request: any = { field: '' };
            const response: any= { data: 'Hello, ${you}' };
            const logger: any = Logger.create();
            const config: any = {
                copy: [{
                    from: 'field',
                    into: '${you}',
                    using: { method: 'xpath', selector: '//title' }
                }]
            };

            return behaviors.execute(request, response, config, logger).then(actualResponse => {
                expect(actualResponse).toEqual({ data: 'Hello, ${you}' });
                logger.warn.assertLogged('[xmldom error]\tinvalid doc source\n@#[line:undefined,col:undefined] (source: "")');
            });
        });

        it('should support replacing token with xml attribute', function () {
            const request: any = { field: '<doc><tool name="mountebank">Service virtualization</tool></doc>' };
            const response: any= { data: 'Hello, ${you}' };
            const logger: any = Logger.create();
            const config: any = {
                copy: [{
                    from: 'field',
                    into: '${you}',
                    using: { method: 'xpath', selector: '//tool/@name' }
                }]
            };

            return behaviors.execute(request, response, config, logger).then(actualResponse => {
                expect(actualResponse).toEqual({ data: 'Hello, mountebank' });
            });
        });

        it('should support replacing token with xml direct text', function () {
            const request: any = { field: '<doc><name>mountebank</name></doc>' };
            const response: any= { data: 'Hello, ${you}' };
            const logger: any = Logger.create();
            const config: any = {
                copy: [{
                    from: 'field',
                    into: '${you}',
                    using: { method: 'xpath', selector: '//name/text()' }
                }]
            };

            return behaviors.execute(request, response, config, logger).then(actualResponse => {
                expect(actualResponse).toEqual({ data: 'Hello, mountebank' });
            });
        });

        it('should support replacing token with namespaced xml field', function () {
            const request: any = { field: '<doc xmlns:mb="http://example.com/mb"><mb:name>mountebank</mb:name></doc>' };
            const response: any= { data: 'Hello, ${you}' };
            const logger: any = Logger.create();
            const config: any = {
                copy: [{
                    from: 'field',
                    into: '${you}',
                    using: {
                        method: 'xpath',
                        selector: '//mb:name',
                        ns: { mb: 'http://example.com/mb' }
                    }
                }]
            };

            return behaviors.execute(request, response, config, logger).then(actualResponse => {
                expect(actualResponse).toEqual({ data: 'Hello, mountebank' });
            });
        });

        it('should support multiple indexed xpath matches into response', function () {
            const request: any = { field: '<doc><num>3</num><num>2</num><num>1</num></doc>' };
            const response: any= { data: '${NUM}, ${NUM}[1], ${NUM}[2]' };
            const logger: any = Logger.create();
            const config: any = {
                copy: [{
                    from: 'field',
                    into: '${NUM}',
                    using: { method: 'xpath', selector: '//num' }
                }]
            };

            return behaviors.execute(request, response, config, logger).then(actualResponse => {
                expect(actualResponse).toEqual({ data: '3, 2, 1' });
            });
        });

        it('should ignore jsonpath selector if field is not json', function () {
            const request: any = { field: 'mountebank' };
            const response: any= { data: 'Hello, ${you}' };
            const logger: any = Logger.create();
            const config: any = {
                copy: [{
                    from: 'field',
                    into: '${you}',
                    using: { method: 'jsonpath', selector: '$..name' }
                }]
            };

            return behaviors.execute(request, response, config, logger).then(actualResponse => {
                expect(actualResponse).toEqual({ data: 'Hello, ${you}' });
                logger.warn.assertLogged('Cannot parse as JSON: "mountebank"');
            });
        });

        it('should support replacing token with jsonpath selector', function () {
            const request: any = { field: JSON.stringify({ name: 'mountebank' }) };
            const response: any= { data: 'Hello, ${you}' };
            const logger: any = Logger.create();
            const config: any = {
                copy: [{
                    from: 'field',
                    into: '${you}',
                    using: { method: 'jsonpath', selector: '$..name' }
                }]
            };

            return behaviors.execute(request, response, config, logger).then(actualResponse => {
                expect(actualResponse).toEqual({ data: 'Hello, mountebank' });
            });
        });

        it('should not replace token if jsonpath selector does not match', function () {
            const request: any = { field: JSON.stringify({ name: 'mountebank' }) };
            const response: any= { data: 'Hello, ${you}' };
            const logger: any = Logger.create();
            const config: any = {
                copy: [{
                    from: 'field',
                    into: '${you}',
                    using: { method: 'jsonpath', selector: '$..title' }
                }]
            };

            return behaviors.execute(request, response, config, logger).then(actualResponse => {
                expect(actualResponse).toEqual({ data: 'Hello, ${you}' });
            });
        });

        it('should support replacing multiple indexed tokens with jsonpath selector', function () {
            const request: any = { field: JSON.stringify({ numbers: [{ key: 3 }, { key: 2 }, { key: 1 }] }) };
            const response: any= { data: '${NUM}, ${NUM}[1], ${NUM}[2]' };
            const logger: any = Logger.create();
            const config: any = {
                copy: [{
                    from: 'field',
                    into: '${NUM}',
                    using: { method: 'jsonpath', selector: '$..key' }
                }]
            };

            return behaviors.execute(request, response, config, logger).then(actualResponse => {
                expect(actualResponse).toEqual({ data: '3, 2, 1' });
            });
        });

        it('should accept null response fields (issue #394)', function () {
            const request: any = { field: JSON.stringify({ name: 'mountebank' }) };
            const response: any= { first: null, second: 'TOKEN' };
            const logger: any = Logger.create();
            const config: any = {
                copy: [{
                    from: 'field',
                    into: 'TOKEN',
                    using: { method: 'jsonpath', selector: '$..name' }
                }]
            };

            return behaviors.execute(request, response, config, logger).then(actualResponse => {
                expect(actualResponse).toEqual({ first: null, second: 'mountebank' });
            });
        });

        it('should not be valid if not an array', function () {
            const errors: any = behaviors.validate({
                copy: {}
            } as any);
            expect(errors).toEqual([{
                code: 'bad data',
                message: 'copy behavior "copy" field must be an array',
                source: { copy: {} }
            }]);
        });

        it('should not be valid if missing "from" field', function () {
            const config: any = { into: 'TOKEN', using: { method: 'regex', selector: '.*' } };
            const errors = behaviors.validate({ copy: [config] } as any);
            expect(errors).toEqual([{
                code: 'bad data',
                message: 'copy behavior "from" field required',
                source: config
            }]);
        });

        it('should not be valid if "from" field is not a string or an object', function () {
            const config: any = { from: 0, into: 'TOKEN', using: { method: 'regex', selector: '.*' } };
            const errors = behaviors.validate({ copy: [config] } as any);
            expect(errors).toEqual([{
                code: 'bad data',
                message: 'copy behavior "from" field must be a string or an object, representing the request field to select from',
                source: config
            }]);
        });

        it('should not be valid if "from" object field has zero keys', function () {
            const config: any = {
                from: {},
                into: 'TOKEN',
                using: { method: 'regex', selector: '.*' }
            };
            const errors = behaviors.validate({ copy: [config] } as any);
            expect(errors).toEqual([{
                code: 'bad data',
                message: 'copy behavior "from" field must have exactly one key',
                source: config
            }]);
        });

        it('should not be valid if "from" object field has multiple keys', function () {
            const config: any = {
                from: { first: 'first', second: 'second' },
                into: 'TOKEN',
                using: { method: 'regex', selector: '.*' }
            };
            const errors = behaviors.validate({ copy: [config] } as any);
            expect(errors).toEqual([{
                code: 'bad data',
                message: 'copy behavior "from" field must have exactly one key',
                source: config
            }]);
        });

        it('should not be valid if missing "into" field', function () {
            const config: any = { from: 'field', using: { method: 'regex', selector: '.*' } };
            const errors = behaviors.validate({ copy: [config] } as any);
            expect(errors).toEqual([{
                code: 'bad data',
                message: 'copy behavior "into" field required',
                source: config
            }]);
        });

        it('should not be valid if "into" field is not a string', function () {
            const config: any = { from: 'field', into: 0, using: { method: 'regex', selector: '.*' } };
            const errors = behaviors.validate({ copy: [config] } as any);
            expect(errors).toEqual([{
                code: 'bad data',
                message: 'copy behavior "into" field must be a string, representing the token to replace in response fields',
                source: config
            }]);
        });

        it('should not be valid if missing "using" field', function () {
            const config: any = { from: 'field', into: 'TOKEN' };
            const errors = behaviors.validate({ copy: [config] } as any);
            expect(errors).toEqual([{
                code: 'bad data',
                message: 'copy behavior "using" field required',
                source: config
            }]);
        });

        it('should not be valid if "using.method" field is missing', function () {
            const config: any = { from: 'field', into: 'TOKEN', using: { selector: '.*' } };
            const errors = behaviors.validate({ copy: [config] } as any);
            expect(errors).toEqual([{
                code: 'bad data',
                message: 'copy behavior "using.method" field required',
                source: config
            }]);
        });

        it('should not be valid if "using.method" field is not supported', function () {
            const config: any = { from: 'field', into: 'TOKEN', using: { method: 'INVALID', selector: '.*' } };
            const errors = behaviors.validate({ copy: [config] } as any);
            expect(errors).toEqual([{
                code: 'bad data',
                message: 'copy behavior "using.method" field must be one of [regex, xpath, jsonpath]',
                source: config
            }]);
        });

        it('should not be valid if "using.selector" field is missing', function () {
            const config: any = { from: 'field', into: 'TOKEN', using: { method: 'regex' } };
            const errors = behaviors.validate({ copy: [config] } as any);
            expect(errors).toEqual([{
                code: 'bad data',
                message: 'copy behavior "using.selector" field required',
                source: config
            }]);
        });
    });
});
