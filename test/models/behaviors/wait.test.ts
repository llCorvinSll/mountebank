

const assert = require('assert');
import * as behaviors from '../../../src/models/behaviors/behaviors';
const Logger = require('../../fakes/fakeLogger');

describe('behaviors', function () {
    describe('#wait', function () {
        it('should not execute during dry run', function () {
            const request: any = { isDryRun: true };
            const response: any = { key: 'value' };
            const logger = Logger.create();
            const start = Date.now();
            const config: any = { wait: 1000 };

            return behaviors.execute(request, response, config, logger).then(actualResponse => {
                const time = Date.now() - start;
                assert.ok(time < 50, 'Took ' + time + ' milliseconds');
                expect(actualResponse).toEqual({ key: 'value' });
            });
        });

        it('should wait specified number of milliseconds', function () {
            const request: any = {};
            const response: any = { key: 'value' };
            const logger = Logger.create();
            const start = Date.now();
            const config: any = { wait: 100 };

            return behaviors.execute(request, response, config, logger).then(actualResponse => {
                const time = Date.now() - start;
                assert.ok(time > 90, 'Took ' + time + ' milliseconds'); // allows for approximate timing
                expect(actualResponse).toEqual({ key: 'value' });
            });
        });

        it('should allow function to specify latency', function () {
            const request: any = {};
            const response: any = { key: 'value' };
            const logger = Logger.create();
            const fn = () => 100;
            const start = Date.now();
            const config: any = { wait: fn.toString() };

            return behaviors.execute(request, response, config, logger).then(actualResponse => {
                const time = Date.now() - start;
                assert.ok(time > 90, 'Took ' + time + ' milliseconds'); // allows for approximate timing
                expect(actualResponse).toEqual({ key: 'value' });
            });
        });

        it('should log error and reject function if function throws error', function () {
            const request: any = {};
            const response: any = { key: 'value' };
            const logger = Logger.create();
            const fn = () => { throw Error('BOOM!!!'); };
            const config: any = { wait: fn.toString() };

            return behaviors.execute(request, response, config, logger).then(() => {
                assert.fail('should have rejected');
            }, error => {
                assert.ok(error.message.indexOf('invalid wait injection') >= 0);
                logger.error.assertLogged(fn.toString());
            });
        });

        it('should treat a string as milliseconds if it can be parsed as a number', function () {
            const request: any = {};
            const response: any = { key: 'value' };
            const logger = Logger.create();
            const start = Date.now();
            const config: any = { wait: '100' };

            return behaviors.execute(request, response, config, logger).then(actualResponse => {
                const time = Date.now() - start;
                assert.ok(time > 90, 'Took ' + time + ' milliseconds'); // allows for approximate timing
                expect(actualResponse).toEqual({ key: 'value' });
            });
        });

        it('should not be valid if below zero', function () {
            const errors = behaviors.validate({ wait: -1 } as any);
            expect(errors).toEqual([{
                code: 'bad data',
                message: 'wait behavior "wait" field must be an integer greater than or equal to 0',
                source: { wait: -1 }
            }]);
        });

        it('should be valid if a string is passed in for the function', function () {
            const errors = behaviors.validate({ wait: '() => {}' });
            expect(errors).toEqual([]);
        });

        it('should not be valid if a boolean is passed in', function () {
            const errors = behaviors.validate({ wait: true } as any);
            expect(errors).toEqual([{
                code: 'bad data',
                message: 'wait behavior "wait" field must be a string or a number',
                source: { wait: true }
            }]);
        });
    });
});
