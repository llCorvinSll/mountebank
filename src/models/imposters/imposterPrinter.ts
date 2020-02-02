'use strict';

import {IServer, IServerRequestData} from "../IProtocol";
import * as helpers from '../../util/helpers';
import {IImposterConfig, ImposterPrintOptions} from "./IImposter";
import {IStub} from "../stubs/IStub";


export class ImposterPrinter {
    constructor(private creationRequest:IImposterConfig, private server:IServer, private requests:IServerRequestData[]) {

    }

    public toJSON (numberOfRequests:number, options:ImposterPrintOptions):any {
        // I consider the order of fields represented important.  They won't matter for parsing,
        // but it makes a nicer user experience for developers viewing the JSON to keep the most
        // relevant information at the top
        const result:any = {
                protocol: this.creationRequest.protocol,
                port: this.server.port,
                numberOfRequests: numberOfRequests
            },
            baseURL = `/imposters/${this.server.port}`;

        options = options || {};

        if (!options.list) {
            this.addDetailsTo(result, baseURL);
        }

        result._links = {
            self: { href: baseURL },
            stubs: { href: `${baseURL}/stubs` }
        };

        if (options.replayable) {
            this.removeNonEssentialInformationFrom(result);
        }
        if (options.removeProxies) {
            this.removeProxiesFrom(result);
        }

        return result;
    }

    private addDetailsTo (result:any, baseURL:string) {
        if (this.creationRequest.name) {
            result.name = this.creationRequest.name;
        }
        result.recordRequests = Boolean(this.creationRequest.recordRequests);

        Object.keys(this.server.metadata).forEach(key => {
            result[key] = this.server.metadata[key];
        });

        result.requests = this.requests;
        result.stubs = this.server.stubs.stubs().map((stub) => {
            return JSON.parse(JSON.stringify(stub));
        });

        for (let i = 0; i < result.stubs.length; i += 1) {
            result.stubs[i]._links = {
                self: { href: `${baseURL}/stubs/${i}` }
            };
        }
    }

    private removeNonEssentialInformationFrom (result:any) {
        result.stubs.forEach((stub:IStub) => {
            /* eslint-disable no-underscore-dangle */
            if (stub.matches) {
                delete stub.matches;
            }

            delete stub.uuid;
            delete (stub as any)._uuid;

            (stub.responses || []).forEach(response => {
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

    private removeProxiesFrom (result:any) {
        result.stubs.forEach((stub:IStub) => {
            // eslint-disable-next-line no-prototype-builtins
            stub.responses = (stub.responses || []).filter(response => !response.hasOwnProperty('proxy'));
        });
        result.stubs = result.stubs.filter((stub:IStub) => (stub.responses || []).length > 0);
    }

}
