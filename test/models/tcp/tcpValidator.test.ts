const validator = require('../../../src/models/tcp/tcpValidator');

describe('tcpValidator', function () {

    describe('#validate', function () {
        it('should be valid for missing mode', function () {
            expect(validator.validate({})).toEqual([]);
        });

        ['text', 'binary'].forEach(value => {
            it(`should be valid for ${value} mode`, function () {
                expect(validator.validate({ mode: value })).toEqual([]);
            });
        });

        it('should not be valid for incorrect mode', function () {
            expect(validator.validate({ mode: 'TEXT' })).toEqual([{
                code: 'bad data',
                message: "'mode' must be one of ['text', 'binary']"
            }]);
        });
    });
});
