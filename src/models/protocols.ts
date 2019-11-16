'use strict';

import * as Q from "q";
import {ILogger} from "../util/scopedLogger";
import {
    IProtocolFactory,
    IServer,
    IServerCreationOptions,
    ServerCreatorFunction,
    ServerImplCreatorFunction
} from "./IProtocol";
import {IImposterConfig, IpValidator} from "./IImposter";
import {Imposter} from "./imposter";
import {ResponseResolver} from "./responseResolver";
import {StubRepository} from "./stubs/stubRepository";


export interface IProtocolLoadOptions {
    callbackURLTemplate: string;
    loglevel: string;
    allowInjection: boolean;
    host: string;
    recordRequests: boolean;
    recordMatches: unknown;
}

interface IProtocolMap {
    [key: string]: IProtocolFactory;
}


export function load (
    builtInProtocols: IProtocolMap,
    customProtocols: IProtocolMap,
    options:IProtocolLoadOptions,
    isAllowedConnection: IpValidator,
    mbLogger: ILogger): {[key: string]: IProtocolFactory} {
    function inProcessCreate (createProtocol: ServerImplCreatorFunction): ServerCreatorFunction {
        return (creationRequest, logger: ILogger, responseFn) =>
            createProtocol(creationRequest, logger, responseFn).then(server => {
                const stubs = new StubRepository(server.encoding || 'utf8'),
                    resolver = new ResponseResolver(stubs, server.proxy);

                return Q({
                    port: server.port,
                    metadata: server.metadata,
                    stubs: stubs,
                    resolver: resolver,
                    close: server.close
                });
            });
    }

    function outOfProcessCreate (protocolName: string, config: any): ServerCreatorFunction {
        function customFieldsFor (creationRequest: IServerCreationOptions): any {
            const result: any = {},
                commonFields = ['protocol', 'port', 'name', 'recordRequests', 'stubs', 'defaultResponse'];
            Object.keys(creationRequest).forEach(key => {
                if (commonFields.indexOf(key) < 0) {
                    result[key] = creationRequest[key];
                }
            });
            return result;
        }

        return (creationRequest: IServerCreationOptions, logger: ILogger) => {
            const deferred = Q.defer<IServer>(),
                { spawn } = require('child_process'),
                command = config.createCommand.split(' ')[0],
                args = config.createCommand.split(' ').splice(1),
                port = creationRequest.port,
                commonArgs = {
                    port,
                    callbackURLTemplate: options.callbackURLTemplate,
                    loglevel: options.loglevel,
                    allowInjection: options.allowInjection
                },
                configArgs = require('../util/helpers').merge(commonArgs, customFieldsFor(creationRequest));

            if (typeof creationRequest.defaultResponse !== 'undefined') {
                configArgs.defaultResponse = creationRequest.defaultResponse;
            }

            const allArgs = args.concat(JSON.stringify(configArgs)),
                imposterProcess = spawn(command, allArgs);

            let closeCalled = false;

            imposterProcess.on('error', (error:any) => {
                const errors = require('../util/errors'),
                    message = `Invalid configuration for protocol "${protocolName}": cannot run "${config.createCommand}"`;
                deferred.reject(errors.ProtocolError(message,
                    { source: config.createCommand, details: error }));
            });

            imposterProcess.once('exit', (code: number) => {
                if (code !== 0 && deferred.promise.isPending()) {
                    const errors = require('../util/errors'),
                        message = `"${protocolName}" start command failed (exit code ${code})`;
                    deferred.reject(errors.ProtocolError(message, { source: config.createCommand }));
                }
                else if (!closeCalled) {
                    logger.error("Uh oh! I've crashed! Expect subsequent requests to fail.");
                }
            });

            function resolveWithMetadata (possibleJSON: string) {
                let metadata: any = {};

                try {
                    metadata = JSON.parse(possibleJSON);
                }
                catch (error) { /* do nothing */ }

                let serverPort: number = creationRequest.port;
                if (metadata.port) {
                    serverPort = metadata.port;
                    delete metadata.port;
                }
                const callbackURL = options.callbackURLTemplate.replace(':port', String(serverPort)),
                    encoding = metadata.encoding || 'utf8';

                const stubs = new StubRepository(encoding),
                    resolver = new ResponseResolver(stubs, undefined, callbackURL);

                delete metadata.encoding;

                deferred.resolve({
                    port: serverPort,
                    metadata: metadata,
                    stubs,
                    resolver,
                    close: callback => {
                        closeCalled = true;
                        imposterProcess.once('exit', callback);
                        imposterProcess.kill();
                    }
                });
            }

            function log (message: string) {
                if (message.indexOf(' ') > 0) {
                    const words = message.split(' '),
                        level = words[0],
                        rest = words.splice(1).join(' ').trim();
                    if (['debug', 'info', 'warn', 'error'].indexOf(level) >= 0) {
                        logger[level](rest);
                    }
                }
            }

            imposterProcess.stdout.on('data', (data: any) => {
                const lines: string[] = data.toString('utf8').trim().split('\n');
                lines.forEach(line => {
                    if (deferred.promise.isPending()) {
                        resolveWithMetadata(line);
                    }
                    log(line);
                });
            });

            imposterProcess.stderr.on('data', logger.error);

            return deferred.promise;
        };
    }

    function createImposter (Protocol: IProtocolFactory, creationRequest: IImposterConfig) {
        return new Imposter(Protocol, creationRequest, mbLogger.baseLogger, options, isAllowedConnection).init();
    }

    const result: {[key: string]: IProtocolFactory} = {};
    Object.keys(builtInProtocols).forEach(key => {
        result[key] = builtInProtocols[key];
        result[key].createServer = inProcessCreate(result[key].create);
        result[key].createImposterFrom = (creationRequest: any) => createImposter(result[key], creationRequest);
    });
    Object.keys(customProtocols).forEach(key => {
        result[key] = customProtocols[key];
        result[key].createServer = outOfProcessCreate(key, result[key]);
        result[key].createImposterFrom = (creationRequest: any) => createImposter(result[key], creationRequest);
    });
    return result;
}
