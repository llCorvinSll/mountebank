import * as predicates from '../../../src/models/predicates/predicates';

describe('predicates', function () {
    describe('#not', function () {
        it('should return true for non empty request field if exists is true', function () {
            const predicate = { not: { equals: { field: 'this' } } };
            const request: any = { field: 'that' };
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return false for empty request field if exists is true', function () {
            const predicate = { not: { equals: { field: 'this' } } };
            const request: any = { field: 'this' };
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should throw exception if invalid sub-predicate', function () {
            try {
                const predicate = { not: { invalid: { field: 'this' } } };
                const request: any = { field: 'this' };
                predicates.evaluate(predicate, request);
                assert.fail('should have thrown');
            }
            catch (error) {
                expect(error.code).toEqual('bad data');
                expect(error.message).toEqual('missing predicate');
            }
        });
    });
});
