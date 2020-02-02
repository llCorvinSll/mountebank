import * as inherit from '../../src/util/inherit';

describe('inherit', function () {
    describe('#from', function () {
        it('should inherit prototype', function () {
            const obj = inherit.from({ prototypeKey: 'prototypeValue' } as any);
            expect(obj.prototypeKey).toEqual('prototypeValue');
        });

        it('should have both new keys and prototype keys', function () {
            const obj = inherit.from({ prototypeKey: 'prototypeValue' } as any, { ownKey: 'ownValue' });
            expect(obj.prototypeKey).toEqual('prototypeValue');
            expect(obj.ownKey).toEqual('ownValue');
        });

        it('should shadow prototype with own keys', function () {
            const obj = inherit.from({ key: 'prototypeValue' } as any, { key: 'ownValue' });
            expect(obj.key).toEqual('ownValue');
        });

        it('should call new on function supers', function () {
            function F () {
                this.key = 'value';
            }

            const obj = inherit.from(F as any);

            expect(obj.key).toEqual('value');
        });
    });
});
