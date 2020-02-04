

import * as middleware from '../../src/util/middleware';
import { FakeResponse } from '../fakes/fakeResponse';

describe('middleware', function () {
    let request: any;
    let response: any;
    let next: any;

    beforeEach(() => {
        request = { headers: {}, params: {} };
        response = new FakeResponse();
        next = jest.fn();
    });

    describe('#useAbsoluteUrls', function () {
        let send: any;
        let setHeader: any;

        beforeEach(() => {
            send = jest.fn();
            setHeader = jest.fn();
            response.send = send;
            response.setHeader = setHeader;
        });

        it('should not change header if not location header', function () {
            const middlewareFn = middleware.useAbsoluteUrls(9000);

            middlewareFn(request, response, next);
            response.setHeader('name', 'value');

            expect(setHeader).toBeCalledWith('name', 'value');
        });

        it('should default location header to localhost with given port if no host header', function () {
            request.headers.host = '';
            const middlewareFn = middleware.useAbsoluteUrls(9000);

            middlewareFn(request, response, next);
            response.setHeader('location', '/');

            expect(setHeader).toBeCalledWith('location', 'http://localhost:9000/');
        });

        it('should match location header regardless of case', function () {
            request.headers.host = '';
            const middlewareFn = middleware.useAbsoluteUrls(9000);

            middlewareFn(request, response, next);
            response.setHeader('LOCATION', '/');

            expect(setHeader).toBeCalledWith('LOCATION', 'http://localhost:9000/');
        });

        it('should use the host header if present', function () {
            request.headers.host = 'mountebank.com';
            const middlewareFn = middleware.useAbsoluteUrls(9000);

            middlewareFn(request, response, next);
            response.setHeader('location', '/');

            expect(setHeader).toBeCalledWith('location', 'http://mountebank.com/');
        });

        it('should do nothing if no response body links are present', function () {
            const middlewareFn = middleware.useAbsoluteUrls(9000);

            middlewareFn(request, response, next);
            response.send({ key: 'value' });

            expect(send).toBeCalledWith({ key: 'value' });
        });

        it('should change response body links', function () {
            const middlewareFn = middleware.useAbsoluteUrls(9000);

            middlewareFn(request, response, next);
            response.send({ key: 'value', _links: { rel: { href: '/' } } });

            expect(send).toBeCalledWith({ key: 'value', _links: { rel: { href: 'http://localhost:9000/' } } });
        });

        it('should change response nested body links', function () {
            const middlewareFn = middleware.useAbsoluteUrls(9000);

            middlewareFn(request, response, next);
            response.send({ key: { _links: { rel: { href: '/' } } } });

            expect(send).toBeCalledWith({ key: { _links: { rel: { href: 'http://localhost:9000/' } } } });
        });

        it('should ignore null and undefined values', function () {
            const middlewareFn = middleware.useAbsoluteUrls(9000);

            middlewareFn(request, response, next);
            response.send({ first: null, second: undefined });

            expect(send).toBeCalledWith({ first: null });
        });

        it('should not change html responses', function () {
            const middlewareFn = middleware.useAbsoluteUrls(9000);

            middlewareFn(request, response, next);
            response.send('<html _links="/"></html>');

            expect(send).toBeCalledWith('<html _links="/"></html>');
        });

        it('should not change links within stub responses', function () {
            const middlewareFn = middleware.useAbsoluteUrls(9000);
            const userRequest = ({
                stubs: [{
                    responses: [{
                        is: {
                            body: {
                                _links: { self: { href: '/path/to' } }
                            }
                        }
                    }]
                }]
            });

            middlewareFn(request, response, next);
            response.send(userRequest);

            expect(send).toBeCalledWith(userRequest);
        });

        it('should change links within stub _links', function () {
            const middlewareFn = middleware.useAbsoluteUrls(9000);
            const userRequest = ({ stubs: [{ _links: { self: { href: '/path/to' } } }] });

            middlewareFn(request, response, next);
            response.send(userRequest);

            expect(send).toBeCalledWith({ stubs: [{ _links: { self: { href: 'http://localhost:9000/path/to' } } }] });
        });

        it('should change links within stub _links with root imposters array', function () {
            const middlewareFn = middleware.useAbsoluteUrls(9000);
            const userRequest = ({
                imposters: [{
                    stubs: [{ _links: { self: { href: '/path/to' } } }]
                }]
            });

            middlewareFn(request, response, next);
            response.send(userRequest);

            expect(send).toBeCalledWith({
                imposters: [{
                    stubs: [{ _links: { self: { href: 'http://localhost:9000/path/to' } } }]
                }]
            });
        });

        it('should not change links within response elements sent back to protocol implementations', function () {
            const middlewareFn = middleware.useAbsoluteUrls(9000);
            const userRequest = {
                response: {
                    statusCode: 200,
                    body: { _links: { self: { href: '/path/to' } } }
                }
            };

            middlewareFn(request, response, next);
            response.send(userRequest);

            expect(send).toBeCalledWith(userRequest);
        });
    });

    describe('#validateImposterExists', function () {
        it('should return 404 if imposter does not exist', function () {
            const middlewareFn = middleware.createImposterValidator({});
            request.params.id = 1;

            middlewareFn(request, response, next);

            expect(response.statusCode).toEqual(404);
        });

        it('should call next if imposter exists', function () {
            const imposters = { 1: {} } as any;
            const middlewareFn = middleware.createImposterValidator(imposters);
            request.params.id = 1;

            middlewareFn(request, response, next);

            expect(next).toBeCalled();
        });
    });

    describe('#logger', function () {
        it('should log request at info level', function () {
            const log = { info: jest.fn() } as any;
            const middlewareFn = middleware.logger(log, 'TEST MESSAGE');
            request = { url: '', headers: { accept: '' } };

            middlewareFn(request, {} as any, next);

            expect(log.info).toBeCalledWith('TEST MESSAGE');
        });

        it('should log protocol implementation requests at debug level', function () {
            const log: any = { debug: jest.fn() };
            const middlewareFn = middleware.logger(log, 'TEST MESSAGE');
            request = { url: '/_requests/0', headers: { accept: '' } };

            middlewareFn(request, {} as any, next);

            expect(log.debug).toBeCalledWith('TEST MESSAGE');
        });

        it('should log request url and method', function () {
            const log: any = { info: jest.fn() };
            const middlewareFn = middleware.logger(log, 'MESSAGE WITH :method :url');
            request = { method: 'METHOD', url: 'URL', headers: { accept: '' } };

            middlewareFn(request, {} as any, next);

            expect(log.info).toBeCalledWith('MESSAGE WITH METHOD URL');
        });

        it('should not log static asset requests', function () {
            const log: any = { info: jest.fn() };
            const middlewareFn = middleware.logger(log, 'TEST');

            ['.js', '.css', '.png', '.ico'].forEach(ext => {
                request = { url: `file${ext}`, headers: { accept: '' } };
                middlewareFn(request, {} as any, next);
                expect(log.info).not.toBeCalled();
            });
        });

        it('should not log html requests', function () {
            const log: any = { info: jest.fn() };
            const middlewareFn = middleware.logger(log, 'TEST');
            request = { method: 'METHOD', url: 'URL', headers: { accept: 'text/html' } };

            middlewareFn(request, {} as any, next);

            expect(log.info).not.toBeCalled();
        });

        it('should not log AJAX requests', function () {
            const log: any = { info: jest.fn() };
            const middlewareFn = middleware.logger(log, 'TEST');
            request = { method: 'METHOD', url: 'URL', headers: { 'x-requested-with': 'XMLHttpRequest' } };

            middlewareFn(request, {} as any, next);

            expect(log.info).not.toBeCalled();
        });

        it('should call next', function () {
            const log: any = { info: jest.fn() };
            const middlewareFn = middleware.logger(log, 'TEST');
            request = { url: '', headers: { accept: '' } };

            middlewareFn(request, {} as any, next);

            expect(next).toBeCalled();
        });
    });

    describe('#globals', function () {
        it('should pass variables to all render calls', function () {
            const render = jest.fn();
            const middlewareFn = middleware.globals({ first: 1, second: 2 });
            response = { render: render };

            middlewareFn({} as any, response, next);
            response.render('view');

            expect(render).toBeCalledWith('view', { first: 1, second: 2 });
        });

        it('should merge variables to all render calls', function () {
            const render = jest.fn();
            const middlewareFn = middleware.globals({ first: 1, second: 2 });
            response = { render: render };

            middlewareFn({} as any, response, next);
            response.render('view', { third: 3 });

            expect(render).toBeCalledWith('view', { third: 3, first: 1, second: 2 });
        });

        it('should overwrite variables of the same name', function () {
            const render = jest.fn();
            const middlewareFn = middleware.globals({ key: 'global' });
            response = { render: render };

            middlewareFn({} as any, response, next);
            response.render('view', { key: 'local' });

            expect(render).toBeCalledWith('view', { key: 'global' });
        });
    });

    describe('#defaultIEtoHTML', function () {
        it('should not change accept header for non-IE user agents', function () {
            request.headers['user-agent'] = 'blah Chrome blah';
            request.headers.accept = 'original accept';

            middleware.defaultIEtoHTML(request, {} as any, jest.fn());

            expect(request.headers.accept).toEqual('original accept');
        });

        it('should change accept header for IE user agents', function () {
            request.headers['user-agent'] = 'blah MSIE blah';
            request.headers.accept = '*/*';

            middleware.defaultIEtoHTML(request, response, next);

            expect(request.headers.accept).toEqual('text/html');
        });

        it('should not change accept header for IE user agents if application/json explicitly included', function () {
            request.headers['user-agent'] = 'blah MSIE blah';
            request.headers.accept = 'accept/any, application/json';

            middleware.defaultIEtoHTML(request, response, next);

            expect(request.headers.accept).toEqual('accept/any, application/json');
        });
    });
});
