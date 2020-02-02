import {ApiClient} from "../api/api";
const assert = require('assert');
import {DOMWindow, JSDOM} from 'jsdom';
const Q = require('q');


describe('contracts', function () {
    let api: any;

    function getDOM (endpoint: string): Q.Promise<DOMWindow> {
        const deferred = Q.defer();
        const url = api.url + endpoint;

        JSDOM.fromURL(url).then(dom => {
            deferred.resolve(dom.window);
        }).catch(errors => {
            deferred.reject(errors);
        });

        return deferred.promise;
    }

    function getJSONFor (contract: string) {
        return getDOM('/docs/api/contracts')
            .then(window => Q(window.document.getElementById(`${contract}-specification`)!.innerHTML.replace(/<[^>]+>/g, '')));
    }

    function assertJSON (json: string) {
        try {
            JSON.parse(json);
        }
        catch (e) {
            assert.fail(`${json}\n${e}`);
        }
    }

    beforeAll(() => {
        api = new ApiClient();
    });

    ['home', 'imposters', 'imposter', 'config', 'logs'].forEach(contractType => {
        it(`${contractType} contract should be valid JSON`, function () {
            return getJSONFor(contractType).then(json => {
                assertJSON(json);
            });
        });
    });
});
