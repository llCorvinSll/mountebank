import { BehaviorsValidator } from './behaviorsValidator';
import * as Q from 'q';
import * as fs from 'fs';
import * as csvParse from 'csv-parse';
import { clone, defined, isObject } from '../../util/helpers';
import * as errors from '../../util/errors';
import { IMountebankResponse, IServerRequestData } from '../IProtocol';
import { ILogger } from '../../util/scopedLogger';
import {
    IBehaviorsConfig,
    ICopyDescriptor, ICsvConfig,
    ILookupDescriptor, ILookupInfokey, IUsingConfig,
    IUsingConfigOptions,
    IWaitDescriptor
} from './IBehaviorsConfig';
import { exec } from 'child_process';
import * as util from 'util';
import { IHashMap } from '../../util/types';
import * as xpath from '../xpath';
import * as jsonpath from '../jsonpath';
import { IMatch } from '../IRequest';

/**
 * The functionality behind the _behaviors field in the API, supporting post-processing responses
 * @module
 */

// The following schemas are used by both the lookup and copy behaviors and should be kept consistent
const fromSchema = {
    _required: true,
    _allowedTypes: {
        string: {},
        object: { singleKeyOnly: true }
    },
    _additionalContext: 'the request field to select from'
};
const intoSchema = {
    _required: true,
    _allowedTypes: { string: {} },
    _additionalContext: 'the token to replace in response fields'
};
const usingSchema = {
    _required: true,
    _allowedTypes: { object: {} },
    method: {
        _required: true,
        _allowedTypes: { string: { enum: ['regex', 'xpath', 'jsonpath'] } }
    },
    selector: {
        _required: true,
        _allowedTypes: { string: {} }
    }
};
const validations = {
    wait: {
        _required: true,
        _allowedTypes: { string: {}, number: { nonNegativeInteger: true } }
    },
    repeat: {
        _required: true,
        _allowedTypes: { number: { positiveInteger: true } }
    },
    copy: [{
        from: fromSchema,
        into: intoSchema,
        using: usingSchema
    }],
    lookup: [{
        key: {
            _required: true,
            _allowedTypes: { object: {} },
            from: fromSchema,
            using: usingSchema
        },
        fromDataSource: {
            _required: true,
            _allowedTypes: { object: { singleKeyOnly: true, enum: ['csv'] } },
            csv: {
                _required: false,
                _allowedTypes: { object: {} },
                path: {
                    _required: true,
                    _allowedTypes: { string: {} },
                    _additionalContext: 'the path to the CSV file'
                },
                delimiter: {
                    _required: false,
                    _allowedTypes: { string: {} },
                    _additionalContext: 'the delimiter separator values'
                },
                keyColumn: {
                    _required: true,
                    _allowedTypes: { string: {} },
                    _additionalContext: 'the column header to select against the "key" field'
                }
            }
        },
        into: intoSchema
    }],
    shellTransform: [{
        _required: true,
        _allowedTypes: { string: {} },
        _additionalContext: 'the path to a command line application'
    }],
    decorate: {
        _required: true,
        _allowedTypes: { string: {} },
        _additionalContext: 'a JavaScript function'
    }
};


type valueExtractor = (from: any, config: IUsingConfig | ICopyDescriptor | ILookupInfokey, logger: ILogger) => any

const fnMap: IHashMap<valueExtractor> = { regex: regexValue, xpath: xpathValue, jsonpath: jsonpathValue };

/**
 * Validates the behavior configuration and returns all errors
 * @param {Object} config - The behavior configuration
 * @returns {Object} The array of errors
 */
export function validate (config: IBehaviorsConfig) {
    const validator = new BehaviorsValidator();
    return validator.validate(config, validations);
}

/**
 * Waits a specified number of milliseconds before sending the response.  Due to the approximate
 * nature of the timer, there is no guarantee that it will wait the given amount, but it will be close.
 * @param {Object} request - The request object
 * @param {Object} responsePromise -kThe promise returning the response
 * @param {number} millisecondsOrFn - The number of milliseconds to wait before returning, or a function returning milliseconds
 * @param {Object} logger - The mountebank logger, useful for debugging
 * @returns {Object} A promise resolving to the response
 */
function wait (request: IServerRequestData, responsePromise: ResponsePromise, millisecondsOrFn: IWaitDescriptor, logger: ILogger) {
    if (request.isDryRun) {
        return responsePromise;
    }

    const fn = util.format('(%s)()', millisecondsOrFn);
    let milliseconds = parseInt(millisecondsOrFn as string);

    if (isNaN(milliseconds)) {
        try {
            milliseconds = eval(fn);
        }
        catch (error) {
            logger.error('injection X=> ' + error);
            logger.error('    full source: ' + JSON.stringify(fn));
            return Q.reject(errors.InjectionError('invalid wait injection',
                { source: millisecondsOrFn, data: error.message }));
        }
    }

    logger.debug('Waiting %s ms...', milliseconds);
    return responsePromise.delay(milliseconds);
}

function quoteForShell (obj: unknown) {
    const json = JSON.stringify(obj);
    const isWindows = require('os').platform().indexOf('win') === 0;

    if (isWindows) {
        // Confused? Me too. All other approaches I tried were spectacular failures
        // in both 1) keeping the JSON as a single CLI arg, and 2) maintaining the inner quotes
        return util.format('"%s"', json.replace(/"/g, '\\"'));
    }
    else {
        return util.format("'%s'", json);
    }
}

function execShell (command: string, request: IServerRequestData, response: IMountebankResponse, logger: ILogger): ResponsePromise {
    const deferred = Q.defer<IMountebankResponse>();
    const fullCommand = util.format('%s %s %s', command, quoteForShell(request), quoteForShell(response));
    const env = clone(process.env);
    logger.debug('Shelling out to %s', command);
    logger.debug(fullCommand);

    // Switched to environment variables because of inconsistencies in Windows shell quoting
    // Leaving the CLI args for backwards compatibility
    env.MB_REQUEST = JSON.stringify(request);
    env.MB_RESPONSE = JSON.stringify(response);

    exec(fullCommand, { env }, (error, stdout, stderr) => {
        if (error) {
            console.log('ERROR');
            console.log(error);
            if (stderr) {
                logger.error(stderr);
            }
            deferred.reject(error.message);
        }
        else {
            logger.debug("Shell returned '%s'", stdout);
            try {
                deferred.resolve(Q(JSON.parse(stdout)));
            }
            catch (err) {
                deferred.reject(util.format("Shell command returned invalid JSON: '%s'", stdout));
            }
        }
    });
    return deferred.promise;
}

/**
 * Runs the response through a shell function, passing the JSON in as stdin and using
 * stdout as the new response
 * @param {Object} request - Will be the first arg to the command
 * @param {Object} responsePromise - The promise chain for building the response, which will be the second arg
 * @param {string} commandArray - The list of shell commands to execute, in order
 * @param {Object} logger - The mountebank logger, useful in debugging
 * @returns {Object}
 */
function shellTransform (request: IServerRequestData, responsePromise: ResponsePromise, commandArray: string[], logger: ILogger) {
    if (request.isDryRun) {
        return responsePromise;
    }

    // Run them all in sequence
    let result = responsePromise;
    commandArray.forEach(function (command) {
        result = result.then(response => execShell(command, request, response, logger));
    });
    return result;
}

/**
 * Runs the response through a post-processing function provided by the user
 * @param {Object} originalRequest - The request object, in case post-processing depends on it
 * @param {Object} responsePromise - The promise returning the response
 * @param {Function} fn - The function that performs the post-processing
 * @param {Object} logger - The mountebank logger, useful in debugging
 * @returns {Object}
 */
function decorate (originalRequest: IServerRequestData, responsePromise: ResponsePromise, fn: string | object, logger: ILogger) {
    if (originalRequest.isDryRun === true) {
        return responsePromise;
    }

    return responsePromise.then(response => {
        const config = {
            request: clone(originalRequest),
            response,
            logger
        };
        const injected = `(${fn})(config, response, logger);`;
        const compatibility = require('../compatibility');

        compatibility.downcastInjectionConfig(config);

        try {
            // Support functions that mutate response in place and those
            // that return a new response
            let result = eval(injected);
            if (!result) {
                result = response;
            }
            return Q(result);
        }
        catch (error) {
            logger.error('injection X=> ' + error);
            logger.error('    full source: ' + JSON.stringify(injected));
            logger.error('    config: ' + JSON.stringify(config));
            return Q.reject(errors.InjectionError('invalid decorator injection', { source: injected, data: error.message }));
        }
    });
}

function getKeyIgnoringCase (obj: object, expectedKey: string): string {
    return Object.keys(obj).find(key => {
        if (key.toLowerCase() === expectedKey.toLowerCase()) {
            return key;
        }
        else {
            return undefined;
        }
    }) as string;
}

function getFrom (obj: IHashMap<IHashMap | any>, from: IHashMap<IHashMap | any> | string): any {
    if (typeof obj === 'undefined') {
        return undefined;
    }
    else if (isObject(from)) {
        const keys = Object.keys(from);
        const objElement = obj[keys[0]];
        const fromElement = (from as IHashMap)[keys[0]];
        return getFrom(objElement, fromElement);
    }
    else {
        const result = obj[getKeyIgnoringCase(obj, from as string)];

        // Some request fields, like query parameters, can be multi-valued
        if (Array.isArray(result)) {
            return result[0];
        }
        else {
            return result;
        }
    }
}

function regexFlags (options: IUsingConfigOptions): string {
    let result = '';
    if (options && options.ignoreCase) {
        result += 'i';
    }
    if (options && options.multiline) {
        result += 'm';
    }
    return result;
}

function getMatches (selectionFn: () => Array<any> | undefined, selector: string | RegExp, logger: ILogger): Array<IMatch> {
    const matches = selectionFn();

    if (matches && matches.length > 0) {
        return matches;
    }
    else {
        logger.debug('No match for "%s"', selector);
        return [];
    }
}

function regexValue (from: any, config: ILookupInfokey, logger: ILogger) {
    const regex = new RegExp(config.using.selector, regexFlags(config.using.options));
    const selectionFn: () => any[] = () => regex.exec(from) as any[];
    return getMatches(selectionFn, regex, logger);
}

function xpathValue (from: any, config: ILookupInfokey, logger: ILogger) {
    const selectionFn = () => xpath.select(config.using.selector, config.using.ns, from, logger);
    return getMatches(selectionFn, config.using.selector, logger);
}

function jsonpathValue (from: any, config: ILookupInfokey, logger: ILogger) {
    const selectionFn: () => any[] = () => jsonpath.select(config.using.selector, from, logger) as unknown as any[];
    return getMatches(selectionFn, config.using.selector, logger);
}

function globalStringReplace (str: string, substring: string, newSubstring: string, logger: ILogger) {
    if (substring !== newSubstring) {
        logger.debug('Replacing %s with %s', JSON.stringify(substring), JSON.stringify(newSubstring));
        return str.split(substring).join(newSubstring);
    }
    else {
        return str;
    }
}

function globalObjectReplace (obj: IHashMap|any, replacer: (v: any) => any) {
    Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'string') {
            obj[key] = replacer(obj[key]);
        }
        else if (isObject(obj[key])) {
            globalObjectReplace(obj[key], replacer);
        }
    });
}

function replaceArrayValuesIn (response: IMountebankResponse, token: string, values: any[], logger: ILogger) {
    const replacer = (field: string) => {
        values.forEach(function (replacement, index) {
            // replace ${TOKEN}[1] with indexed element
            const indexedToken = util.format('%s[%s]', token, index);
            field = globalStringReplace(field, indexedToken, replacement, logger);
        });
        if (values.length > 0) {
            // replace ${TOKEN} with first element
            field = globalStringReplace(field, token, values[0], logger);
        }
        return field;
    };

    globalObjectReplace(response, replacer);
}

/**
 * Copies a value from the request and replaces response tokens with that value
 * @param {Object} originalRequest - The request object, in case post-processing depends on it
 * @param {Object} responsePromise - The promise returning the response
 * @param {Function} copyArray - The list of values to copy
 * @param {Object} logger - The mountebank logger, useful in debugging
 * @returns {Object}
 */
function copy (originalRequest: IServerRequestData, responsePromise: ResponsePromise, copyArray: ICopyDescriptor[], logger: ILogger) {
    return responsePromise.then(response => {

        copyArray.forEach(function (copyConfig) {
            const from = getFrom(originalRequest, copyConfig.from);
            const using = copyConfig.using || {};
            const values = fnMap[using.method](from, copyConfig, logger);

            replaceArrayValuesIn(response, copyConfig.into as string, values, logger);
        });
        return Q(response);
    });
}

function containsKey (headers: IHashMap<string>, keyColumn: string) {
    const key = Object.values(headers).find(value => value === keyColumn);
    return defined(key);
}

function createRowObject (headers: IHashMap<string>, rowArray: string[]) {
    const row: IHashMap<string> = {};
    rowArray.forEach(function (value, index) {
        row[headers[index]] = value;
    });
    return row;
}

function selectRowFromCSV (csvConfig: ICsvConfig, keyValue: string, logger: ILogger) {
    const delimiter = csvConfig.delimiter || ',';
    const inputStream = fs.createReadStream(csvConfig.path);
    const parser = csvParse({ delimiter: delimiter });
    const pipe = inputStream.pipe(parser);
    const deferred = Q.defer();
    let headers: any;

    inputStream.on('error', (e: any) => {
        logger.error('Cannot read ' + csvConfig.path + ': ' + e);
        deferred.resolve({});
    });

    pipe.on('data', function (rowArray: string[]) {
        if (!defined(headers)) {
            headers = rowArray;
            const keyOnHeader = containsKey(headers, csvConfig.keyColumn);
            if (!keyOnHeader) {
                logger.error('CSV headers "' + headers + '" with delimiter "' + delimiter + '" does not contain keyColumn:"' + csvConfig.keyColumn + '"');
                deferred.resolve({});
            }
        }
        else {
            const row = createRowObject(headers, rowArray);
            if (defined(row[csvConfig.keyColumn]) && row[csvConfig.keyColumn].localeCompare(keyValue) === 0) {
                deferred.resolve(row);
            }
        }
    });

    pipe.on('error', (e: any) => {
        logger.debug('Error: ' + e);
        deferred.resolve({});
    });

    pipe.on('end', () => {
        deferred.resolve({});
    });

    return deferred.promise;
}

function lookupRow (lookupConfig: ILookupDescriptor, originalRequest: any, logger: ILogger) {
    const from = getFrom(originalRequest, lookupConfig.key.from);
    const keyValues = fnMap[lookupConfig.key.using.method](from, lookupConfig.key, logger);
    const index = lookupConfig.key.index || 0;

    if (lookupConfig.fromDataSource.csv) {
        return selectRowFromCSV(lookupConfig.fromDataSource.csv, keyValues[index], logger);
    }
    else {
        return Q({});
    }
}

function replaceObjectValuesIn (response: any, token: string, values: IHashMap<string>, logger: ILogger) {
    const replacer = (field: string) => {
        Object.keys(values).forEach(key => {
            // replace ${TOKEN}["key"] and ${TOKEN}['key'] and ${TOKEN}[key]
            ['"', "'", ''].forEach(function (quoteChar) {
                const quoted = util.format('%s[%s%s%s]', token, quoteChar, key, quoteChar);
                field = globalStringReplace(field, quoted, values[key], logger);
            });
        });
        return field;
    };

    globalObjectReplace(response, replacer);
}


/**
 * Looks up request values from a data source and replaces response tokens with the resulting data
 * @param {Object} originalRequest - The request object
 * @param {Object} responsePromise - The promise returning the response
 * @param {Function} lookupArray - The list of lookup configurations
 * @param {Object} logger - The mountebank logger, useful in debugging
 * @returns {Object}
 */
function lookup (originalRequest: IServerRequestData, responsePromise: ResponsePromise, lookupArray: ILookupDescriptor[], logger: ILogger) {
    return responsePromise.then(response => {
        const lookupPromises = lookupArray.map(function (lookupConfig) {
            return lookupRow(lookupConfig, originalRequest, logger).then(function (row: IHashMap<string>) {
                replaceObjectValuesIn(response, lookupConfig.into, row, logger);
            });
        });
        return Q.all(lookupPromises).then(() => Q(response));
    }).catch(error => {
        logger.error(error);
    });
}

type ResponsePromise = Q.Promise<IMountebankResponse>;

/**
 * The entry point to execute all behaviors provided in the API
 * @param {Object} request - The request object
 * @param {Object} response - The response generated from the stubs
 * @param {Object} behaviors - The behaviors specified in the API
 * @param {Object} logger - The mountebank logger, useful for debugging
 * @returns {Object}
 */
export function execute (request: IServerRequestData, response: IMountebankResponse, behaviors: IBehaviorsConfig | undefined, logger: ILogger): ResponsePromise {
    if (!behaviors) {
        return Q(response);
    }

    const combinators = require('../../util/combinators');
    const waitFn = behaviors.wait ?
        (result: ResponsePromise) => wait(request, result, behaviors.wait!, logger) :
        combinators.identity;
    const copyFn = behaviors.copy ?
        (result: ResponsePromise) => copy(request, result, behaviors.copy!, logger) :
        combinators.identity;
    const lookupFn = behaviors.lookup ?
        (result: ResponsePromise) => lookup(request, result, behaviors.lookup!, logger) :
        combinators.identity;
    const shellTransformFn = behaviors.shellTransform ?
        (result: ResponsePromise) => shellTransform(request, result, behaviors.shellTransform!, logger) :
        combinators.identity;
    const decorateFn = behaviors.decorate ?
        (result: ResponsePromise) => decorate(request, result, behaviors.decorate!, logger) :
        combinators.identity;

    logger.debug('using stub response behavior ' + JSON.stringify(behaviors));

    return combinators.compose(decorateFn, shellTransformFn, copyFn, lookupFn, waitFn, Q)(response);
}
