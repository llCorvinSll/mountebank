import {ApiClient} from "../api/api";

import * as path from 'path';
const BaseHttpClient = require('../api/http/baseHttpClient');
const http = BaseHttpClient.create('http');
import * as fs from 'fs';

describe('mb save', function () {
    let api: any;
    let port: number;
    let mb: any;

    beforeAll(() => {
        api = new ApiClient();
        port = api.port + 1;
        mb = require('../mb').create(port)
    })

    it('should allow saving replayable format', function () {
        const args = ['--configfile', path.join(__dirname, 'imposters/imposters.ejs')];
        let expected: any;

        return mb.start(args)
            .then(() => mb.get('/imposters?replayable=true'))
            .then((response: any) => {
                expected = response.body;
                return mb.save();
            })
            .then(() => {
                expect(fs.existsSync('mb.json')).toBeTruthy();
                expect(expected).toEqual(JSON.parse(fs.readFileSync('mb.json').toString()));
                fs.unlinkSync('mb.json');
            })
            .finally(() => mb.stop());
    });

    it('should allow saving to a different config file', function () {
        const args = ['--configfile', path.join(__dirname, 'imposters/imposters.ejs')];
        let expected: any;

        return mb.start(args)
            .then(() => mb.get('/imposters?replayable=true'))
            .then((response: any) => {
                expected = response.body;
                return mb.save(['--savefile', 'saved.json']);
            })
            .then(() => {
                expect(fs.existsSync('saved.json')).toBeTruthy();
                expect(expected).toEqual(JSON.parse(fs.readFileSync('saved.json').toString()));
                fs.unlinkSync('saved.json');
            })
            .finally(() => mb.stop());
    });

    if (process.env.MB_AIRPLANE_MODE !== 'true') {
        it('should allow removing proxies during save', function () {
            const proxyStub = { responses: [{ proxy: { to: 'https://google.com' } }] },
                proxyRequest = { protocol: 'http', port: port + 1, stubs: [proxyStub], name: 'PROXY' };
            let expected: any;

            return mb.start()
                .then(() => mb.post('/imposters', proxyRequest))
                .then((response: any) => {
                    expect(response.statusCode).toEqual( 201);
                    return http.get('/', port + 1);
                })
                .then(() => mb.get('/imposters?replayable=true&removeProxies=true'))
                .then((response: any) => {
                    expected = response.body;
                    return mb.save(['--removeProxies']);
                })
                .then((result: any) => {
                    expect(result.exitCode).toEqual(0);
                    expect(fs.existsSync('mb.json')).toBeTruthy();
                    expect(expected).toEqual(JSON.parse(fs.readFileSync('mb.json').toString()));
                    fs.unlinkSync('mb.json');
                })
                .finally(() => mb.stop());
        });
    }
});
