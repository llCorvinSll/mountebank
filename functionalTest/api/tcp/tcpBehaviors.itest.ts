import {ApiClient} from "../api";
const tcp = require('./tcpClient');
const fs = require('fs');
const util = require('util');

describe('tcp imposter', function () {
    let api: any;
    let port: number;

    beforeEach(() => {
        api = new ApiClient();
        port = api.port + 1;
    })

    describe('POST /imposters with stubs', function () {
        it('should support decorating response from origin server', function () {
            const originServerPort = port + 1;
            const originServerStub = {responses: [{is: {data: 'ORIGIN'}}]};
            const originServerRequest = {
                protocol: 'tcp',
                port: originServerPort,
                stubs: [originServerStub],
                name: 'ORIGIN'
            };
            const decorator = (request:any, response:any) => {
                response.data += ' DECORATED';
            };
            const proxyResponse = {
                proxy: {to: 'tcp://localhost:' + originServerPort},
                _behaviors: {decorate: decorator.toString()}
            };
            const proxyStub = {responses: [proxyResponse]};
            const proxyRequest = {protocol: 'tcp', port, stubs: [proxyStub], name: 'PROXY'};

            return api.post('/imposters', originServerRequest)
                .then(() => api.post('/imposters', proxyRequest))
                .then(() => tcp.send('request', port))
                .then((response: any) => {
                    expect(response.toString()).toEqual('ORIGIN DECORATED');
                })
                .finally(() => api.del('/imposters'));
        });

        it('should compose multiple behaviors together', function () {
            const shellFn = function exec () {
                    console.log(process.argv[3].replace('${SALUTATION}', 'Hello'));
                },
                decorator = (request: any, response: any) => {
                    response.data = response.data.replace('${SUBJECT}', 'mountebank');
                },
                stub = {
                    responses: [
                        {
                            is: { data: '${SALUTATION}, ${SUBJECT}${PUNCTUATION}' },
                            _behaviors: {
                                wait: 300,
                                repeat: 2,
                                shellTransform: ['node shellTransformTest.js'],
                                decorate: decorator.toString(),
                                copy: [{
                                    from: 'data',
                                    into: '${PUNCTUATION}',
                                    using: { method: 'regex', selector: '[,.?!]' }
                                }]
                            }
                        },
                        {
                            is: { data: 'No behaviors' }
                        }
                    ]
                },
                stubs = [stub],
                request = { protocol: 'tcp', port, stubs: stubs },
                timer = Date.now();

            fs.writeFileSync('shellTransformTest.js', util.format('%s\nexec();', shellFn.toString()));

            return api.post('/imposters', request).then((response: any) => {
                expect(response.statusCode).toEqual(201);
                return tcp.send('!', port);
            }).then((response: any) => {
                const time = Date.now() - timer;
                expect(response.toString()).toEqual('Hello, mountebank!');
                expect(time >= 250).toBeTruthy();
                return tcp.send('!', port);
            }).then((response: any) => {
                const time = Date.now() - timer;
                expect(response.toString()).toEqual('Hello, mountebank!');
                expect(time >= 250).toBeTruthy();
                return tcp.send('!', port);
            }).then((response: any) => {
                expect(response.toString()).toEqual('No behaviors');
            }).finally(() => {
                fs.unlinkSync('shellTransformTest.js');
                return api.del('/imposters');
            });
        });
    });
});
