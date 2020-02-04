

const assert = require('assert');
import * as  behaviors from '../../../src/models/behaviors/behaviors';
const Logger = require('../../fakes/fakeLogger');

describe('behaviors', function () {
    describe('#decorate', function () {
        it('should allow changing the response directly', function () {
            const request: any = {};
            const response: any= {key: 'ORIGINAL'};
            const logger = Logger.create();
            const fn = (req: any, responseToDecorate: any) => {
                responseToDecorate.key = 'CHANGED';
            };
            const config: any = {decorate: fn.toString()};

            return behaviors.execute(request, response, config, logger).then(actualResponse => {
                expect(actualResponse).toEqual({ key: 'CHANGED' });
            });
        });

        it('should allow returning response', function () {
            const request: any = {};
            const response: any= {key: 'VALUE'};
            const logger = Logger.create();
            const fn = () => ({newKey: 'NEW-VALUE'});
            const config: any = {decorate: fn.toString()};

            return behaviors.execute(request, response, config, logger).then(actualResponse => {
                expect(actualResponse).toEqual({ newKey: 'NEW-VALUE' });
            });
        });

        it('should allow logging in the decoration function', function () {
            const request: any = {};
            const response: any= {key: 'VALUE'};
            const logger = Logger.create();
            const fn = (req: any, resp: any, log: any) => {
                log.info('test entry');
            };
            const config: any = {decorate: fn.toString()};

            return behaviors.execute(request, response, config, logger).then(() => {
                logger.info.assertLogged('test entry');
            });
        });

        it('should reject function if function throws error', function () {
            const request: any = {};
            const response: any= {key: 'value'};
            const logger = Logger.create();
            const fn = () => { throw Error('BOOM!!!') };
            const config: any = {decorate: fn.toString()};

            return behaviors.execute(request, response, config, logger).then(() => {
                assert.fail('should have rejected');
            }, error => {
                expect(error.message.indexOf('invalid decorator injection') >= 0).toBeTruthy();
                logger.error.assertLogged("injection X=> Error: BOOM!!!");
            });
        });

        it('should not be valid if not a string', function () {
            const errors = behaviors.validate({ decorate: {} } as any);
            expect(errors).toEqual([{
                code: 'bad data',
                message: 'decorate behavior "decorate" field must be a string, representing a JavaScript function',
                source: { decorate: {} }
            }]);
        });
    });
});
