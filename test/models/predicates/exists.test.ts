import * as predicates from '../../../src/models/predicates/predicates';

describe('predicates', function () {
    describe('#exists', function () {
        it('should return true for integer request field if exists is true', function () {
            const predicate = {exists: {field: true}};
            const request: any = {field: 0};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return true for object request field if exists is true', function () {
            const predicate = {exists: {field: true}};
            const request: any = {field: {}};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return true for non empty string request field if exists is true', function () {
            const predicate = {exists: {field: true}};
            const request: any = {field: 'nonempty'};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return false for empty string request field if exists is true', function () {
            const predicate = {exists: {field: true}};
            const request: any = {field: ''};
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return false for undefined request field if exists is true', function () {
            const predicate = {exists: {field: true}};
            const request: any = {field: undefined};
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return false for integer request field if exists is false', function () {
            const predicate = {exists: {field: false}};
            const request: any = {field: 0};
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return false for object request field if exists is false', function () {
            const predicate = {exists: {field: false}};
            const request: any = {field: {}};
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return false for non empty string request field if exists is false', function () {
            const predicate = {exists: {field: false}};
            const request: any = {field: 'nonempty'};
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return true for empty string request field if exists is false', function () {
            const predicate = {exists: {field: false}};
            const request: any = {field: ''};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return true for undefined request field if exists is false', function () {
            const predicate = {exists: {field: false}};
            const request: any = {field: undefined};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return false if no key for object and exists is true', function () {
            const predicate = {exists: {headers: {field: true}}};
            const request: any = {headers: {}};
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return true if no key for object and exists is false', function () {
            const predicate = {exists: {headers: {field: false}}};
            const request: any = {headers: {}};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return true for non empty object key if exists is true', function () {
            const predicate = {exists: {headers: {key: true}}};
            const request: any = {headers: {key: 'nonempty'}};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return false for empty object key if exists is true', function () {
            const predicate = {exists: {headers: {key: true}}};
            const request: any = {headers: {key: ''}};
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return false for non empty object key if exists is false', function () {
            const predicate = {exists: {headers: {key: false}}};
            const request: any = {headers: {key: 'nonempty'}};
            expect(!predicates.evaluate(predicate, request)).toBeTruthy();
        });

        it('should return true for empty object key if exists is false', function () {
            const predicate = {exists: {headers: {key: false}}};
            const request: any = {headers: {key: ''}};
            expect(predicates.evaluate(predicate, request)).toBeTruthy();
        });
    });
});
