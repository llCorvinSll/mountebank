import * as behaviors from '../../../src/models/behaviors/behaviors';
const Logger = require('../../fakes/fakeLogger');
const fs = require('fs');

describe('behaviors', function () {
    describe('#lookup', function () {
        it('should not be valid if not an array', function () {
            const errors = behaviors.validate({ lookup: {} } as any);
            expect(errors).toEqual([{
                code: 'bad data',
                message: 'lookup behavior "lookup" field must be an array',
                source: { lookup: {} }
            }]);
        });

        it('should not be valid if missing "key" field', function () {
            const config: any = {
                    fromDataSource: { csv: { path: '', keyColumn: '', columnInto: ['key'] } },
                    into: 'TOKEN'
                },
                errors = behaviors.validate({ lookup: [config] } as any);
            expect(errors).toEqual([{
                code: 'bad data',
                message: 'lookup behavior "key" field required',
                source: config
            }]);
        });

        it('should not be valid if missing "key.from" field', function () {
            const config: any = {
                    key: { using: { method: 'regex', selector: '.*' } },
                    fromDataSource: { csv: { path: '', keyColumn: '', columnInto: ['key'] } },
                    into: 'TOKEN'
                },
                errors = behaviors.validate({ lookup: [config] } as any);
            expect(errors).toEqual([{
                code: 'bad data',
                message: 'lookup behavior "key.from" field required',
                source: config
            }]);
        });

        it('should not be valid if missing "key.using" field', function () {
            const config: any = {
                    key: { from: 'data' },
                    fromDataSource: { csv: { path: '', keyColumn: '', columnInto: ['key'] } },
                    into: 'TOKEN'
                },
                errors = behaviors.validate({ lookup: [config] } as any);
            expect(errors).toEqual([{
                code: 'bad data',
                message: 'lookup behavior "key.using" field required',
                source: config
            }]);
        });

        it('should not be valid if "key.using" field is not an object', function () {
            const config: any = {
                    key: { from: 'data', using: 'regex' },
                    fromDataSource: { csv: { path: '', keyColumn: '', columnInto: ['key'] } },
                    into: 'TOKEN'
                },
                errors = behaviors.validate({ lookup: [config] } as any);
            expect(errors).toEqual([{
                code: 'bad data',
                message: 'lookup behavior "key.using" field must be an object',
                source: config
            }]);
        });

        it('should not be valid if "key.using.method" field is missing', function () {
            const config: any = {
                    key: { from: 'data', using: { selector: '.*' } },
                    fromDataSource: { csv: { path: '', keyColumn: '', columnInto: ['key'] } },
                    into: 'TOKEN'
                },
                errors = behaviors.validate({ lookup: [config] } as any);
            expect(errors).toEqual([{
                code: 'bad data',
                message: 'lookup behavior "key.using.method" field required',
                source: config
            }]);
        });

        it('should not be valid if "key.using.method" field is not supported', function () {
            const config: any = {
                    key: { from: 'data', using: { method: 'INVALID', selector: '.*' } },
                    fromDataSource: { csv: { path: '', keyColumn: '', columnInto: ['key'] } },
                    into: 'TOKEN'
                },
                errors = behaviors.validate({ lookup: [config] } as any);
            expect(errors).toEqual([{
                code: 'bad data',
                message: 'lookup behavior "key.using.method" field must be one of [regex, xpath, jsonpath]',
                source: config
            }]);
        });

        it('should not be valid if "key.using.selector" field is missing', function () {
            const config: any = {
                    key: { from: 'data', using: { method: 'regex' } },
                    fromDataSource: { csv: { path: '', keyColumn: '', columnInto: ['key'] } },
                    into: 'TOKEN'
                },
                errors = behaviors.validate({ lookup: [config] } as any);
            expect(errors).toEqual([{
                code: 'bad data',
                message: 'lookup behavior "key.using.selector" field required',
                source: config
            }]);
        });

        it('should not be valid if missing "fromDataSource" field', function () {
            const config: any = {
                    key: { from: 'data', using: { method: 'regex', selector: '.*' } },
                    into: 'TOKEN'
                },
                errors = behaviors.validate({ lookup: [config] } as any);
            expect(errors).toEqual([{
                code: 'bad data',
                message: 'lookup behavior "fromDataSource" field required',
                source: config
            }]);
        });

        it('should not be valid if "fromDataSource" field is not an object', function () {
            const config: any = {
                    key: { from: 'data', using: { method: 'regex', selector: '.*' } },
                    fromDataSource: 'csv',
                    into: 'TOKEN'
                },
                errors = behaviors.validate({ lookup: [config] } as any);
            expect(errors).toEqual([{
                code: 'bad data',
                message: 'lookup behavior "fromDataSource" field must be an object',
                source: config
            }]);
        });

        it('should not be valid if "fromDataSource" key is not supported', function () {
            const config: any = {
                    key: { from: 'data', using: { method: 'regex', selector: '.*' } },
                    fromDataSource: { invalid: {} },
                    into: 'TOKEN'
                },
                errors = behaviors.validate({ lookup: [config] } as any);
            expect(errors).toEqual([{
                code: 'bad data',
                message: 'lookup behavior "fromDataSource" field must be one of [csv]',
                source: config
            }]);
        });

        it('should not be valid if "fromDataSource" object multiple keys', function () {
            const config: any = {
                    key: { from: 'data', using: { method: 'regex', selector: '.*' } },
                    fromDataSource: { sql: {}, csv: { path: '', keyColumn: '', columnInto: ['key'] } },
                    into: 'TOKEN'
                },
                errors = behaviors.validate({ lookup: [config] } as any);
            expect(errors).toEqual([{
                code: 'bad data',
                message: 'lookup behavior "fromDataSource" field must have exactly one key',
                source: config
            }]);
        });

        it('should not be valid if missing "into" field', function () {
            const config: any = {
                key: {from: 'data', using: {method: 'regex', selector: '.*'}},
                fromDataSource: {csv: {path: '', keyColumn: '', columnInto: ['key']}}
            };
            const errors = behaviors.validate({lookup: [config]} as any);
            expect(errors).toEqual([{
                code: 'bad data',
                message: 'lookup behavior "into" field required',
                source: config
            }]);
        });

        describe('csv', function () {
            beforeEach(() => {
                fs.writeFileSync('lookupTest.csv',
                    'name,occupation,location\n' +
                    'mountebank,tester,worldwide\n' +
                    'Brandon,mountebank,Dallas\n' +
                    'Bob Barker,"The Price Is Right","Darrington, Washington"');
            });

            afterEach(() => {
                fs.unlinkSync('lookupTest.csv');
            });

            it('should log error and report nothing if file does not exist', function () {
                const request: any = {data: 'My name is mountebank'};
                const response: any = {data: 'Hello, ${you}["occupation"]'};
                const logger = Logger.create();
                const config: any = {
                    lookup: [{
                        key: {from: 'data', using: {method: 'regex', selector: '\\w+$'}},
                        fromDataSource: {csv: {path: 'INVALID.csv', keyColumn: 'name', delimiter: '|'}},
                        into: '${you}'
                    }]
                };

                return behaviors.execute(request, response, config, logger).then(actualResponse => {
                    expect(actualResponse).toEqual({ data: 'Hello, ${you}["occupation"]' });
                    logger.error.assertLogged('Cannot read INVALID.csv: ');
                });
            });

            it('should support lookup keyed by regex match from request', function () {
                const request: any = {data: 'My name is mountebank'};
                const response: any = {data: 'Hello, ${you}["occupation"]'};
                const logger = Logger.create();
                const config: any = {
                    lookup: [{
                        key: {from: 'data', using: {method: 'regex', selector: '\\w+$'}},
                        fromDataSource: {csv: {path: 'lookupTest.csv', keyColumn: 'name'}},
                        into: '${you}'
                    }]
                };

                return behaviors.execute(request, response, config, logger).then(actualResponse => {
                    expect(actualResponse).toEqual({ data: 'Hello, tester' });
                });
            });

            it('should support lookup keyed by regex match from request with ignoreCase', function () {
                const request: any = {data: 'My name is mountebank'};
                const response: any = {data: "Hello, ${you}['occupation']"};
                const logger = Logger.create();
                const config: any = {
                    lookup: [{
                        key: {
                            from: 'data',
                            using: {method: 'regex', selector: 'MOUNT\\w+$', options: {ignoreCase: true}}
                        },
                        fromDataSource: {csv: {path: 'lookupTest.csv', keyColumn: 'name'}},
                        into: '${you}'
                    }]
                };

                return behaviors.execute(request, response, config, logger).then(actualResponse => {
                    expect(actualResponse).toEqual({ data: 'Hello, tester' });
                });
            });

            it('should support lookup keyed by regex match from request with multiline', function () {
                const request: any = {data: 'First line\nMy name is mountebank\nThird line'};
                const response: any = {data: 'Hello, ${you}[occupation]'};
                const logger = Logger.create();
                const config: any = {
                    lookup: [{
                        key: {
                            from: 'data',
                            using: {method: 'regex', selector: 'mount\\w+$', options: {multiline: true}}
                        },
                        fromDataSource: {csv: {path: 'lookupTest.csv', keyColumn: 'name'}},
                        into: '${you}'
                    }]
                };

                return behaviors.execute(request, response, config, logger).then(actualResponse => {
                    expect(actualResponse).toEqual({ data: 'Hello, tester' });
                });
            });

            it('should not replace if regex does not match', function () {
                const request: any = {data: 'My name is mountebank'};
                const response: any = {data: 'Hello, ${you}[occupation]'};
                const logger = Logger.create();
                const config: any = {
                    lookup: [{
                        key: {
                            from: 'data',
                            using: {method: 'regex', selector: 'Mi nombre es (\\w+)$'}
                        },
                        fromDataSource: {csv: {path: 'lookupTest.csv', keyColumn: 'name'}},
                        into: '${you}'
                    }]
                };

                return behaviors.execute(request, response, config, logger).then(actualResponse => {
                    expect(actualResponse).toEqual({ data: 'Hello, ${you}[occupation]' });
                });
            });

            it('should support lookup replace keyed by regex match into object response field', function () {
                const request: any = {data: 'My name is mountebank'};
                const response: any = {outer: {inner: 'Hello, ${you}["occupation"]'}};
                const logger = Logger.create();
                const config: any = {
                    lookup: [{
                        key: {from: 'data', using: {method: 'regex', selector: '\\w+$'}},
                        fromDataSource: {csv: {path: 'lookupTest.csv', keyColumn: 'name'}},
                        into: '${you}'
                    }]
                };

                return behaviors.execute(request, response, config, logger).then(actualResponse => {
                    expect(actualResponse).toEqual({ outer: { inner: 'Hello, tester' } });
                });
            });

            it('should support lookup replacement into all response fields', function () {
                const request: any = {data: 'My name is mountebank'};
                const response: any = {data: '${you}[location]', outer: {inner: 'Hello, ${you}[occupation]'}};
                const logger = Logger.create();
                const config: any = {
                    lookup: [{
                        key: {from: 'data', using: {method: 'regex', selector: '\\w+$'}},
                        fromDataSource: {csv: {path: 'lookupTest.csv', keyColumn: 'name'}},
                        into: '${you}'
                    }]
                };

                return behaviors.execute(request, response, config, logger).then(actualResponse => {
                    expect(actualResponse).toEqual({ data: 'worldwide', outer: { inner: 'Hello, tester' } });
                });
            });

            it('should support lookup replacement from object request field', function () {
                const request: any = {data: {name: 'My name is mountebank', other: 'ignore'}};
                const response: any = {data: 'Hello, ${you}[occupation]'};
                const logger = Logger.create();
                const config: any = {
                    lookup: [{
                        key: {from: {data: 'name'}, using: {method: 'regex', selector: '\\w+$'}},
                        fromDataSource: {csv: {path: 'lookupTest.csv', keyColumn: 'name'}},
                        into: '${you}'
                    }]
                };

                return behaviors.execute(request, response, config, logger).then(actualResponse => {
                    expect(actualResponse).toEqual({ data: 'Hello, tester' });
                });
            });

            it('should support lookup replacement from object request field ignoring case of key', function () {
                const request: any = {data: {name: 'My name is mountebank', other: 'ignore'}};
                const response: any = {data: 'Hello, ${you}[occupation]'};
                const logger = Logger.create();
                const config: any = {
                    lookup: [{
                        key: {from: {data: 'NAME'}, using: {method: 'regex', selector: '\\w+$'}},
                        fromDataSource: {csv: {path: 'lookupTest.csv', keyColumn: 'name'}},
                        into: '${you}'
                    }]
                };

                return behaviors.execute(request, response, config, logger).then(actualResponse => {
                    expect(actualResponse).toEqual({ data: 'Hello, tester' });
                });
            });

            it('should support lookup replacement keyed by regex indexed group from request', function () {
                const request: any = {name: 'My name is mountebank'};
                const response: any = {data: 'Hello, ${you}[occupation]'};
                const logger = Logger.create();
                const config: any = {
                    lookup: [{
                        key: {
                            from: 'name',
                            using: {method: 'regex', selector: 'My name is (\\w+)'},
                            index: 1
                        },
                        fromDataSource: {csv: {path: 'lookupTest.csv', keyColumn: 'name'}},
                        into: '${you}'
                    }]
                };

                return behaviors.execute(request, response, config, logger).then(actualResponse => {
                    expect(actualResponse).toEqual({ data: 'Hello, tester' });
                });
            });

            it('should default to first value in multi-valued request field', function () {
                const request: any = {data: ['Brandon', 'mountebank', 'Bob Barker']};
                const response: any = {data: 'Hello, ${you}[occupation]'};
                const logger = Logger.create();
                const config: any = {
                    lookup: [{
                        key: {from: 'data', using: {method: 'regex', selector: '\\w+'}},
                        fromDataSource: {csv: {path: 'lookupTest.csv', keyColumn: 'name'}},
                        into: '${you}'
                    }]
                };

                return behaviors.execute(request, response, config, logger).then(actualResponse => {
                    expect(actualResponse).toEqual({ data: 'Hello, mountebank' });
                });
            });

            it('should support lookup keyed by xpath match into response', function () {
                const request: any = {field: '<doc><name>mountebank</name></doc>'};
                const response: any = {data: 'Hello, ${you}["occupation"]'};
                const logger = Logger.create();
                const config: any = {
                    lookup: [{
                        key: {from: 'field', using: {method: 'xpath', selector: '//name'}},
                        fromDataSource: {csv: {path: 'lookupTest.csv', keyColumn: 'name'}},
                        into: '${you}'
                    }]
                };

                return behaviors.execute(request, response, config, logger).then(actualResponse => {
                    expect(actualResponse).toEqual({ data: 'Hello, tester' });
                });
            });

            it('should ignore xpath if does not match', function () {
                const request: any = {field: '<doc><name>mountebank</name></doc>'};
                const response: any = {data: 'Hello, ${you}[occupation]'};
                const logger = Logger.create();
                const config: any = {
                    lookup: [{
                        key: {from: 'field', using: {method: 'xpath', selector: '//title'}},
                        fromDataSource: {csv: {path: 'lookupTest.csv', keyColumn: 'name'}},
                        into: '${you}'
                    }]
                };

                return behaviors.execute(request, response, config, logger).then(actualResponse => {
                    expect(actualResponse).toEqual({ data: 'Hello, ${you}[occupation]' });
                });
            });

            it('should ignore xpath if field is not xml', function () {
                const request: any = {field: ''};
                const response: any = {data: 'Hello, ${you}[occupation]'};
                const logger = Logger.create();
                const config: any = {
                    lookup: [{
                        key: {from: 'field', using: {method: 'xpath', selector: '//title'}},
                        fromDataSource: {csv: {path: 'lookupTest.csv', keyColumn: 'name'}},
                        into: '${you}'
                    }]
                };

                return behaviors.execute(request, response, config, logger).then(actualResponse => {
                    expect(actualResponse).toEqual({ data: 'Hello, ${you}[occupation]' });
                    logger.warn.assertLogged('[xmldom error]\tinvalid doc source\n@#[line:undefined,col:undefined] (source: "")');
                });
            });

            it('should support lookup keyed by xml attribute', function () {
                const request: any = {field: '<doc><tool name="mountebank">Service virtualization</tool></doc>'};
                const response: any = {data: 'Hello, ${you}[occupation]'};
                const logger = Logger.create();
                const config: any = {
                    lookup: [{
                        key: {from: 'field', using: {method: 'xpath', selector: '//tool/@name'}},
                        fromDataSource: {csv: {path: 'lookupTest.csv', keyColumn: 'name'}},
                        into: '${you}'
                    }]
                };

                return behaviors.execute(request, response, config, logger).then(actualResponse => {
                    expect(actualResponse).toEqual({ data: 'Hello, tester' });
                });
            });

            it('should support lookup keyed by xml direct text', function () {
                const request: any = {field: '<doc><name>mountebank</name></doc>'};
                const response: any = {data: 'Hello, ${you}["occupation"]'};
                const logger = Logger.create();
                const config: any = {
                    lookup: [{
                        key: {from: 'field', using: {method: 'xpath', selector: '//name/text()'}},
                        fromDataSource: {csv: {path: 'lookupTest.csv', keyColumn: 'name'}},
                        into: '${you}'
                    }]
                };

                return behaviors.execute(request, response, config, logger).then(actualResponse => {
                    expect(actualResponse).toEqual({ data: 'Hello, tester' });
                });
            });

            it('should support lookup keyed by namespaced xml field', function () {
                const request: any = {field: '<doc xmlns:mb="http://example.com/mb"><mb:name>mountebank</mb:name></doc>'};
                const response: any = {data: 'Hello, ${you}[occupation]'};
                const logger = Logger.create();
                const config: any = {
                    lookup: [{
                        key: {
                            from: 'field',
                            using: {
                                method: 'xpath',
                                selector: '//mb:name',
                                ns: {mb: 'http://example.com/mb'}
                            }
                        },
                        fromDataSource: {csv: {path: 'lookupTest.csv', keyColumn: 'name'}},
                        into: '${you}'
                    }]
                };

                return behaviors.execute(request, response, config, logger).then(actualResponse => {
                    expect(actualResponse).toEqual({ data: 'Hello, tester' });
                });
            });

            it('should support lookup keyed by indexed xpath match', function () {
                const request: any = {field: '<doc><name>Bob Barker</name><name>mountebank</name><name>Brandon</name></doc>'};
                const response: any = {data: 'Hello ${you}[occupation]'};
                const logger = Logger.create();
                const config: any = {
                    lookup: [{
                        key: {from: 'field', using: {method: 'xpath', selector: '//name'}, index: 2},
                        fromDataSource: {csv: {path: 'lookupTest.csv', keyColumn: 'name'}},
                        into: '${you}'
                    }]
                };

                return behaviors.execute(request, response, config, logger).then(actualResponse => {
                    expect(actualResponse).toEqual({ data: 'Hello mountebank' });
                });
            });

            it('should ignore jsonpath selector if field is not json', function () {
                const request: any = {field: 'mountebank'};
                const response: any = {data: 'Hello, ${you}[occupation]'};
                const logger = Logger.create();
                const config: any = {
                    lookup: [{
                        key: {from: 'field', using: {method: 'jsonpath', selector: '$..name'}},
                        fromDataSource: {csv: {path: 'lookupTest.csv', keyColumn: 'name'}},
                        into: '${you}[occupation]'
                    }]
                };

                return behaviors.execute(request, response, config, logger).then(actualResponse => {
                    expect(actualResponse).toEqual({ data: 'Hello, ${you}[occupation]' });
                    logger.warn.assertLogged('Cannot parse as JSON: "mountebank"');
                });
            });

            it('should support lookup keyed on jsonpath selector', function () {
                const request: any = {field: JSON.stringify({name: 'mountebank'})};
                const response: any = {data: 'Hello, ${you}[occupation]'};
                const logger = Logger.create();
                const config: any = {
                    lookup: [{
                        key: {from: 'field', using: {method: 'jsonpath', selector: '$..name'}},
                        fromDataSource: {csv: {path: 'lookupTest.csv', keyColumn: 'name'}},
                        into: '${you}'
                    }]
                };

                return behaviors.execute(request, response, config, logger).then(actualResponse => {
                    expect(actualResponse).toEqual({ data: 'Hello, tester' });
                });
            });

            it('should not replace token if jsonpath selector does not match', function () {
                const request: any = {field: JSON.stringify({name: 'mountebank'})};
                const response: any = {data: 'Hello, ${you}[occupation]'};
                const logger = Logger.create();
                const config: any = {
                    lookup: [{
                        key: {from: 'field', using: {method: 'jsonpath', selector: '$..title'}},
                        fromDataSource: {csv: {path: 'lookupTest.csv', keyColumn: 'name'}},
                        into: '${you}'
                    }]
                };

                return behaviors.execute(request, response, config, logger).then(actualResponse => {
                    expect(actualResponse).toEqual({ data: 'Hello, ${you}[occupation]' });
                });
            });

            it('should support lookup keyed on indexed token with jsonpath selector', function () {
                const request: any = {
                    field: JSON.stringify({
                        people: [{name: 'mountebank'}, {name: 'Bob Barker'}, {name: 'Brandon'}]
                    })
                };
                const response: any = {data: 'Hello, ${you}[occupation]'};
                const logger = Logger.create();
                const config: any = {
                    lookup: [{
                        key: {from: 'field', using: {method: 'jsonpath', selector: '$..name'}, index: 1},
                        fromDataSource: {csv: {path: 'lookupTest.csv', keyColumn: 'name'}},
                        into: '${you}'
                    }]
                };

                return behaviors.execute(request, response, config, logger).then(actualResponse => {
                    expect(actualResponse).toEqual({ data: 'Hello, The Price Is Right' });
                });
            });

            it('should not replace if index exceeds options', function () {
                const request: any = {
                    field: JSON.stringify({
                        people: [{name: 'mountebank'}, {name: 'Bob Barker'}, {name: 'Brandon'}]
                    })
                };
                const response: any = {data: 'Hello, ${you}[occupation]'};
                const logger = Logger.create();
                const config: any = {
                    lookup: [{
                        key: {from: 'field', using: {method: 'jsonpath', selector: '$..name'}, index: 10},
                        fromDataSource: {csv: {path: 'lookupTest.csv', keyColumn: 'name'}},
                        into: '${you}'
                    }]
                };

                return behaviors.execute(request, response, config, logger).then(actualResponse => {
                    expect(actualResponse).toEqual({ data: 'Hello, ${you}[occupation]' });
                });
            });

            it('should support lookup of value with embedded comma', function () {
                const request: any = {field: 'The Price Is Right'};
                const response: any = {data: 'Hello, ${you}[location]'};
                const logger = Logger.create();
                const config: any = {
                    lookup: [{
                        key: {from: 'field', using: {method: 'regex', selector: '.*'}},
                        fromDataSource: {csv: {path: 'lookupTest.csv', keyColumn: 'occupation'}},
                        into: '${you}'
                    }]
                };

                return behaviors.execute(request, response, config, logger).then(actualResponse => {
                    expect(actualResponse).toEqual({ data: 'Hello, Darrington, Washington' });
                });
            });

            it('should not be valid if "fromDataSource.csv" is not an object', function () {
                const config: any = {
                    key: {from: 'data', using: {method: 'regex', selector: '.*'}},
                    fromDataSource: {csv: ''},
                    into: 'TOKEN'
                };
                const errors = behaviors.validate({lookup: [config]});
                expect(errors).toEqual([{
                    code: 'bad data',
                    message: 'lookup behavior "fromDataSource.csv" field must be an object',
                    source: config
                }]);
            });

            it('should not be valid if "fromDataSource.csv.path" missing', function () {
                const config: any = {
                    key: {from: 'data', using: {method: 'regex', selector: '.*'}},
                    fromDataSource: {csv: {keyColumn: '', columnInto: ['key']}},
                    into: 'TOKEN'
                };
                const errors = behaviors.validate({lookup: [config]});
                expect(errors).toEqual([{
                    code: 'bad data',
                    message: 'lookup behavior "fromDataSource.csv.path" field required',
                    source: config
                }]);
            });

            it('should not be valid if "fromDataSource.csv.path" is not a string', function () {
                const config: any = {
                    key: {from: 'data', using: {method: 'regex', selector: '.*'}},
                    fromDataSource: {csv: {path: 0, keyColumn: '', columnInto: ['key']}},
                    into: 'TOKEN'
                };
                const errors = behaviors.validate({lookup: [config]} as any);
                expect(errors).toEqual([{
                    code: 'bad data',
                    message: 'lookup behavior "fromDataSource.csv.path" field must be a string, representing the path to the CSV file',
                    source: config
                }]);
            });

            it('should not be valid if "fromDataSource.csv.keyColumn" missing', function () {
                const config: any = {
                    key: {from: 'data', using: {method: 'regex', selector: '.*'}},
                    fromDataSource: {csv: {path: '', columnInto: ['key']}},
                    into: 'TOKEN'
                };
                const errors = behaviors.validate({lookup: [config]});
                expect(errors).toEqual([{
                    code: 'bad data',
                    message: 'lookup behavior "fromDataSource.csv.keyColumn" field required',
                    source: config
                }]);
            });

            it('should not be valid if "fromDataSource.csv.keyColumn" is not a string', function () {
                const config: any = {
                    key: {from: 'data', using: {method: 'regex', selector: '.*'}},
                    fromDataSource: {csv: {path: '', keyColumn: 0, columnInto: ['key']}},
                    into: 'TOKEN'
                };
                const errors = behaviors.validate({lookup: [config]});
                expect(errors).toEqual([{
                    code: 'bad data',
                    message: 'lookup behavior "fromDataSource.csv.keyColumn" field must be a string, representing the column header to select against the "key" field',
                    source: config
                }]);
            });

            describe('csv-delimiter', () => {
                beforeEach(() => {
                    fs.writeFileSync('lookupDelimiterTest.csv',
                        'name|occupation|location\n' +
                        'mountebank|tester|worldwide\n' +
                        'Brandon|mountebank|Dallas\n' +
                        'Bob Barker|"The Price Is Right"|"Darrington, Washington"\n' +
                        'jeanpaulct|developer|Peru');
                });

                afterEach(() => {
                    fs.unlinkSync('lookupDelimiterTest.csv');
                });

                it('should not be lookup if "CSV headers" does not contains "keyColumn"', () => {
                    const request: any = {field: JSON.stringify({name: 'jeanpaulct'})};
                    const response: any = {data: 'Hello from ${you}[location]'};
                    const logger = Logger.create();
                    const config: any = {
                        lookup: [{
                            key: {from: 'field', using: {method: 'jsonpath', selector: '$..name'}},
                            fromDataSource: {csv: {path: 'lookupDelimiterTest.csv', keyColumn: 'name'}},
                            into: '${you}'
                        }]
                    };

                    return behaviors.execute(request, response, config, logger).then(actualResponse => {
                        expect(actualResponse).toEqual({ data: 'Hello from ${you}[location]' });
                        logger.error.assertLogged('CSV headers "name|occupation|location" with delimiter "," does not contain keyColumn:"name"');
                    });
                });

                it('should be lookup with custom delimiter', () => {
                    const request: any = {field: JSON.stringify({name: 'jeanpaulct'})};
                    const response: any = {data: 'Regards from ${you}[location]'};
                    const logger = Logger.create();
                    const config: any = {
                        lookup: [{
                            key: {from: 'field', using: {method: 'jsonpath', selector: '$..name'}},
                            fromDataSource: {csv: {path: 'lookupDelimiterTest.csv', keyColumn: 'name', delimiter: '|'}},
                            into: '${you}'
                        }]
                    };

                    return behaviors.execute(request, response, config, logger).then(actualResponse => {
                        expect(actualResponse).toEqual({ data: 'Regards from Peru' });
                    });
                });


            });
        });
    });
});
