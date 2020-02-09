import { IServer, IServerRequestData } from '../IProtocol';
import * as helpers from '../../util/helpers';
import { IImposterPrintOptions, IImposter } from './IImposter';
import { IStub } from '../stubs/IStub';
import * as Q from 'q';


export class ImposterPrinter {
    constructor (private imposter: IImposter, private server: IServer, private requests: IServerRequestData[]) {

    }

    public toJSON (numberOfRequests: number, options?: IImposterPrintOptions): Q.Promise<any> {
        //I consider the order of fields represented important.  They won't matter for parsing,
        //but it makes a nicer user experience for developers viewing the JSON to keep the most
        //relevant information at the top
        const result: any = {
            protocol: this.imposter.protocol,
            port: this.server.port,
            numberOfRequests: numberOfRequests
        };
        const baseURL = `/imposters/${this.server.port}`;

        options = options || {};

        let loadData = Q.resolve();

        if (!options.list) {
            loadData = this.addDetailsTo(result, baseURL, options);
        }

        return loadData.then(() => {
            result._links = {
                self: { href: baseURL },
                stubs: { href: `${baseURL}/stubs` }
            };

            options = options || {};

            if (options.replayable) {
                this.removeNonEssentialInformationFrom(result);
            }
            if (options.removeProxies) {
                this.removeProxiesFrom(result);
            }

            return result;
        });
    }

    private addDetailsTo (result: any, baseURL: string, options?: IImposterPrintOptions): Q.Promise<void> {
        if (this.imposter.name) {
            result.name = this.imposter.name;
        }
        result.recordRequests = this.imposter.recordRequests;

        Object.keys(this.server.metadata).forEach(key => {
            result[key] = this.server.metadata[key];
        });

        result.requests = this.requests;


        return this.server.stubs.getJSON(options)
            .then(stubs => {
                result.stubs = stubs;
                for (let i = 0; i < result.stubs.length; i += 1) {
                    result.stubs[i]._links = {
                        self: { href: `${baseURL}/stubs/${i}` }
                    };
                }
            });
    }

    private removeNonEssentialInformationFrom (result: any) {
        result.stubs.forEach((stub: IStub) => {
            /*eslint-disable no-underscore-dangle */
            if ((stub as any).matches) {
                delete (stub as any).matches;
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

    private removeProxiesFrom (result: any) {
        result.stubs.forEach((stub: IStub) => {
            //eslint-disable-next-line no-prototype-builtins
            stub.responses = (stub.responses || []).filter(response => !response.hasOwnProperty('proxy'));
        });
        result.stubs = result.stubs.filter((stub: IStub) => (stub.responses || []).length > 0);
    }

}
