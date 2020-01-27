const TcpRequest = require('../../../src/models/tcp/tcpRequest');

describe('tcpRequest', function () {
    describe('#createFrom', function () {
        it('should echo data', function () {
            return TcpRequest.createFrom({ socket: {}, data: 'DATA' }).then((request: any) => {
                expect(request.data).toEqual('DATA');
            });
        });

        it('should format requestFrom from socket', function () {
            const socket = { remoteAddress: 'HOST', remotePort: 'PORT' };

            return TcpRequest.createFrom({ socket: socket, data: '' }).then((request: any) => {
                expect(request.requestFrom).toEqual('HOST:PORT');
            });
        });
    });
});
