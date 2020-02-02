import {FakeResponse} from "../fakes/fakeResponse";
import * as  Controller from '../../src/controllers/homeController';
import { Response } from 'express';

describe('homeController', function () {
    describe('#get', function () {
        it('should return base hypermedia', function () {
            const response = new FakeResponse(),
                controller = Controller.create([]);

            controller.get({} as any, response as unknown as Response);

            expect(response.body).toEqual({
                _links: {
                    imposters: {href: '/imposters'},
                    config: {href: '/config'},
                    logs: {href: '/logs'}
                }
            });
        });
    });
});
