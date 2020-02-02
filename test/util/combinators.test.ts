import * as combinators from '../../src/util/combinators';

describe('combinators', function () {
    describe('#identity', function () {
        it('should return its argument', function () {
            expect('arg').toEqual(combinators.identity('arg'));
        });
    });

    describe('#constant', function () {
        it('should return a function that always returns the same thing', function () {
            const K = combinators.constant<any>('constant');
            expect('constant').toEqual(K(0));
            expect('constant').toEqual(K(1));
        });
    });

    describe('#noop', function () {
        it('does nothing', function () {
            const state = { key: 'value' };
            const result = combinators.noop.call(state);
            expect(result).toEqual(undefined);
            expect(state).toEqual({ key: 'value' });
        });
    });

    describe('#compose', function () {
        it('should compose functions', function () {
            const increment = (i:any) => i + 1,
                double = (j:any) => j * 2;
            expect(combinators.compose(increment, double)(2)).toEqual(5);
        });

        it('should compose multiple functions', function () {
            const increment = (i: any) => i + 1;
            const double = (j: any) => j * 2;
            const triple = (i: any) => i * 3;
            expect(combinators.compose(increment, double, triple)(1)).toEqual(7);
        });

        it('should be identity if no functions passed in', function () {
            expect(combinators.compose()(5)).toEqual(5);
        });
    });

    describe('#curry', function () {
        it('should pass curried parameter', function () {
            const fn = (param: any) => param;
            const curriedFn = combinators.curry(fn, 1);

            expect(curriedFn()).toEqual(1);
        });

        it('should curry multiple parameters', function () {
            const fn = (param1: any, param2: any) => param1 + param2;
            const curriedFn = combinators.curry(fn, 1, 2);

            expect(curriedFn()).toEqual(3);
        });

        it('should support partial currying', function () {
            const fn = (param1: any, param2: any) => param1 + param2;
            const curriedFn = combinators.curry(fn, 1);

            expect(curriedFn(2)).toEqual(3);
        });
    });
});
