import * as helpers from '../../src/util/helpers';

describe('helpers', function () {
    describe('#socketName', function () {
        it('should concatenate host and port for a normal socket', function () {
            const name = helpers.socketName({ remoteAddress: 'address', remotePort: 'port' } as any);
            expect(name).toEqual('address:port');
        });

        it('should just use host if port is undefined', function () {
            const name = helpers.socketName({ remoteAddress: 'address' } as any);
            expect(name).toEqual('address');
        });
    });

    describe('#clone', function () {
        it('should return a deep copy', function () {
            const original = {
                level: 1,
                key: {
                    level: 2,
                    key: 'value'
                }
            };

            const clone = helpers.clone(original);
            expect(clone !== original).toBeTruthy();
            expect(clone).toEqual(original);
        });

        it('should clone array', function () {
            const original = [
                {
                    level: 1,
                    key: 'value1'
                },
                {
                    level: 1,
                    key: 'value2'
                }
            ];

            const clone = helpers.clone(original);
            expect(clone !== original).toBeTruthy();
            expect(clone).toEqual(original);
        });

        it('should return null if null passed', function () {
            const original = null;

            const clone = helpers.clone(original);
            expect(clone).toBeNull();
        });

        it('should return undefined if undefined passed', function () {
            const original = undefined;

            const clone = helpers.clone(original);
            expect(clone).toBeUndefined();
        });

        it('should return boolean if boolean passed', function () {
            const original = true;

            const clone = helpers.clone(original);
            expect(clone).toEqual(true);
        });
    });

    describe('#merge', function () {
        it('should deep merge two object', function () {
            const first = {
                first: 1,
                second: { third: 3 }
            };
            const second = {
                fourth: 4,
                fifth: { sixth: 6 }
            };

            const merged = helpers.merge(first, second);

            expect(merged).toEqual({
                first: 1,
                fourth: 4,
                second: { third: 3 },
                fifth: { sixth: 6 }
            });
        });

        it('should use second parameter for conflict resolution', function () {
            const defaults = { onlyInDefault: 1, inBoth: 1 };
            const overrides = { onlyInOverrides: 2, inBoth: 2 };

            const merged = helpers.merge(defaults, overrides);

            expect(merged).toEqual({
                onlyInDefault: 1,
                onlyInOverrides: 2,
                inBoth: 2
            });
        });

        it('should not change state of either parameter', function () {
            const first = { one: 1 };
            const second = { two: 2 };

            helpers.merge(first, second);

            expect(first).toEqual({ one: 1 });
            expect(second).toEqual({ two: 2 });
        });

        it('should be able to handle null values', function () {
            const defaults = { onlyInDefault: 1, inBoth: 1 };
            const overrides = { onlyInOverrides: 2, inBoth: null };

            const merged = helpers.merge(defaults, overrides);

            expect(merged).toEqual({
                onlyInDefault: 1,
                onlyInOverrides: 2,
                inBoth: null
            });
        });
    });

    describe('#isObject', function () {
        it('should return true for object', function () {
            expect(helpers.isObject({})).toBeTruthy();
        });

        it('should return false for null', function () {
            expect(!helpers.isObject(null)).toBeTruthy();
        });
    });
});
