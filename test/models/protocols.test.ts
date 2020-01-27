'use strict';

const assert = require('assert');
const mock = require('../mock').mock;
const FakeLogger = require('../fakes/fakeLogger');
import * as fs from 'fs';
import * as Q from 'q';
import * as loader from '../../src/models/protocols';

describe('protocols', function () {
    describe('#load', function () {
        let config: any;

        beforeEach(function () {
            config = { loglevel: 'info', callbackURLTemplate: 'url' };
        });

        it('should return only builtins if no customProtocols passed in', function () {
            const builtIns:any = {proto: {create: mock()}};
            const protocols = loader.load(builtIns, {}, config);
            assert.deepEqual(Object.keys(protocols), ['proto']);
        });

        describe('#outOfProcessCreate', function () {
            it('should error if invalid command passed', function () {
                const customProtocols: any = {test: {createCommand: 'no-such-command'}};
                const protocols = loader.load({}, customProtocols, config);
                const logger = FakeLogger.create();

                return protocols.test.createServer!({}, logger).then(() => {
                    assert.fail('should have errored');
                }, (error: any) => {
                    delete error.details;
                    assert.deepEqual(error, {
                        code: 'cannot start server',
                        message: 'Invalid configuration for protocol "test": cannot run "no-such-command"',
                        source: 'no-such-command'
                    });
                });
            });

            it('should return even if invalid JSON written on stdout', function () {
                const fn = () => { console.log('TESTING 1 2 3'); };
                fs.writeFileSync('protocol-test.js', `const fn = ${fn.toString()}; fn();`);

                const customProtocols:any = {test: {createCommand: 'node ./protocol-test.js'}};
                const protocols = loader.load({}, customProtocols, config);
                const logger = FakeLogger.create();

                return protocols.test.createServer!({}, logger).then(server => {
                    assert.deepEqual(server.metadata, {});
                }).finally(() => fs.unlinkSync('protocol-test.js'));
            });

            it('should default to the port in the creationRequest', function () {
                const fn = () => { console.log('{}'); };
                fs.writeFileSync('protocol-test.js', `const fn = ${fn.toString()}; fn();`);

                const customProtocols: any = {test: {createCommand: 'node ./protocol-test.js'}};
                const protocols = loader.load({}, customProtocols, config);
                const logger = FakeLogger.create();

                return protocols.test.createServer!({ port: 3000 }, logger).then(server => {
                    assert.strictEqual(server.port, 3000);
                }).finally(() => fs.unlinkSync('protocol-test.js'));
            });

            it('should allow changing port by writing it as JSON to stdout', function () {
                const fn = () => { console.log(JSON.stringify({ port: 3000 })); };
                fs.writeFileSync('protocol-test.js', `const fn = ${fn.toString()}; fn();`);

                const customProtocols: any = {test: {createCommand: 'node ./protocol-test.js'}};
                const protocols = loader.load({}, customProtocols, config);
                const logger = FakeLogger.create();

                return protocols.test.createServer!({}, logger).then(server => {
                    assert.strictEqual(server.port, 3000);
                }).finally(() => fs.unlinkSync('protocol-test.js'));
            });

            it('should allow returning metadata by writing it as JSON to stdout', function () {
                const fn = () => { console.log(JSON.stringify({ mode: 'text' })); };
                fs.writeFileSync('protocol-test.js', `const fn = ${fn.toString()}; fn();`);

                const customProtocols: any = {test: {createCommand: 'node ./protocol-test.js'}};
                const protocols = loader.load({}, customProtocols, config);
                const logger = FakeLogger.create();

                return protocols.test.createServer!({}, logger).then(server => {
                    assert.deepEqual(server.metadata, { mode: 'text' });
                }).finally(() => fs.unlinkSync('protocol-test.js'));
            });

            it('should pipe stdout to the logger', function () {
                const fn = () => {
                    console.log(JSON.stringify({}));
                    console.log('debug testing 1 2 3');
                    console.log('info testing 2 3 4');
                    console.log('warn testing 3 4 5');
                    console.log('error testing 4 5 6');
                };
                fs.writeFileSync('protocol-test.js', `const fn = ${fn.toString()}; fn();`);

                const customProtocols: any = {test: {createCommand: 'node ./protocol-test.js'}};
                const protocols = loader.load({}, customProtocols, config);
                const logger = FakeLogger.create();

                // Sleep to allow the log statements to finish
                return protocols.test.createServer!({}, logger).then(() => Q.delay(100)).then(() => {
                    logger.debug.assertLogged('testing 1 2 3');
                    logger.info.assertLogged('testing 2 3 4');
                    logger.warn.assertLogged('testing 3 4 5');
                    logger.error.assertLogged('testing 4 5 6');
                }).finally(() => fs.unlinkSync('protocol-test.js'));
            });

            it('should pass port and callback url to process', function () {
                const fn = () => { console.log(JSON.stringify({ args: process.argv.splice(2) })); };
                fs.writeFileSync('protocol-test.js', `const fn = ${fn.toString()}; fn();`);

                config.callbackURLTemplate = 'CALLBACK-URL';
                const customProtocols: any = {test: {createCommand: 'node ./protocol-test.js'}};
                const protocols = loader.load({}, customProtocols, config);
                const logger = FakeLogger.create();
                const creationRequest = {port: 3000};

                return protocols.test.createServer!(creationRequest, logger).then(server => {
                    assert.deepEqual(server.metadata.args, [
                        JSON.stringify({
                            port: 3000,
                            callbackURLTemplate: 'CALLBACK-URL',
                            loglevel: 'info'
                        })
                    ]);
                }).finally(() => fs.unlinkSync('protocol-test.js'));
            });

            it('should pass custom defaultResponse to process', function () {
                const fn = () => { console.log(JSON.stringify({ args: process.argv.splice(2) })); };
                fs.writeFileSync('protocol-test.js', `const fn = ${fn.toString()}; fn();`);

                config.callbackURLTemplate = 'CALLBACK-URL';
                const customProtocols: any = {test: {createCommand: 'node ./protocol-test.js'}};
                const protocols = loader.load({}, customProtocols, config);
                const logger = FakeLogger.create();
                const creationRequest = {port: 3000, defaultResponse: {key: 'default'}};

                return protocols.test.createServer!(creationRequest, logger).then(server => {
                    assert.deepEqual(server.metadata.args, [
                        JSON.stringify({
                            port: 3000,
                            callbackURLTemplate: 'CALLBACK-URL',
                            loglevel: 'info',
                            defaultResponse: { key: 'default' }
                        })
                    ]);
                }).finally(() => fs.unlinkSync('protocol-test.js'));
            });

            it('should pass custom customProtocolFields to process', function () {
                const fn = () => { console.log(JSON.stringify({ args: process.argv.splice(2) })); };
                fs.writeFileSync('protocol-test.js', `const fn = ${fn.toString()}; fn();`);

                config.callbackURLTemplate = 'CALLBACK-URL';
                const customProtocols: any = {
                    test: {
                        createCommand: 'node ./protocol-test.js',
                        customProtocolFields: ['key1', 'key3']
                    }
                };
                const protocols = loader.load({}, customProtocols, config);
                const logger = FakeLogger.create();
                const creationRequest = {
                    protocol: 'test',
                    port: 3000,
                    name: 'name',
                    stubs: [],
                    recordRequests: false,
                    key1: 'FIRST',
                    key2: 'SECOND'
                };

                return protocols.test.createServer!(creationRequest, logger).then(server => {
                    assert.deepEqual(server.metadata.args, [
                        JSON.stringify({
                            port: 3000,
                            callbackURLTemplate: 'CALLBACK-URL',
                            loglevel: 'info',
                            key1: 'FIRST',
                            key2: 'SECOND'
                        })
                    ]);
                }).finally(() => fs.unlinkSync('protocol-test.js'));
            });
        });
    });
});
