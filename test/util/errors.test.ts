import * as errors from '../../src/util/errors';
import * as inherit from '../../src/util/inherit';

describe('errors', function () {
    describe('#details', function () {
        it('should include Error prototype properties', function () {
            const error = inherit.from(Error as any, { code: 'code' });
            const keys = Object.keys(errors.details(error));

            expect(keys).toEqual(['code', 'name', 'stack']);
        });

        it('should return own properties for non Error objects', function () {
            const keys = Object.keys(errors.details({ first: 1, second: 2 }));

            expect(keys).toEqual(['first', 'second']);
        });
    });
});
