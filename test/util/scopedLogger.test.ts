import * as Logger from '../../src/util/scopedLogger';

describe('scopedLogger', function () {
    describe('#create', function () {
        ['debug', 'info', 'warn', 'error'].forEach(level => {
            it('should prefix protocol name and port to all ' + level + ' calls', function () {
                const logger = {debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn()} as any;
                const scopedLogger = Logger.create(logger, 'prefix');

                scopedLogger[level]('log %s', level);

                expect(logger[level]).toBeCalledWith(`[prefix] log ${level}`);
            });
        });

        it('should allow nested scopes', function () {
            const logger: any = {debug: jest.fn()};
            const scopedLogger = Logger.create(logger, 'prefix').withScope('nested');

            scopedLogger.debug('log');

            expect(logger.debug).toBeCalledWith('[prefix] nested log');
        });

        it('should allow changing scope', function () {
            const logger: any = {debug: jest.fn()};
            const scopedLogger = Logger.create(logger, 'original');

            scopedLogger.changeScope('changed');
            scopedLogger.debug('log');

            expect(logger.debug).toBeCalledWith('[changed] log');
        });
    });
});
