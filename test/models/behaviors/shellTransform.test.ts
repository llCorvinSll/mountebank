const assert = require('assert');
import * as util from 'util';
import * as behaviors from '../../../src/models/behaviors/behaviors';
const Logger = require('../../fakes/fakeLogger');
import * as fs from 'fs';

describe('behaviors', function () {
    describe('#shellTransform', function () {
        it('should not execute during dry run', function () {
            const request: any = { isDryRun: true };
            const response: any = { data: 'ORIGINAL' };
            const logger = Logger.create();
            const config: any = { shellTransform: ['echo Should not reach here'] };

            return behaviors.execute(request, response, config, logger).then(actualResponse => {
                expect(actualResponse).toEqual({ data: 'ORIGINAL' });
            });
        });

        it('should return output of command', function () {
            const request: any = {};
            const response: any = { data: 'ORIGINAL' };
            const logger = Logger.create();
            const shellFn = function exec () {
                console.log(JSON.stringify({ data: 'CHANGED' }));
            };
            const config: any = { shellTransform: ['node shellTransformTest.js'] };

            fs.writeFileSync('shellTransformTest.js', util.format('%s\nexec();', shellFn.toString()));

            return behaviors.execute(request, response, config, logger).then(actualResponse => {
                expect(actualResponse).toEqual({ data: 'CHANGED' });
            }).finally(() => {
                fs.unlinkSync('shellTransformTest.js');
            });
        });

        it('should pass request and response to shell command', function () {
            const request: any = { data: 'FROM REQUEST' };
            const response: any = { data: 'UNCHANGED', requestData: '' };
            const logger = Logger.create();
            const shellFn = function exec () {
                // The replace of quotes only matters on Windows due to shell differences
                const shellRequest = JSON.parse(process.argv[2].replace("'", ''));
                const shellResponse = JSON.parse(process.argv[3].replace("'", ''));

                shellResponse.requestData = shellRequest.data;
                console.log(JSON.stringify(shellResponse));
            };
            const config: any = { shellTransform: ['node shellTransformTest.js'] };

            fs.writeFileSync('shellTransformTest.js', util.format('%s\nexec();', shellFn.toString()));

            return behaviors.execute(request, response, config, logger).then(actualResponse => {
                expect(actualResponse).toEqual({ data: 'UNCHANGED', requestData: 'FROM REQUEST' });
            }).finally(() => {
                fs.unlinkSync('shellTransformTest.js');
            });
        });

        it('should reject promise if file does not exist', function () {
            const request: any = {};
            const response: any = {};
            const logger = Logger.create();
            const config: any = { shellTransform: ['fileDoesNotExist'] };

            return behaviors.execute(request, response, config, logger).then(() => {
                assert.fail('Promise resolved, should have been rejected');
            }, (error: any) => {
                // Error message is OS-dependent
                assert.ok(error.indexOf('fileDoesNotExist') >= 0, error);
            });
        });

        it('should reject if command returned non-zero status code', function () {
            const request: any = {};
            const response: any = {};
            const logger = Logger.create();
            const shellFn = function exec () {
                console.error('BOOM!!!');
                process.exit(1);
            };
            const config: any = { shellTransform: ['node shellTransformTest.js'] };

            fs.writeFileSync('shellTransformTest.js', util.format('%s\nexec();', shellFn.toString()));

            return behaviors.execute(request, response, config, logger).then(() => {
                assert.fail('Promise resolved, should have been rejected');
            }, error => {
                assert.ok(error.indexOf('Command failed') >= 0, error);
                assert.ok(error.indexOf('BOOM!!!') >= 0, error);
            }).finally(() => {
                fs.unlinkSync('shellTransformTest.js');
            });
        });

        it('should reject if command does not return valid JSON', function () {
            const request: any = {};
            const response: any = {};
            const logger = Logger.create();
            const shellFn = function exec () {
                console.log('This is not JSON');
            };
            const config: any = { shellTransform: ['node shellTransformTest.js'] };

            fs.writeFileSync('shellTransformTest.js', util.format('%s\nexec();', shellFn.toString()));

            return behaviors.execute(request, response, config, logger).then(() => {
                assert.fail('Promise resolved, should have been rejected');
            }, error => {
                assert.ok(error.indexOf('Shell command returned invalid JSON') >= 0, error);
            }).finally(() => {
                fs.unlinkSync('shellTransformTest.js');
            });
        });

        it('should not be valid if not an array', function () {
            const errors = behaviors.validate({ shellTransform: 'string' } as any);
            expect(errors).toEqual([{
                code: 'bad data',
                message: 'shellTransform behavior "shellTransform" field must be an array',
                source: { shellTransform: 'string' }
            }]);
        });

        it('should correctly shell quote inner quotes (issue #419)', function () {
            const request: any = { body: '{"fastSearch": "abctef abc def"}' };
            const response: any = {};
            const logger = Logger.create();
            const shellFn = function exec () {
                const shellRequest = JSON.parse(process.env.MB_REQUEST!);
                const shellResponse = JSON.parse(process.env.MB_RESPONSE!);

                shellResponse.requestData = shellRequest.body;
                console.log(JSON.stringify(shellResponse));
            };
            const config: any = { shellTransform: ['node shellTransformTest.js'] };

            fs.writeFileSync('shellTransformTest.js', util.format('%s\nexec();', shellFn.toString()));

            return behaviors.execute(request, response, config, logger).then(actualResponse => {
                expect(actualResponse).toEqual({ requestData: '{"fastSearch": "abctef abc def"}' });
            }).finally(() => {
                fs.unlinkSync('shellTransformTest.js');
            });
        });
    });
});
