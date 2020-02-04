

import {ApiClient} from "../api/api";
const client = require('../api/http/baseHttpClient').create('http');

describe('mb replay', function () {
    let api: any;
    let port: number;
    let mb: any;

    beforeAll(() => {
        api = new ApiClient();
        port = api.port + 1;
        mb = require('../mb').create(port)
    })

    it('should remove proxies', function () {
        const originServerPort = mb.port + 1,
            originServerFn = (request: any, state: any) => {
                state.count = state.count || 0;
                state.count += 1;
                return {
                    body: `${state.count}. ${request.path}`
                };
            },
            originServerStub = { responses: [{ inject: originServerFn.toString() }] },
            originServerRequest = {
                protocol: 'http',
                port: originServerPort,
                stubs: [originServerStub],
                name: 'origin server'
            },
            proxyPort = mb.port + 2,
            proxyDefinition = {
                to: `http://localhost:${originServerPort}`,
                mode: 'proxyAlways',
                predicateGenerators: [{ matches: { path: true } }]
            },
            proxyStub = { responses: [{ proxy: proxyDefinition }] },
            proxyRequest = { protocol: 'http', port: proxyPort, stubs: [proxyStub], name: 'PROXY' };

        return mb.start(['--allowInjection'])
            .then(() => mb.post('/imposters', originServerRequest))
            .then((response: any) => {
                expect(response.statusCode).toEqual(201);
                return mb.post('/imposters', proxyRequest);
            })
            .then((response: any) => {
                expect(response.statusCode).toEqual(201);
                return client.get('/first', proxyPort);
            })
            .then(() => client.get('/second', proxyPort))
            .then(() => client.get('/first', proxyPort))
            .then(() => mb.replay())
            .then(() => mb.get(`/imposters/${proxyPort}`))
            .then((response: any) => {
                expect(response.body.stubs.length).toEqual(2);

                const stubs = response.body.stubs,
                    responses = stubs.map((stub: any) => stub.responses.map((stubResponse: any) => stubResponse.is.body));

                expect(responses).toEqual([['1. /first', '3. /first'], ['2. /second']]);
            })
            .finally(() => mb.stop());
    });
});
