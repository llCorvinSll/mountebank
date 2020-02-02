import {ApiClient} from "../api";
import * as fs from 'fs';
import * as path from 'path';
const client = require('../http/baseHttpClient').create('https');
const key = fs.readFileSync(path.join(__dirname, '/cert/key.pem'), 'utf8');
const cert = fs.readFileSync(path.join(__dirname, '/cert/cert.pem'), 'utf8');
const defaultKey = fs.readFileSync(path.join(__dirname, '../../../src/models/https/cert/mb-key.pem'), 'utf8');
const defaultCert = fs.readFileSync(path.join(__dirname, '../../../src/models/https/cert/mb-cert.pem'), 'utf8');

describe('https imposter', function () {
    let api: any;
    let port: number;

    beforeEach(() => {
        api = new ApiClient();
        port = api.port + 1;
    })

    it('should support sending key/cert pair during imposter creation', function () {
        const request = {
            protocol: 'https',
            port,
            key,
            cert
        };

        return api.post('/imposters', request).then((response: any) => {
            expect(response.statusCode).toEqual(201);
            expect(response.body.key).toEqual(key);
            expect(response.body.cert).toEqual(cert);
            return client.get('/', port);
        }).then((response: any) => {
            expect(response.statusCode).toEqual(200);
        }).finally(() => api.del('/imposters'));
    });

    it('should default key/cert pair during imposter creation if not provided', function () {
        const request = { protocol: 'https', port };

        return api.post('/imposters', request).then((response: any) => {
            expect(response.statusCode).toEqual(201);
            expect(response.body.key).toEqual(defaultKey);
            expect(response.body.cert).toEqual(defaultCert);
            return client.get('/', port);
        }).then((response: any) => {
            expect(response.statusCode).toEqual(200);
        }).finally(() => api.del('/imposters'));
    });

    it('should work with mutual auth', function () {
        const request = { protocol: 'https', port, mutualAuth: true };

        return api.post('/imposters', request).then((response: any) => {
            expect(response.statusCode).toEqual(201);
            expect(response.body.mutualAuth).toEqual(true);
            return client.responseFor({
                method: 'GET',
                path: '/',
                port,
                agent: false,
                key,
                cert
            });
        }).then((response: any) => {
            expect(response.statusCode).toEqual(200);
        }).finally(() => api.del('/imposters'));
    });

    it('should support proxying to origin server requiring mutual auth', function () {
        const originServerPort = port + 1,
            originServerRequest = {
                protocol: 'https',
                port: originServerPort,
                stubs: [{ responses: [{ is: { body: 'origin server' } }] }],
                name: 'origin',
                mutualAuth: true
            },
            proxy = {
                to: `https://localhost:${originServerPort}`,
                key,
                cert
            },
            proxyRequest = {
                protocol: 'https',
                port,
                stubs: [{ responses: [{ proxy: proxy }] }],
                name: 'proxy'
            };

        return api.post('/imposters', originServerRequest).then((response: any) => {
            expect(response.statusCode).toEqual(201);
            return api.post('/imposters', proxyRequest);
        }).then((response: any) => {
            expect(response.statusCode).toEqual(201);
            return client.get('/', port);
        }).then((response: any) => {
            expect(response.body).toEqual('origin server');
        }).finally(() => api.del('/imposters'));
    });
});
