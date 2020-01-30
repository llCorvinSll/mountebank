import {ApiClient} from "../api/api";
import * as path from 'path';
const BaseHttpClient = require('../api/http/baseHttpClient');
const smtp = require('../api/smtp/smtpClient');
const http = BaseHttpClient.create('http');
const https = BaseHttpClient.create('https');

describe('config file', function () {
    let api: any;
    let port: number;
    let mb: any;

    beforeAll(() => {
        api = new ApiClient();
        port = api.port + 1;
        mb = require('../mb').create(port)
    })
    // I don't normally advocate separating the data needed for the assertions from the test setup,
    // but I wanted this to be a reasonably complex regression test
    it('should support complex configuration with --configfile in multiple files', function () {
        const args = ['--configfile', path.join(__dirname, 'imposters/imposters.ejs')];

        return mb.start(args)
            .then(() => http.post('/orders', '', 4545))
            .then((response: any) => {
                expect(response.statusCode).toEqual(201);
                expect(response.headers.location).toEqual('http://localhost:4545/orders/123');
                return http.post('/orders', '', 4545);
            })
            .then((response: any) => {
                expect(response.statusCode).toEqual(201);
                expect(response.headers.location).toEqual('http://localhost:4545/orders/234');
                return http.get('/orders/123', 4545);
            })
            .then((response: any) => {
                expect(response.body).toEqual('Order 123');
                return http.get('/orders/234', 4545);
            })
            .then((response: any) => {
                expect(response.body).toEqual('Order 234');
                return https.get('/accounts/123', 5555);
            })
            .then((response: any) => {
                expect(response.statusCode).toEqual(401);
                return https.responseFor({
                    method: 'GET',
                    path: '/accounts/123',
                    port: 5555,
                    headers: { authorization: 'Basic blah===' }
                });
            })
            .then((response: any) => {
                expect(response.body.indexOf('<id>123</id>') > 0).toBeTruthy();
                return https.responseFor({
                    method: 'GET',
                    path: '/accounts/234',
                    port: 5555,
                    headers: { authorization: 'Basic blah===' }
                });
            })
            .then((response: any) => {
                expect(response.statusCode).toEqual(404);
                return smtp.send({
                    from: '"From 1" <from1@mb.org>',
                    to: ['"To 1" <to1@mb.org>'],
                    subject: 'subject 1',
                    text: 'text 1'
                }, 6565);
            })
            .then((response: any) => {
                expect(response.response).toEqual('250 OK: message queued');
                return https.get('/users/123', 7575);
            }).then((response: any) => {
                expect(response.body.indexOf('<users>') > -1).toBeTruthy();
                expect(response.body.indexOf('<id>123</id>') > 0).toBeTruthy();
            })
            .finally(() => mb.stop());
    });

    // This is the response resolver injection example on /docs/api/injection
    it('should evaluate stringify function in templates when loading configuration files', function () {
        const args = ['--configfile', path.join(__dirname, 'templates/imposters.ejs'), '--allowInjection', '--localOnly'];

        return mb.start(args)
            .then(() => http.get('/first', 4546))
            .then((response: any) => {
                expect(response.body).toEqual({ count: 1 });
                return http.get('/second', 4546);
            })
            .then((response: any) => {
                expect(response.body).toEqual({ count: 2 });
                return http.get('/first', 4546);
            })
            .then((response: any) => {
                expect(response.body).toEqual({ count: 1 });
                return http.get('/counter', 4546);
            })
            .then((response: any) => {
                expect(response.body).toEqual('There have been 2 proxied calls');
            })
            .finally(() => mb.stop());
    });

    it('should evaluate nested stringify functions when loading configuration files', function () {
        const args = ['--configfile', path.join(__dirname, 'nestedStringify/imposters.ejs'), '--allowInjection', '--localOnly'];

        return mb.start(args)
            .then(() => http.get('/', 4542))
            .then((response: any) => {
                expect(response.body).toEqual({ success: true });
            })
            .finally(() => mb.stop());
    });

    it('should not render through ejs when --noParse option provided', function () {
        const args = ['--configfile', path.join(__dirname, 'noparse.json'), '--noParse'];

        return mb.start(args)
            .then(() => http.get('/', 4545))
            .then((response: any) => {
                expect(response.body).toEqual('<% should not render through ejs');
            })
            .finally(() => mb.stop());
    });
});
