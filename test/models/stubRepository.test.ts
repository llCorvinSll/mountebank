import { StubRepository } from '../../src/models/stubs/StubRepository';

describe('stubRepository', function () {
    function jsonWithoutFunctions (obj: any) {
        return JSON.parse(JSON.stringify(obj));
    }

    describe('#addStub', function () {
        it('should add new stub in front of passed in response', function () {
            const stubs = new StubRepository('utf8');
            const firstStub = { responses: [{ is: 'first' }, { is: 'second' }] };
            const secondStub = { responses: [{ is: 'third' }, { is: 'fourth' }] };

            stubs.addStub(firstStub);
            stubs.addStub(secondStub);

            stubs.addStub({ responses: [{ is: 'TEST' }] }, { is: 'fourth' });
            const responses = stubs.stubs().map(stub => stub.responses);

            expect(responses).toEqual([
                [{ is: 'first' }, { is: 'second' }],
                [{ is: 'TEST' }],
                [{ is: 'third' }, { is: 'fourth' }]
            ]);
        });
    });

    describe('#overwriteStubs', function () {
        it('should overwrite entire list', function () {
            const stubs = new StubRepository('utf8');
            const firstStub = { responses: [{ is: 'first' }, { is: 'second' }] };
            const secondStub = { responses: [{ is: 'third' }, { is: 'fourth' }] };
            const thirdStub = { responses: [{ is: 'fifth' }, { is: 'sixth' }] };

            stubs.addStub(firstStub);
            stubs.addStub(secondStub);
            stubs.overwriteStubs([thirdStub]);

            const responses = stubs.stubs().map(stub => stub.responses);

            expect(responses).toEqual([
                [{ is: 'fifth' }, { is: 'sixth' }]
            ]);
        });
    });

    describe('#overwriteStubAtIndex', function () {
        it('should overwrite single stub', function () {
            const stubs = new StubRepository('utf8');
            const firstStub = { responses: [{ is: 'first' }, { is: 'second' }] };
            const secondStub = { responses: [{ is: 'third' }, { is: 'fourth' }] };
            const thirdStub = { responses: [{ is: 'fifth' }, { is: 'sixth' }] };

            stubs.addStub(firstStub);
            stubs.addStub(secondStub);
            stubs.overwriteStubAtIndex('1', thirdStub);

            const responses = stubs.stubs().map(stub => stub.responses);

            expect(responses).toEqual([
                [{ is: 'first' }, { is: 'second' }],
                [{ is: 'fifth' }, { is: 'sixth' }]
            ]);
        });
    });

    describe('#deleteeStubAtIndex', function () {
        it('should overwrite single stub', function () {
            const stubs = new StubRepository('utf8');
            const firstStub = { responses: [{ is: 'first' }, { is: 'second' }] };
            const secondStub = { responses: [{ is: 'third' }, { is: 'fourth' }] };
            const thirdStub = { responses: [{ is: 'fifth' }, { is: 'sixth' }] };

            stubs.addStub(firstStub);
            stubs.addStub(secondStub);
            stubs.addStub(thirdStub);

            stubs.deleteStubAtIndex('0');
            const responses = stubs.stubs().map(stub => stub.responses);

            expect(responses).toEqual([
                [{ is: 'third' }, { is: 'fourth' }],
                [{ is: 'fifth' }, { is: 'sixth' }]
            ]);
        });
    });

    describe('#stubs', function () {
        it('should not allow changing state in stubRepository', function () {
            const stubs = new StubRepository('utf8', true);
            const stub = { responses: [] };

            stubs.addStub(stub);
            stubs.stubs()[0].responses!.push('RESPONSE' as any);

            expect(jsonWithoutFunctions(stubs.stubs())).toEqual([{ _uuid: 'stub', responses: [] }]);
        });

        it('should support adding responses', function () {
            const stubs = new StubRepository('utf8', true);
            const stub = { responses: [] };

            stubs.addStub(stub);
            stubs.stubs()[0].addResponse!('RESPONSE' as any);

            expect(jsonWithoutFunctions(stubs.stubs())).toEqual([{ _uuid: 'stub', responses: ['RESPONSE'] }]);
        });
    });

    describe('#getResponseFor', function () {
        it('should return default response if no match', function () {
            const stubs = new StubRepository('utf8');
            const logger: any = { debug: jest.fn() };

            const responseConfig = stubs.getResponseFor({ field: 'value' }, logger, {});

            expect(responseConfig.is).toEqual({});
        });

        it('should always match if no predicate', function () {
            const stubs = new StubRepository('utf8');
            const logger: any = { debug: jest.fn() };
            const stub = { responses: [{ is: 'first stub' }] };

            stubs.addStub(stub);
            const responseConfig = stubs.getResponseFor({ field: 'value' }, logger, {});

            expect(responseConfig.is).toEqual('first stub');
        });

        it('should return first match', function () {
            const stubs = new StubRepository('utf8');
            const logger: any = { debug: jest.fn() };
            const firstStub = { predicates: [{ equals: { field: '1' } }], responses: [{ is: 'first stub' }] };
            const secondStub = { predicates: [{ equals: { field: '2' } }], responses: [{ is: 'second stub' }] };
            const thirdStub = { predicates: [{ equals: { field: '2' } }], responses: [{ is: 'third stub' }] };

            stubs.addStub(firstStub);
            stubs.addStub(secondStub);
            stubs.addStub(thirdStub);
            const responseConfig = stubs.getResponseFor({ field: '2' }, logger, {});

            expect(responseConfig.is).toEqual('second stub');
        });

        it('should return responses in order, looping around', function () {
            const stubs = new StubRepository('utf8');
            const logger: any = { debug: jest.fn() };
            const stub = { responses: [{ is: 'first response' }, { is: 'second response' }] };

            stubs.addStub(stub);

            expect(stubs.getResponseFor({}, logger, {}).is).toEqual('first response');
            expect(stubs.getResponseFor({}, logger, {}).is).toEqual('second response');
            expect(stubs.getResponseFor({}, logger, {}).is).toEqual('first response');
        });

        it('should support recording matches', function () {
            const stubs = new StubRepository('utf8');
            const logger: any = { debug: jest.fn() };
            const matchingRequest = { field: 'value' };
            const mismatchingRequest = { field: 'other' };
            const stub = { predicates: [{ equals: { field: 'value' } }], responses: [{ is: 'first response' }] };

            stubs.addStub(stub);
            stubs.getResponseFor(matchingRequest, logger, {}).recordMatch!('MATCHED');
            stubs.getResponseFor(mismatchingRequest, logger, {}).recordMatch!('MISMATCHED');
            return stubs.stubs()[0].getMatches!().then(matches => {
                matches.forEach((match: any) => { match.timestamp = 'NOW'; });

                expect(matches).toEqual([{ request: matchingRequest, response: 'MATCHED', timestamp: 'NOW' }]);
            });
        });

        it('should only record match once for given response', function () {
            const stubs = new StubRepository('utf8');
            const logger: any = { debug: jest.fn() };
            const stub = { responses: [{ is: 'response' }] };

            stubs.addStub(stub);
            const responseConfig = stubs.getResponseFor({}, logger, {});
            responseConfig.recordMatch!('FIRST');
            responseConfig.recordMatch!('SECOND');
            return stubs.stubs()[0].getMatches!().then(matches => {
                matches.forEach((match: any) => { match.timestamp = 'NOW'; });

                expect(matches).toEqual([{ request: {}, response: 'FIRST', timestamp: 'NOW' }]);
            });
        });

        it('should repeat a response and continue looping', function () {
            const stubs = new StubRepository('utf8');
            const logger: any = { debug: jest.fn() };
            const stub: any = {
                responses: [
                    { is: 'first response', _behaviors: { repeat: 2 } },
                    { is: 'second response' }
                ]
            };

            stubs.addStub(stub);

            expect(stubs.getResponseFor({}, logger, {}).is).toEqual('first response');
            expect(stubs.getResponseFor({}, logger, {}).is).toEqual('first response');
            expect(stubs.getResponseFor({}, logger, {}).is).toEqual('second response');
            expect(stubs.getResponseFor({}, logger, {}).is).toEqual('first response');
            expect(stubs.getResponseFor({}, logger, {}).is).toEqual('first response');
            expect(stubs.getResponseFor({}, logger, {}).is).toEqual('second response');
        });
    });
});
