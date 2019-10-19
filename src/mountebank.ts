'use strict';

import  * as Q from "q";
import * as express from "express";
import {IMountebankOptions} from "./models/IMountebankOptions";
import {ILogger} from "./util/scopedLogger";
import path from 'path';
import cors from 'cors';
import errorHandler from 'errorhandler';
import * as middleware from './util/middleware';
import thisPackage from "../package.json";
import releases from "../releases.json";
import * as helpers from './util/helpers';
import fs from "fs";
import winston from "winston";
import {NetworkInterfaceInfo} from "os";
import {Socket} from "net";
import {IProtocolLoadOptions} from "./models/protocols";
import {IpValidator} from "./models/IImposter";
import {IProtocolFactory} from "./models/IProtocol";

/**
 * The entry point for mountebank.  This module creates the mountebank server,
 * configures all middleware, starts the logger, and manages all routing
 * @module
 */

function initializeLogfile (filename: string) {
    // Ensure new logfile on startup so the /logs only shows for this process
    const extension = path.extname(filename),
        pattern = new RegExp(`${extension}$`),
        newFilename = filename.replace(pattern, `1${extension}`);

    if (fs.existsSync(filename)) {
        fs.renameSync(filename, newFilename);
    }
}

function createLogger (options: IMountebankOptions) {
    const format = winston.format,
        consoleFormat = format.printf(info => `${info.level}: ${info.message}`),
        winstonLogger = winston.createLogger({
            level: options.loglevel,
            transports: [new winston.transports.Console({
                format: format.combine(format.colorize(), consoleFormat)
            })]
        }),
        ScopedLogger = require('./util/scopedLogger'),
        logger = ScopedLogger.create(winstonLogger, `[mb:${options.port}] `);

    if (!options.nologfile) {
        initializeLogfile(options.logfile);
        winstonLogger.add(new winston.transports.File({
            filename: options.logfile,
            maxsize: 4096,
            maxFiles: 5,
            tailable: true,
            format: format.combine(format.timestamp(), format.json())
        }));
    }

    return logger;
}

function getLocalIPs () {
    const os = require('os'),
        interfaces = os.networkInterfaces(),
        result: string[] = [];

    Object.keys(interfaces).forEach(name => {
        interfaces[name].forEach((ip:NetworkInterfaceInfo) => {
            if (ip.internal) {
                result.push(ip.address);
                if (ip.family === 'IPv4') {
                    // Prefix for IPv4 address mapped to a compliant IPv6 scheme
                    result.push(`::ffff:${ip.address}`);
                }
            }
        });
    });
    return result;
}

function createIPVerification (options: IMountebankOptions): IpValidator {
    const allowedIPs = getLocalIPs();

    if (!options.localOnly) {
        options.ipWhitelist.forEach((ip:string) => { allowedIPs.push(ip.toLowerCase()); });
    }

    if (allowedIPs.indexOf('*') >= 0) {
        return () => true;
    }
    else {
        return (ip: string | undefined, logger: ILogger) => {
            if (typeof ip === 'undefined') {
                logger.error('Blocking request because no IP address provided. This is likely a bug in the protocol implementation.');
                return false;
            }
            else {
                const allowed = allowedIPs.some(allowedIP => allowedIP === ip.toLowerCase());
                if (!allowed) {
                    logger.warn(`Blocking incoming connection from ${ip}. Turn off --localOnly or add to --ipWhitelist to allow`);
                }
                return allowed;
            }
        };
    }
}

function isBuiltInProtocol (protocol: string):boolean {
    return ['tcp', 'smtp', 'http', 'https'].indexOf(protocol) >= 0;
}

function loadCustomProtocols (protofile: string, logger: ILogger) {
    const filename = path.join(process.cwd(), protofile);

    if (fs.existsSync(filename)) {
        try {
            const customProtocols = require(filename);
            Object.keys(customProtocols).forEach(proto => {
                if (isBuiltInProtocol(proto)) {
                    logger.warn(`Using custom ${proto} implementation instead of the built-in one`);
                }
                else {
                    logger.info(`Loaded custom protocol ${proto}`);
                }
            });
            return customProtocols;
        }
        catch (e) {
            logger.error(`${protofile} contains invalid JSON -- no custom protocols loaded`);
            return {};
        }
    }
    else {
        return {};
    }
}

function loadProtocols (options: IMountebankOptions, baseURL: string, logger: ILogger, isAllowedConnection: IpValidator): {[key: string]: IProtocolFactory} {
    const builtInProtocols = {
            tcp: require('./models/tcp/tcpServer'),
            http: require('./models/http/httpServer'),
            https: require('./models/https/httpsServer'),
            smtp: require('./models/smtp/smtpServer')
        },
        customProtocols = loadCustomProtocols(options.protofile, logger),
        config: IProtocolLoadOptions = {
            callbackURLTemplate: `${baseURL}/imposters/:port/_requests`,
            recordRequests: options.mock,
            recordMatches: options.debug,
            loglevel: options.loglevel,
            allowInjection: options.allowInjection,
            host: options.host
        };

    return require('./models/protocols').load(builtInProtocols, customProtocols, config, isAllowedConnection, logger);
}

/**
 * Creates the mountebank server
 * @param {object} options - The command line options
 * @returns {Object} An object with a close method to stop the server
 */
export function create (options: IMountebankOptions) {
    const deferred = Q.defer(),
        app = express(),
        imposters = options.imposters || {},
        hostname = options.host || 'localhost',
        baseURL = `http://${hostname}:${options.port}`,
        logger = createLogger(options),
        isAllowedConnection = createIPVerification(options),
        protocols = loadProtocols(options, baseURL, logger, isAllowedConnection),
        homeController = require('./controllers/homeController').create(releases),
        impostersController = require('./controllers/impostersController').create(
            protocols, imposters, logger, options.allowInjection),
        imposterController = require('./controllers/imposterController').create(
            protocols, imposters, logger, options.allowInjection),
        logsController = require('./controllers/logsController').create(options.logfile),
        configController = require('./controllers/configController').create(thisPackage.version, options),
        feedController = require('./controllers/feedController').create(releases, options),
        validateImposterExists = middleware.createImposterValidator(imposters);

    app.use(middleware.useAbsoluteUrls(options.port));
    app.use(middleware.logger(logger, ':method :url'));
    app.use(middleware.globals({ heroku: options.heroku, port: options.port, version: thisPackage.version }));
    app.use(middleware.defaultIEtoHTML);
    app.use(middleware.json(logger));
    app.use(express.static(path.join(__dirname, 'public')));
    app.use(express.static(path.join(__dirname, '../node_modules')));
    app.use(errorHandler());
    app.use(cors());

    app.disable('etag');
    app.disable('x-powered-by');
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'ejs');
    app.set('json spaces', 2);

    app.get('/', homeController.get);
    app.get('/imposters', impostersController.get);
    app.post('/imposters', impostersController.post);
    app.delete('/imposters', impostersController.del);
    app.put('/imposters', impostersController.put);
    app.get('/imposters/:id', validateImposterExists, imposterController.get);
    app.delete('/imposters/:id', imposterController.del);
    app.delete('/imposters/:id/savedProxyResponses', validateImposterExists, imposterController.resetProxies);
    app.delete('/imposters/:id/requests', validateImposterExists, imposterController.resetProxies); // deprecated but saved for backwards compatibility

    // Changing stubs without restarting imposter
    app.put('/imposters/:id/stubs', validateImposterExists, imposterController.putStubs);
    app.put('/imposters/:id/stubs/:stubIndex', validateImposterExists, imposterController.putStub);
    app.post('/imposters/:id/stubs', validateImposterExists, imposterController.postStub);
    app.delete('/imposters/:id/stubs/:stubIndex', validateImposterExists, imposterController.deleteStub);

    // Protocol implementation APIs
    app.post('/imposters/:id/_requests', validateImposterExists, imposterController.postRequest);
    app.post('/imposters/:id/_requests/:proxyResolutionKey', validateImposterExists, imposterController.postProxyResponse);

    app.get('/logs', logsController.get);
    app.get('/config', configController.get);
    app.get('/feed', feedController.getFeed);
    app.get('/releases', feedController.getReleases);
    app.get('/releases/:version', feedController.getRelease);

    app.get('/sitemap', (request, response) => {
        response.type('text/plain');
        response.render('sitemap', { releases: releases });
    });

    [
        '/support',
        '/license',
        '/faqs',
        '/thoughtworks',
        '/docs/gettingStarted',
        '/docs/install',
        '/docs/mentalModel',
        '/docs/commandLine',
        '/docs/clientLibraries',
        '/docs/security',
        '/docs/api/overview',
        '/docs/api/contracts',
        '/docs/api/mocks',
        '/docs/api/stubs',
        '/docs/api/predicates',
        '/docs/api/xpath',
        '/docs/api/json',
        '/docs/api/jsonpath',
        '/docs/api/proxies',
        '/docs/api/injection',
        '/docs/api/behaviors',
        '/docs/api/errors',
        '/docs/protocols/http',
        '/docs/protocols/https',
        '/docs/protocols/tcp',
        '/docs/protocols/smtp',
        '/docs/protocols/custom'
    ].forEach(endpoint => {
        app.get(endpoint, (request, response) => {
            response.render(endpoint.substring(1));
        });
    });

    const connections: { [key: string]:Socket } = {},
        server = app.listen(parseInt(options.port), options.host, () => {
            logger.info(`mountebank v${thisPackage.version} now taking orders - point your browser to ${baseURL}/ for help`);
            logger.debug(`config: ${JSON.stringify({
                options: options,
                process: {
                    nodeVersion: process.version,
                    architecture: process.arch,
                    platform: process.platform
                }
            })}`);
            if (options.allowInjection) {
                logger.warn(`Running with --allowInjection set. See ${baseURL}/docs/security for security info`);
            }

            server.on('connection', socket => {
                const name = helpers.socketName(socket),
                    ipAddress = socket.remoteAddress;
                connections[name] = socket;

                socket.on('close', () => {
                    delete connections[name];
                });

                socket.on('error', error => {
                    logger.error('%s transmission error X=> %s', name, JSON.stringify(error));
                });

                if (!isAllowedConnection(ipAddress, logger)) {
                    socket.end();
                }
            });

            deferred.resolve({
                close: (callback: () => void) => {
                    server.close(() => {
                        logger.info('Adios - see you soon?');
                        callback();
                    });

                    // Force kill any open connections to prevent process hanging
                    Object.keys(connections).forEach(socket => {
                        connections[socket].destroy();
                    });
                }
            });
        });

    process.once('exit', () => {
        Object.keys(imposters).forEach(port => {
            imposters[port].stop();
        });
    });

    return deferred.promise;
}