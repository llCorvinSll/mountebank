import * as predicates from '../../../src/models/predicates/predicates';

describe('predicates', function () {
    describe('#and', function () {
        it('should return true if all sub-predicate is true', function () {
            const predicate = {and: [{equals: {field: 'this'}}, {startsWith: {field: 'th'}}]};
            const request: any = {field: 'this'};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return false if any sub-predicate is false', function () {
            const predicate = {and: [{equals: {field: 'this'}}, {equals: {field: 'that'}}]};
            const request: any = {field: 'this'};
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });
    });
});
