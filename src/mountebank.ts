import * as Q from 'q';
import * as express from 'express';
import { IMountebankOptions } from './models/IMountebankOptions';
import { ILogger } from './util/scopedLogger';
import * as path from 'path';
import * as cors from 'cors';
import * as errorHandler from 'errorhandler';
import * as middleware from './util/middleware';
import * as helpers from './util/helpers';
import * as fs from 'fs';
import * as winston from 'winston';
import { NetworkInterfaceInfo } from 'os';
import { Socket } from 'net';
import { IProtocolLoadOptions } from './models/protocols';
import { IpValidator } from './models/imposters/IImposter';
import { IProtocolFactory } from './models/IProtocol';
import { ImpostersController } from './controllers/impostersController';
import { ImposterController } from './controllers/imposterController';
import { StorageCreator, IStorageConfig } from './models/storage/StorageCreator';
const thisPackage = require('../package.json');
const releases = require('../releases.json');

/**
 * The entry point for mountebank.  This module creates the mountebank server,
 * configures all middleware, starts the logger, and manages all routing
 * @module
 */

function initializeLogfile (filename: string) {
    //Ensure new logfile on startup so the /logs only shows for this process
    const extension = path.extname(filename);
    const pattern = new RegExp(`${extension}$`);
    const newFilename = filename.replace(pattern, `1${extension}`);

    if (fs.existsSync(filename)) {
        fs.renameSync(filename, newFilename);
    }
}

function createLogger (options: IMountebankOptions) {
    const format = winston.format;
    const consoleFormat = format.printf(info => `${info.level}: ${info.message}`);
    const winstonLogger = winston.createLogger({
        level: options.loglevel,
        transports: [new winston.transports.Console({
            format: format.combine(format.colorize(), consoleFormat)
        })]
    });
    const ScopedLogger = require('./util/scopedLogger');
    const logger = ScopedLogger.create(winstonLogger, `[mb:${options.port}] `);

    if (!options.nologfile) {
        initializeLogfile(options.logfile);
        winstonLogger.add(new winston.transports.File({
            filename: options.logfile,
            maxsize: 20 * 1024 * 1024,
            maxFiles: 5,
            tailable: true,
            format: format.combine(format.timestamp(), format.json())
        }));
    }

    return logger;
}

function getLocalIPs () {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    const result: string[] = [];

    Object.keys(interfaces).forEach(name => {
        interfaces[name].forEach((ip: NetworkInterfaceInfo) => {
            if (ip.internal) {
                result.push(ip.address);
                if (ip.family === 'IPv4') {
                    //Prefix for IPv4 address mapped to a compliant IPv6 scheme
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
        options.ipWhitelist.forEach((ip: string) => { allowedIPs.push(ip.toLowerCase()); });
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

function isBuiltInProtocol (protocol: string): boolean {
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

function loadProtocols (options: IMountebankOptions, baseURL: string, storageCreator: StorageCreator, logger: ILogger, isAllowedConnection: IpValidator): {[key: string]: IProtocolFactory} {
    const builtInProtocols = {
        tcp: require('./models/tcp/tcpServer'),
        http: require('./models/http/httpServer'),
        https: require('./models/https/httpsServer'),
        smtp: require('./models/smtp/smtpServer')
    };
    const customProtocols = loadCustomProtocols(options.protofile, logger);
    const config: IProtocolLoadOptions = {
        callbackURLTemplate: `${baseURL}/imposters/:port/_requests`,
        recordRequests: options.mock,
        recordMatches: options.debug,
        loglevel: options.loglevel,
        allowInjection: options.allowInjection,
        host: options.host
    };

    return require('./models/protocols').load(builtInProtocols, customProtocols, config, storageCreator, isAllowedConnection, logger);
}

/**
 * Creates the mountebank server
 * @param {object} options - The command line options
 * @returns {Object} An object with a close method to stop the server
 */
export function create (options: IMountebankOptions) {
    const deferred = Q.defer();
    const app = express();
    const imposters = options.imposters || {};
    const hostname = options.host || 'localhost';
    const baseURL = `http://${hostname}:${options.port}`;
    const logger = createLogger(options);
    const isAllowedConnection = createIPVerification(options);

    let storageConfig:IStorageConfig = {};

    if (options.storageConfig) {

        const contents = fs.readFileSync(options.storageConfig, 'utf8');
        storageConfig = JSON.parse(contents);
    }

    const storageCreator = new StorageCreator(storageConfig);

    const protocols = loadProtocols(options, baseURL, storageCreator, logger, isAllowedConnection);
    const impostersController = new ImpostersController(
        protocols, imposters, storageCreator, logger, options.allowInjection);
    const imposterController = new ImposterController(
        protocols, imposters, storageCreator, logger, options.allowInjection);
    const validateImposterExists = middleware.createImposterValidator(imposters);

    const homeController = require('./controllers/homeController').create(releases);
    const logsController = require('./controllers/logsController').create(options.logfile);
    const configController = require('./controllers/configController').create(thisPackage.version, options);
    const feedController = require('./controllers/feedController').create(releases, options);

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
    app.delete('/imposters/:id/requests', validateImposterExists, imposterController.resetProxies); //deprecated but saved for backwards compatibility

    //Changing stubs without restarting imposter
    app.put('/imposters/:id/stubs', validateImposterExists, imposterController.putStubs);
    app.put('/imposters/:id/stubs/:stubIndex', validateImposterExists, imposterController.putStub);
    app.post('/imposters/:id/stubs', validateImposterExists, imposterController.postStub);
    app.delete('/imposters/:id/stubs/:stubIndex', validateImposterExists, imposterController.deleteStub);
    app.delete('/imposters/:id/stubs/by_uuid/:uuid', validateImposterExists, imposterController.deleteStubByUuid);

    //Protocol implementation APIs
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

    const connections: { [key: string]: Socket } = {};
    const server = app.listen(parseInt(options.port), options.host, () => {
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
            const name = helpers.socketName(socket);
            const ipAddress = socket.remoteAddress;
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

                //Force kill any open connections to prevent process hanging
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
