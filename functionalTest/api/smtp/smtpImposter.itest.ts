import { ApiClient } from '../api';

const client = require('./smtpClient');

describe('smtp imposter', function () {
    let api: any;
    let port: number;

    beforeEach(() => {
        api = new ApiClient();
        port = api.port + 1;
    });

    describe('POST /imposters/:id', function () {
        it('should auto-assign port if port not provided', function () {
            const request = { protocol: 'smtp' };

            return api.post('/imposters', request).then((response: any) => {
                expect(response.statusCode).toEqual(201);
                expect(response.body.port > 0).toBeTruthy();
            }).finally(() => api.del('/imposters'));
        });
    });

    describe('GET /imposters/:id', function () {
        it('should provide access to all requests', function () {
            const imposterRequest = { protocol: 'smtp', port };

            return api.post('/imposters', imposterRequest)
                .then(() => client.send({
                    envelopeFrom: 'envelopeFrom1@mb.org',
                    envelopeTo: ['envelopeTo1@mb.org'],
                    from: '"From 1" <from1@mb.org>',
                    to: ['"To 1" <to1@mb.org>'],
                    subject: 'subject 1',
                    text: 'text 1'
                }, port)).then(() => client.send({
                    envelopeFrom: 'envelopeFrom2@mb.org',
                    envelopeTo: ['envelopeTo2@mb.org'],
                    from: '"From 2" <from2@mb.org>',
                    to: ['"To 2" <to2@mb.org>'],
                    cc: ['"CC 2" <cc2@mb.org>'],
                    bcc: ['"BCC 2" <bcc2@mb.org>'],
                    subject: 'subject 2',
                    text: 'text 2'
                }, port))
                .then(() => api.get(`/imposters/${port}`))
                .then((response: any) => {
                    const requests = response.body.requests;
                    requests.forEach((request: any) => {
                        if (request.requestFrom) {
                            request.requestFrom = 'HERE';
                        }
                        if (request.timestamp) {
                            request.timestamp = 'NOW';
                        }
                    });
                    expect(requests).toEqual([
                        {
                            timestamp: 'NOW',
                            requestFrom: 'HERE',
                            envelopeFrom: 'envelopeFrom1@mb.org',
                            envelopeTo: ['envelopeTo1@mb.org'],
                            from: { address: 'from1@mb.org', name: 'From 1' },
                            to: [{ address: 'to1@mb.org', name: 'To 1' }],
                            cc: [],
                            bcc: [],
                            subject: 'subject 1',
                            priority: 'normal',
                            references: [],
                            inReplyTo: [],
                            ip: '127.0.0.1',
                            text: 'text 1',
                            html: '',
                            attachments: []
                        },
                        {
                            timestamp: 'NOW',
                            requestFrom: 'HERE',
                            envelopeFrom: 'envelopeFrom2@mb.org',
                            envelopeTo: ['envelopeTo2@mb.org'],
                            from: { address: 'from2@mb.org', name: 'From 2' },
                            to: [{ address: 'to2@mb.org', name: 'To 2' }],
                            cc: [{ address: 'cc2@mb.org', name: 'CC 2' }],
                            bcc: [{ address: 'bcc2@mb.org', name: 'BCC 2' }],
                            subject: 'subject 2',
                            priority: 'normal',
                            references: [],
                            inReplyTo: [],
                            ip: '127.0.0.1',
                            text: 'text 2',
                            html: '',
                            attachments: []
                        }
                    ]);
                })
                .finally(() => api.del('/imposters'));
        });
    });

    describe('DELETE /imposters/:id should shutdown server at that port', function () {
        it('should shutdown server at that port', function () {
            const request = { protocol: 'smtp', port };

            return api.post('/imposters', request)
                .then((response: any) => api.del(response.headers.location))
                .then((response: any) => {
                    expect(response.statusCode).toEqual(200);
                    return api.post('/imposters', request);
                })
                .then((response: any) => {
                    expect(response.statusCode).toEqual(201);
                })
                .finally(() => api.del(`/imposters/${port}`));
        });
    });
});
