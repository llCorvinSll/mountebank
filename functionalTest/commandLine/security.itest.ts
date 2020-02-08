import { ApiClient } from '../api/api';
const assert = require('assert');
import { BaseHttpClient } from '../api/http/baseHttpClient';
const Q = require('q');
import * as os from 'os';


describe('security', function () {
    let api: any;
    let port: number;
    let mb: any;
    let httpClient: BaseHttpClient;

    beforeEach(() => {
        httpClient = new BaseHttpClient('http');
        api = new ApiClient();
        port = api.port + 1;
        mb = require('../mb').create(port + 1);
    });

    afterEach(() => mb.stop());

    describe('mb without --allowInjection', function () {

        it('should return a 400 if response injection is used', function () {
            const fn = (request: any) => ({ body: `${request.method} INJECTED` });
            const stub = { responses: [{ inject: fn.toString() }] };
            const request = { protocol: 'http', port, stubs: [stub] };

            return mb.start()
                .then(() => mb.post('/imposters', request))
                .then((response: any) => {
                    expect(response.statusCode).toEqual(400);
                    expect(response.body.errors[0].code).toEqual('invalid injection');
                })
                .finally(() => mb.stop());
        });

        it('should return a 400 if predicate injection is used', function () {
            const fn = () => true;
            const stub = {
                predicates: [{ inject: fn.toString() }],
                responses: [{ is: { body: 'Hello, World! ' } }]
            };
            const request = { protocol: 'http', port, stubs: [stub] };

            return mb.start()
                .then(() => mb.post('/imposters', request))
                .then((response: any) => {
                    expect(response.statusCode).toEqual(400);
                    expect(response.body.errors[0].code).toEqual('invalid injection');
                })
                .finally(() => mb.stop());
        });

        it('should return a 400 if endOfResponseResolver is used', function () {
            const stub = { responses: [{ is: { data: 'success' } }] };
            const resolver = () => true;
            const request = {
                protocol: 'tcp',
                port,
                stubs: [stub],
                mode: 'text',
                endOfRequestResolver: { inject: resolver.toString() }
            };

            return mb.start()
                .then(() => mb.post('/imposters', request))
                .then((response: any) => {
                    expect(response.statusCode).toEqual(400);
                    expect(response.body.errors[0].code).toEqual('invalid injection');
                })
                .finally(() => mb.stop());
        });

        it('should return a 400 if a decorate behavior is used', function () {
            const fn = (response: any) => response;
            const stub = { responses: [{ is: { body: 'Hello, World! ' }, _behaviors: { decorate: fn.toString() } }] };
            const request = { protocol: 'http', port, stubs: [stub] };

            return mb.start()
                .then(() => mb.post('/imposters', request))
                .then((response: any) => {
                    expect(response.statusCode).toEqual(400);
                    expect(response.body.errors[0].code).toEqual('invalid injection');
                })
                .finally(() => mb.stop());
        });

        it('should return a 400 if a wait behavior function is used', function () {
            const fn = () => 1000;
            const stub = { responses: [{ is: { body: 'Hello, World! ' }, _behaviors: { wait: fn.toString() } }] };
            const request = { protocol: 'http', port, stubs: [stub] };

            return mb.start()
                .then(() => mb.post('/imposters', request))
                .then((response: any) => {
                    expect(response.statusCode).toEqual(400);
                    expect(response.body.errors[0].code).toEqual('invalid injection');
                })
                .finally(() => mb.stop());
        });

        it('should allow a wait behavior that directly specifies latency', function () {
            const stub = { responses: [{ is: { body: 'Hello, World! ' }, _behaviors: { wait: 100 } }] };
            const request = { protocol: 'http', port, stubs: [stub] };

            return mb.start()
                .then(() => mb.post('/imposters', request))
                .then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                })
                .finally(() => mb.stop());
        });

        it('should return a 400 if a shellTransform behavior is used', function () {
            const stub = { responses: [{ is: {}, _behaviors: { shellTransform: 'command' } }] };
            const request = { protocol: 'http', port, stubs: [stub] };

            return mb.start()
                .then(() => mb.post('/imposters', request))
                .then((response: any) => {
                    expect(response.statusCode).toEqual(400);
                    expect(response.body.errors[0].code).toEqual('invalid injection');
                })
                .finally(() => mb.stop());
        });

        it('should return a 400 if a proxy addDecorateBehavior is used', function () {
            const proxy = {
                to: 'http://google.com',
                addDecorateBehavior: '(request, response) => { response.body = ""; }'
            };
            const stub = { responses: [{ proxy: proxy }] };
            const request = { protocol: 'http', port, stubs: [stub] };

            return mb.start()
                .then(() => mb.post('/imposters', request))
                .then((response: any) => {
                    expect(response.statusCode).toEqual(400);
                    expect(response.body.errors[0].code).toEqual('invalid injection');
                })
                .finally(() => mb.stop());
        });

        it('should return a 400 if a predicateGenerator inject is used', function () {
            const proxy = {
                to: 'http://google.com',
                predicateGenerators: [{
                    inject: 'fn () { return []; }'
                }]
            };
            const stub = { responses: [{ proxy: proxy }] };
            const request = { protocol: 'http', port, stubs: [stub] };

            return mb.start()
                .then(() => mb.post('/imposters', request))
                .then((response: any) => {
                    expect(response.statusCode).toEqual(400);
                    expect(response.body.errors[0].code).toEqual('invalid injection');
                })
                .finally(() => mb.stop());
        });
    });

    xdescribe('IP blocking', function () {
        function useInterface (name: string) {
            return name.indexOf('utun') < 0 //This causes problems on my Mac
                && name.indexOf('awdl') < 0 //This causes problems on my Mac
                && name.indexOf(' ') < 0; //This causes problems on Appveyor / Windows
        }

        function ips (local: boolean): os.NetworkInterfaceInfo[] {
            const interfaces = os.networkInterfaces();
            const result: any[] = [];

            Object.keys(interfaces).forEach(name => {
                if (useInterface(name)) {
                    interfaces[name].forEach(address => {
                        if (address.internal === local) {
                            result.push({
                                family: address.family.replace('IPv', ''),
                                address: address.address,
                                iface: name
                            });
                        }
                    });
                }
            });
            return result;
        }

        function localIPs () {
            return ips(true);
        }

        function nonLocalIPs () {
            return ips(false);
        }

        function connectToHTTPServerUsing (ip: any, destinationPort = mb.port): Q.Promise<any> {
            return httpClient.responseFor({
                method: 'GET',
                path: '/',
                hostname: 'localhost',
                port: destinationPort,
                localAddress: ip.address,
                family: ip.family
            }).then(
                () => Q({ ip: ip.address, canConnect: true }),
                (error: any) => {
                    if (error.errno === 'EADDRNOTAVAIL' && ip.address.indexOf('%') < 0) {
                        //If you run ifconfig, some of the addresses have the interface name
                        //appended (I'm not sure why). Node doesn't return them that way,
                        //but apparently needs it sometimes to bind to that address.
                        return connectToHTTPServerUsing({
                            address: `${ip.address}%${ip.iface}`,
                            family: ip.family,
                            iface: ip.iface
                        }, destinationPort);
                    }
                    else {
                        return Q({ ip: ip.address, canConnect: false, error: error });
                    }
                }
            );
        }

        function connectToTCPServerUsing (ip: any, destinationPort: number) {
            const deferred = Q.defer();
            const net = require('net');
            const socket = net.createConnection({ family: ip.family, localAddress: ip.address, port: destinationPort },
                () => { socket.write('TEST'); });

            socket.once('data', () => { deferred.resolve({ ip: ip.address, canConnect: true }); });

            socket.once('end', () => {
                if (deferred.promise.isPending()) {
                    deferred.resolve({ ip: ip.address, canConnect: false, error: { code: 'ECONNRESET' } });
                }
            });

            socket.once('error', (error: any) => {
                if (error.errno === 'EADDRNOTAVAIL' && ip.address.indexOf('%') < 0) {
                    const ipWithInterface = {
                        address: `${ip.address}%${ip.iface}`,
                        family: ip.family,
                        iface: ip.iface
                    };
                    connectToTCPServerUsing(ipWithInterface, destinationPort).done(deferred.resolve);
                }
                else {
                    deferred.resolve({ ip: ip.address, canConnect: false, error: error });
                }
            });

            return deferred.promise;
        }

        it('should only allow local requests if --localOnly used', function () {
            return mb.start(['--localOnly'])
                .then(() => Q.all(nonLocalIPs().map(ip => connectToHTTPServerUsing(ip))))
                .then((rejections: any) => {
                    const allBlocked = rejections.every((attempt: any) => !attempt.canConnect && attempt.error.code === 'ECONNRESET');
                    assert.ok(allBlocked, 'Allowed nonlocal connection: ' + JSON.stringify(rejections, null, 2));

                    return Q.all(localIPs().map(ip => connectToHTTPServerUsing(ip)));
                }).then((accepts: any) => {
                    const allAccepted = accepts.every((attempt: any) => attempt.canConnect);
                    assert.ok(allAccepted, 'Blocked local connection: ' + JSON.stringify(accepts, null, 2));
                })
                .finally(() => mb.stop());
        });

        it('should only allow local requests to http imposter if --localOnly used', function () {
            const imposter = { protocol: 'http', port: mb.port + 1 };

            return mb.start(['--localOnly'])
                .then(() => mb.post('/imposters', imposter))
                .then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return Q.all(nonLocalIPs().map(ip => connectToHTTPServerUsing(ip, imposter.port)));
                })
                .then((rejections: any) => {
                    const allBlocked = rejections.every((attempt: any) => !attempt.canConnect && attempt.error.code === 'ECONNRESET');
                    assert.ok(allBlocked, 'Allowed nonlocal connection: ' + JSON.stringify(rejections, null, 2));

                    return Q.all(localIPs().map(ip => connectToHTTPServerUsing(ip, imposter.port)));
                }).then((accepts: any) => {
                    const allAccepted = accepts.every((attempt: any) => attempt.canConnect);
                    assert.ok(allAccepted, 'Blocked local connection: ' + JSON.stringify(accepts, null, 2));
                })
                .finally(() => mb.stop());
        });

        it('should only allow local requests to tcp imposter if --localOnly used', function () {
            const imposter = {
                protocol: 'tcp',
                port: mb.port + 1,
                stubs: [{ responses: [{ is: { data: 'OK' } }] }]
            };

            return mb.start(['--localOnly', '--loglevel', 'debug'])
                .then(() => mb.post('/imposters', imposter))
                .then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                    return Q.all(nonLocalIPs().map(ip => connectToTCPServerUsing(ip, imposter.port)));
                })
                .then((rejections: any) => {
                    const allBlocked = rejections.every((attempt: any) => !attempt.canConnect && attempt.error.code === 'ECONNRESET');
                    assert.ok(allBlocked, 'Allowed nonlocal connection: ' + JSON.stringify(rejections, null, 2));

                    return Q.all(localIPs().map(ip => connectToTCPServerUsing(ip, imposter.port)));
                }).then((accepts: any) => {
                    const allAccepted = accepts.every((attempt: any) => attempt.canConnect);
                    assert.ok(allAccepted, 'Blocked local connection: ' + JSON.stringify(accepts, null, 2));
                })
                .finally(() => mb.stop());
        });

        it('should allow non-local requests if --localOnly not used', function () {
            const allIPs = localIPs().concat(nonLocalIPs());

            return mb.start()
                .then(() => Q.all(allIPs.map(ip => connectToHTTPServerUsing(ip))))
                .then((results: any) => {
                    const allAccepted = results.every((attempt: any) => attempt.canConnect);
                    assert.ok(allAccepted, 'Blocked local connection: ' + JSON.stringify(results, null, 2));
                })
                .finally(() => mb.stop());
        });

        it('should block IPs not on --ipWhitelist', function () {
            if (nonLocalIPs().length < 2) {
                console.log('Skipping test - not enough IPs to test with');
                return Q(true);
            }

            const allowedIP = nonLocalIPs()[0];
            const blockedIPs = nonLocalIPs().slice(1);
            const ipWhitelist = `127.0.0.1|${allowedIP.address}`;

            return mb.start(['--ipWhitelist', ipWhitelist])
                .then(() => connectToHTTPServerUsing(allowedIP))
                .then((result: any) => {
                    assert.ok(result.canConnect, 'Could not connect to whitelisted IP: ' + JSON.stringify(result, null, 2));
                    return Q.all(blockedIPs.map(ip => connectToHTTPServerUsing(ip)));
                })
                .then((results: any) => {
                    const allBlocked = results.every((attempt: any) => !attempt.canConnect && attempt.error.code === 'ECONNRESET');
                    assert.ok(allBlocked, 'Allowed non-whitelisted connection: ' + JSON.stringify(results, null, 2));
                })
                .finally(() => mb.stop());
        });

        it('should ignore --ipWhitelist if --localOnly passed', function () {
            if (nonLocalIPs().length === 0) {
                console.log('Skipping test - not enough IPs to test with');
                return Q(true);
            }

            const allowedIP = nonLocalIPs()[0];
            const ipWhitelist = `127.0.0.1|${allowedIP.address}`;

            return mb.start(['--localOnly', '--ipWhitelist', ipWhitelist])
                .then(() => connectToHTTPServerUsing(allowedIP))
                .then((result: any) => {
                    assert.ok(!result.canConnect, 'Should have blocked whitelisted IP: ' + JSON.stringify(result, null, 2));
                })
                .finally(() => mb.stop());
        });
    });
});
