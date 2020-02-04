import * as Controller from '../../src/controllers/logsController';
import * as fs from 'fs';
import { FakeResponse } from '../fakes/fakeResponse';

describe('logsController', function () {
    describe('#get', function () {
        let response: any;
        let controller: any;

        afterEach(() => {
            fs.unlinkSync('logsControllerTest.log');
        });

        beforeEach(() => {
            response = new FakeResponse();
            controller = Controller.create('logsControllerTest.log');
        });

        it('should return full contents of logfile as JSON array by default', function () {
            fs.writeFileSync('logsControllerTest.log', '{"key": "first"}\n{"key": "second"}\n');
            controller.get({ url: '/logs' } as any, response);

            expect(response.body).toEqual({
                logs: [
                    { key: 'first' },
                    { key: 'second' }
                ]
            });
        });

        it('should return entries starting with startIndex', function () {
            fs.writeFileSync('logsControllerTest.log', '{"key": "first"}\n{"key": "second"}\n{"key": "third"}');
            controller.get({ url: '/logs?startIndex=1' }, response);

            expect(response.body).toEqual({
                logs: [
                    { key: 'second' },
                    { key: 'third' }
                ]
            });
        });

        it('should return entries starting with startIndex and ending with endIndex', function () {
            fs.writeFileSync('logsControllerTest.log', '{"key": "first"}\n{"key": "second"}\n{"key": "third"}');
            controller.get({ url: '/logs?startIndex=0&endIndex=1' }, response);

            expect(response.body).toEqual({
                logs: [
                    { key: 'first' },
                    { key: 'second' }
                ]
            });
        });
    });
});
