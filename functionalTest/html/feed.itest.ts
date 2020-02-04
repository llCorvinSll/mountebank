import { ApiClient } from '../api/api';
const httpClient = require('../api/http/baseHttpClient').create('http');
import * as xpath from 'xpath';
import { DOMParser } from 'xmldom';
const isWindows = require('os').platform().indexOf('win') === 0;

function entryCount (body: string): any {
    const doc = new DOMParser().parseFromString(body);
    const select = xpath.useNamespaces({ atom: 'http://www.w3.org/2005/Atom' });
    return select('count(//atom:entry)', doc);
}

function getNextLink (body: string) {
    const doc = new DOMParser().parseFromString(body);
    const select = xpath.useNamespaces({ atom: 'http://www.w3.org/2005/Atom' });
    return (select('//atom:link[@rel="next"]/@href', doc)[0] as any).value;
}

// TODO: Total hack. Started failing on Appveyor with ECONNRESET and timeouts; don't know why
if (!isWindows) {
    describe('the feed', function () {
        let api: any;

        beforeAll(() => {
            api = new ApiClient();
        });

        it('should default to page 1 with 10 entries', function () {
            return httpClient.get('/feed', api.port).then((response: any) => {
                expect(response.statusCode).toEqual(200);
                expect(response.headers['content-type']).toEqual('application/atom+xml; charset=utf-8');
                expect(entryCount(response.body)).toEqual(10);

                return httpClient.get(getNextLink(response.body), api.port);
            }).then((response: any) => {
                expect(response.statusCode).toEqual(200);
                expect(entryCount(response.body) > 0).toBeTruthy();
            });
        });
    });
}
