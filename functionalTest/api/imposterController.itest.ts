import { ApiClient } from './api';


describe('imposter', () => {
    let api: any;
    let port: number;
    beforeEach(() => {
        api = new ApiClient();
        port = api.port + 1;
    });

    describe('stubs', () => {
        describe('DELETE by_uuid', () => {
            let stubs: any[];

            beforeEach(() => {
                const refStubs = [
                    {
                        responses: [{ is: { statusCode: 406 } }],
                        predicates: [{ equals: { headers: { Accept: 'application/xml' } } }]
                    },
                    {
                        responses: [{ is: { statusCode: 405 } }],
                        predicates: [{ equals: { method: 'PUT' } }]
                    },
                    {
                        responses: [{ is: { statusCode: 500 } }],
                        predicates: [{ equals: { method: 'PUT' } }]
                    }
                ];
                const request = { protocol: 'http', port, stubs: refStubs };

                return api.post('/imposters', request).then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    stubs = response.body.stubs;

                    expect(stubs.length).toEqual(3);
                });
            });

            afterEach(() => api.del('/imposters'));

            it('should delete stub by uuid', () => api.del(`/imposters/${port}/stubs/by_uuid/${stubs[1]._uuid}`)
                .then((response: any) => {
                    const uuidsAfterDelete = response.body.stubs.map((e: any) => e._uuid);

                    expect(uuidsAfterDelete).not.toContain(stubs[1]._uuid);
                    expect(response.body.stubs.length).toEqual(2);
                }));

            it('should return error if uuid not valid', () => api.del(`/imposters/${port}/stubs/by_uuid/dddddddd`)
                .then((response: any) => {
                    expect(response.statusCode).toEqual(404);
                }));
        });
    });
});
