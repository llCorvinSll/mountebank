const api = require('./api').create();
const promiseIt = require('../testHelpers').promiseIt;

describe('GET /', function () {
    it('should return correct hypermedia', function () {
        let links: any;

        return api.get('/').then((response: any) => {
            expect(response.statusCode).toEqual(200);
            links = response.body._links;
            return api.get(links.imposters.href);
        }).then((response: any) => {
            expect(response.statusCode).toEqual(200);
            return api.get(links.config.href);
        }).then((response: any) => {
            expect(response.statusCode).toEqual(200);
            return api.get(links.logs.href);
        }).then((response: any) => {
            expect(response.statusCode).toEqual(200);
        });
    });
});
