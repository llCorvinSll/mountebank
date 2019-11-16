'use strict';

import {IServer} from "../IProtocol";
import * as helpers from '../../util/helpers';

export function create (creationRequest, server:IServer, requests) {
    function addDetailsTo (result, baseURL) {
        if (creationRequest.name) {
            result.name = creationRequest.name;
        }
        result.recordRequests = Boolean(creationRequest.recordRequests);

        Object.keys(server.metadata).forEach(key => {
            result[key] = server.metadata[key];
        });

        result.requests = requests;
        result.stubs = server.stubs.stubs();

        for (let i = 0; i < result.stubs.length; i += 1) {
            result.stubs[i]._links = {
                self: { href: `${baseURL}/stubs/${i}` }
            };
        }
    }

    function removeNonEssentialInformationFrom (result) {
        result.stubs.forEach(stub => {
            /* eslint-disable no-underscore-dangle */
            if (stub.matches) {
                delete stub.matches;
            }
            stub.responses.forEach(response => {
                if (helpers.defined(response.is) && helpers.defined(response.is._proxyResponseTime)) {
                    delete response.is._proxyResponseTime;
                }
            });
            delete stub._links;
        });
        delete result.numberOfRequests;
        delete result.requests;
        delete result._links;
    }

    function removeProxiesFrom (result) {
        result.stubs.forEach(stub => {
            // eslint-disable-next-line no-prototype-builtins
            stub.responses = stub.responses.filter(response => !response.hasOwnProperty('proxy'));
        });
        result.stubs = result.stubs.filter(stub => stub.responses.length > 0);
    }

    function toJSON (numberOfRequests, options):any {
        // I consider the order of fields represented important.  They won't matter for parsing,
        // but it makes a nicer user experience for developers viewing the JSON to keep the most
        // relevant information at the top
        const result:any = {
                protocol: creationRequest.protocol,
                port: server.port,
                numberOfRequests: numberOfRequests
            },
            baseURL = `/imposters/${server.port}`;

        options = options || {};

        if (!options.list) {
            addDetailsTo(result, baseURL);
        }

        result._links = {
            self: { href: baseURL },
            stubs: { href: `${baseURL}/stubs` }
        };

        if (options.replayable) {
            removeNonEssentialInformationFrom(result);
        }
        if (options.removeProxies) {
            removeProxiesFrom(result);
        }

        return result;
    }

    return { toJSON };
}
