const httpRequest = require('../../../src/models/http/httpRequest');
import * as events from 'events';
import * as inherit from '../../../src/util/inherit';

describe('HttpRequest', function () {
    describe('#createFrom', function () {
        let request: any;

        beforeEach(() => {
            request = inherit.from(events.EventEmitter as any, {
                socket: { remoteAddress: '', remotePort: '' },
                setEncoding: jest.fn(),
                url: 'http://localhost/',
                rawHeaders: []
            });
        });

        it('should set requestFrom from socket information', function () {
            request.socket = { remoteAddress: 'HOST', remotePort: 'PORT' };

            const promise = httpRequest.createFrom(request).then((mbRequest: any) => expect(mbRequest.requestFrom).toEqual('HOST:PORT'));

            request.emit('end');

            return promise;
        });

        it('should echo method from original request', function () {
            request.method = 'METHOD';

            const promise = httpRequest.createFrom(request).then((mbRequest: any) => expect(mbRequest.method).toEqual('METHOD'));

            request.emit('end');

            return promise;
        });

        it('should transform rawHeaders from original request, keeping case and duplicates', function () {
            request.rawHeaders = [
                'Accept', 'text/plain',
                'Accept', 'TEXT/html',
                'accept', '*',
                'Host', '127.0.0.1:8000'
            ];

            const promise = httpRequest.createFrom(request).then((mbRequest: any) => expect(mbRequest.headers).toEqual({
                Accept: ['text/plain', 'TEXT/html'],
                accept: '*',
                Host: '127.0.0.1:8000'
            }));

            request.emit('end');

            return promise;
        });

        it('should transform form', function () {
            return shouldTransformForm('application/x-www-form-urlencoded');
        });

        it('should transform form for application/x-www-form-urlencoded;charset=UTF-8', function () {
            return shouldTransformForm('application/x-www-form-urlencoded;charset=UTF-8');
        });

        it('should transform form for application/x-www-form-urlencoded; charset=UTF-8', function () {
            return shouldTransformForm('application/x-www-form-urlencoded; charset=UTF-8');
        });

        it('should transform form with lowercased content-type header name', function () {
            return shouldTransformForm('application/x-www-form-urlencoded', 'content-type');
        });

        function shouldTransformForm (contentType: any, contentTypeHeader = 'Content-Type') {
            request.rawHeaders = [
                contentTypeHeader, contentType,
                'Host', '127.0.0.1:8000'
            ];

            const promise = httpRequest.createFrom(request).then((mbRequest: any) => {
                expect(mbRequest.headers).toEqual({
                    Host: '127.0.0.1:8000',
                    [contentTypeHeader]: contentType
                });
                expect(mbRequest.form).toEqual({
                    firstname: 'ruud',
                    lastname: 'mountebank'
                });
            });

            request.emit('data', 'firstname=ruud&lastname=mountebank');
            request.emit('end');

            return promise;
        }

        it('should set path and query from request url', function () {
            request.url = 'http://localhost/path?key=value';

            const promise = httpRequest.createFrom(request).then((mbRequest: any) => {
                expect(mbRequest.path).toEqual('/path');
                expect(mbRequest.query).toEqual({ key: 'value' });
            });

            request.emit('end');

            return promise;
        });

        it('should set body from data events', function () {
            const promise = httpRequest.createFrom(request).then((mbRequest: any) => expect(mbRequest.body).toEqual('12'));

            request.emit('data', '1');
            request.emit('data', '2');
            request.emit('end');

            return promise;
        });
    });
});
