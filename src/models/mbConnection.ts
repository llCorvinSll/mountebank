'use strict';

import {ILogger} from "../util/scopedLogger";
import * as Q from "q";
import {IProxyImplementation} from "./IProtocol";
import {IProxyConfig} from "./IStubConfig";
import {IRequest, IResponse} from "./IRequest";
import {IncomingMessage, RequestOptions} from "http";

/**
 * Helper functions to navigate the mountebank API for out of process implementations.
 * Used to adapt the built-in (in-process) protocols to out of process.
 * @module
 */

function createLogger (loglevel: string): ILogger {
    const result: ILogger = {} as any,
        levels = ['debug', 'info', 'warn', 'error'];

    levels.forEach((level, index) => {
        if (index < levels.indexOf(loglevel)) {
            result[level] = () => {};
        }
        else {
            result[level] = function () {
                const args = Array.prototype.slice.call(arguments),
                    message = require('util').format.apply(this, args);

                console.log(`${level} ${message}`);
            };
        }
    });
    return result;
}

function postJSON (what: object, where: string):Q.Promise<any> {
    const deferred = Q.defer(),
        url = require('url'),
        parts = url.parse(where),
        driver = require(parts.protocol.replace(':', '')), // http or https
        options:RequestOptions = {
            hostname: parts.hostname,
            port: parts.port,
            path: parts.pathname,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        },
        request = driver.request(options, (response:IncomingMessage) => {
            const packets: any[] = [];

            response.on('data', chunk => packets.push(chunk));

            response.on('end', () => {
                const buffer = Buffer.concat(packets),
                    body = buffer.toString('utf8');

                if (response.statusCode !== 200) {
                    deferred.reject(require('../../util/errors').CommunicationError({
                        statusCode: response.statusCode,
                        body: body
                    }));
                }
                else {
                    deferred.resolve(JSON.parse(body));
                }
            });
        });

    request.on('error', deferred.reject);
    request.write(JSON.stringify(what));
    request.end();
    return deferred.promise;
}


export interface IMbConnection {
    getResponse(request: IRequest, requestDetails: unknown):Q.Promise<IResponse>;
    setPort(port: string): void;
    setProxy(value: IProxyImplementation): void;
    logger():ILogger;
}

interface IMbConnectionConfig {
    callbackURLTemplate: string;
    loglevel: string;
}

export function create (config: IMbConnectionConfig): IMbConnection {
    let callbackURL: string,
        proxy: IProxyImplementation;

    function setPort (port: string):void {
        callbackURL = config.callbackURLTemplate.replace(':port', port);
    }

    function setProxy (value: IProxyImplementation) {
        proxy = value;
    }

    function logger () {
        return createLogger(config.loglevel);
    }

    function getProxyResponse (proxyConfig: IProxyConfig, request: IRequest, proxyCallbackURL: string): Q.Promise<IResponse> {
        return proxy.to(proxyConfig.to, request, proxyConfig)
            .then((response:IResponse) => postJSON({ proxyResponse: response }, proxyCallbackURL));
    }

    function getResponse (request: IRequest, requestDetails: unknown) {
        return postJSON({ request, requestDetails }, callbackURL).then(mbResponse => {
            if (mbResponse.proxy) {
                return getProxyResponse(mbResponse.proxy, mbResponse.request, mbResponse.callbackURL);
            }
            else if (mbResponse.response) {
                return Q(mbResponse.response);
            }
            else {
                return Q(mbResponse);
            }
        });
    }

    return {
        getResponse,
        setPort,
        setProxy,
        logger
    };
}
