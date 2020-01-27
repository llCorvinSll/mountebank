import * as predicates from '../../../src/models/predicates/predicates';

describe('predicates', function () {
    describe('#or', function () {
        it('should return true if any sub-predicate is true', function () {
            const predicate = {or: [{equals: {field: 'this'}}, {equals: {field: 'that'}}]};
            const request: any = {field: 'this'};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return false if no sub-predicate is true', function () {
            const predicate = {or: [{equals: {field: 'this'}}, {equals: {field: 'that'}}]};
            const request: any = {field: 'what'};
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });
    });
});
