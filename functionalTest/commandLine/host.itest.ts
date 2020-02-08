

import { ApiClient } from '../api/api';

const assert = require('assert');
const hostname = require('os').hostname();
import { BaseHttpClient } from '../api/http/baseHttpClient';
const http = new BaseHttpClient('http');
const fs = require('fs');
const Q = require('q');
const path = require('path');

describe('--host', function () {
    let api: any;
    let port: number;
    let mb: any;

    beforeAll(() => {
        api = new ApiClient();
        port = api.port + 1;
        mb = require('../mb').create(port);
    });

    it('should allow binding to specific host', function () {
        return mb.start(['--host', hostname])
            .then(() => mb.get('/'))
            .then((response: any) => {
                const links = response.body._links;
                const hrefs = Object.keys(links).map(key => links[key].href);
                assert.ok(hrefs.length > 0, 'no hrefs to test');
                hrefs.forEach(href => {
                    assert.ok(href.indexOf(`http://${hostname}`) === 0, `${href} does not use hostname`);
                });
            })
            .finally(() => mb.stop());
    });

    it('should disallow localhost calls when bound to specific host', function () {
        //Travis adds hostname into /etc/hosts file
        if (process.env.TRAVIS === 'true') {
            return Q(true);
        }

        return mb.start(['--host', hostname])
            .then(() => http.responseFor({ method: 'GET', path: '/', hostname: 'localhost', port: mb.port }))
            .then(
                () => { assert.fail(`should not have connected (hostname: ${hostname})`); },
                (error: any) => { expect(error.errno).toEqual('ECONNREFUSED'); })
            .finally(() => mb.stop());
    });

    it('should work with --configfile', function () {
        const args = ['--host', hostname, '--configfile', path.join(__dirname, 'noparse.json'), '--noParse'];

        return mb.start(args)
            .then(() => http.responseFor({ method: 'GET', path: '/', hostname, port: 4545 }))
            .then((response: any) => {
                expect(response.body).toEqual('<% should not render through ejs');
            })
            .finally(() => mb.stop());
    });

    it('should work with mb save', function () {
        const imposters = { imposters: [{ protocol: 'http', port: 3000, recordRequests: false, stubs: [] }] };

        return mb.start(['--host', hostname])
            .then(() => mb.put('/imposters', imposters))
            .then((response: any) => {
                expect(response.statusCode).toEqual(200);
                return mb.save(['--host', hostname]);
            })
            .then(() => {
                assert.ok(fs.existsSync('mb.json'));
                assert.deepEqual(JSON.parse(fs.readFileSync('mb.json')), imposters);
                fs.unlinkSync('mb.json');
            })
            .finally(() => mb.stop());
    });

    it('should work with mb replay', function () {
        const originServerPort = mb.port + 1;
        const originServerStub = { responses: [{ is: { body: 'ORIGIN' } }] };
        const originServerRequest = { protocol: 'http', port: originServerPort, stubs: [originServerStub] };
        const proxyPort = mb.port + 2;
        const proxyDefinition = { to: `http://${hostname}:${originServerPort}`, mode: 'proxyAlways' };
        const proxyStub = { responses: [{ proxy: proxyDefinition }] };
        const proxyRequest = { protocol: 'http', port: proxyPort, stubs: [proxyStub] };

        return mb.start(['--host', hostname])
            .then(() => mb.put('/imposters', { imposters: [originServerRequest, proxyRequest] }))
            .then((response: any) => {
                expect(response.statusCode).toEqual(200);
                return http.responseFor({ method: 'GET', path: '/', hostname, port: proxyPort });
            })
            .then(() => mb.replay(['--host', hostname]))
            .then(() => mb.get('/imposters?replayable=true'))
            .then((response: any) => {
                const imposters = response.body.imposters;
                const oldProxyImposter = imposters.find((imposter: any) => imposter.port === proxyPort);
                const responses = oldProxyImposter.stubs[0].responses;
                expect(responses.length).toEqual(1);
                expect(responses[0].is.body).toEqual('ORIGIN');
            })
            .finally(() => mb.stop());
    });

    it('should bind http imposter to provided host', function () {
        //Travis adds hostname into /etc/hosts file
        if (process.env.TRAVIS === 'true') {
            return Q(true);
        }

        const imposter = { protocol: 'http', port: mb.port + 1 };

        return mb.start(['--host', hostname])
            .then(() => mb.post('/imposters', imposter))
            .then((response: any) => {
                expect(response.statusCode).toEqual(201);
                return http.responseFor({
                    method: 'GET',
                    path: '/',
                    hostname: hostname,
                    port: imposter.port
                });
            })
            .then((response: any) => {
                expect(response.statusCode).toEqual(200);

                return http.responseFor({
                    method: 'GET',
                    path: '/',
                    hostname: 'localhost',
                    port: imposter.port
                });
            })
            .then(
                () => { assert.fail('should not have connected to localhost'); },
                (error: any) => { expect(error.errno).toEqual('ECONNREFUSED'); }
            )
            .finally(() => mb.stop());
    });

    it('should bind tcp imposter to provided host', function () {
        //Travis adds hostname into /etc/hosts file
        if (process.env.TRAVIS === 'true') {
            return Q(true);
        }

        const imposter = {
            protocol: 'tcp',
            port: mb.port + 1,
            stubs: [{ responses: [{ is: { data: 'OK' } }] }]
        };
        const client = require('../api/tcp/tcpClient');

        return mb.start(['--host', hostname])
            .then(() => mb.post('/imposters', imposter))
            .then((response: any) => {
                expect(response.statusCode).toEqual(201);
                return client.send('TEST', imposter.port, 0, hostname);
            })
            .then((response: any) => {
                expect(response.toString()).toEqual('OK');
                return client.send('TEST', imposter.port, 0, 'localhost');
            })
            .then(
                () => { assert.fail('should not have connected to localhost'); },
                (error: any) => { expect(error.errno).toEqual('ECONNREFUSED'); }
            )
            .finally(() => mb.stop());
    });

    it('should bind smtp imposter to provided host', function () {
        //Travis adds hostname into /etc/hosts file
        if (process.env.TRAVIS === 'true') {
            return Q(true);
        }

        const imposter = { protocol: 'smtp', port: mb.port + 1 };
        const message = { from: '"From" <from@mb.org>', to: ['"To" <to@mb.org>'], subject: 'subject', text: 'text' };
        const client = require('../api/smtp/smtpClient');

        return mb.start(['--host', hostname])
            .then(() => mb.post('/imposters', imposter))
            .then((response: any) => {
                expect(response.statusCode).toEqual(201);
                return client.send(message, imposter.port, hostname);
            })
            .then(() => client.send(message, imposter.port, 'localhost'))
            .then(
                () => { assert.fail('should not have connected to localhost'); },
                (error: any) => { expect(error.errno).toEqual('ECONNREFUSED'); }
            )
            .finally(() => mb.stop());
    });
});
