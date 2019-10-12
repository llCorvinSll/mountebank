'use strict';

import {IRequest, IResponse, IBehaviors, ICopyDescriptor, ILookupDescriptor} from "./IRequest";
import {ILogger} from "../util/scopedLogger";
import * as Q from "q";
import {IValidationMap} from "./behaviorsValidator";
import {exec} from "child_process";

/**
 * The functionality behind the _behaviors field in the API, supporting post-processing responses
 * @module
 */

// The following schemas are used by both the lookup and copy behaviors and should be kept consistent
const fromSchema: IValidationMap = {
        _required: true,
        _allowedTypes: {
            string: {},
            object: { singleKeyOnly: true }
        },
        _additionalContext: 'the request field to select from'
    };

const intoSchema: IValidationMap = {
        _required: true,
        _allowedTypes: { string: {} },
        _additionalContext: 'the token to replace in response fields'
    };

const usingSchema: IValidationMap = {
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

const VALIDATIONS: IValidationMap = {
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

/**
 * Validates the behavior configuration and returns all errors
 * @param {Object} config - The behavior configuration
 * @returns {Object} The array of errors
 */
export function validate (config) {
    const validator = require('./behaviorsValidator').create();
    return validator.validate(config, VALIDATIONS);
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
function wait (request: IRequest, responsePromise: Q.Promise<IResponse>, millisecondsOrFn: (() => number) | string, logger: ILogger): Q.Promise<IResponse> {
    if (request.isDryRun) {
        return responsePromise;
    }

    const util = require('util');
    const fn = util.format('(%s)()', millisecondsOrFn);
    const exceptions = require('../util/errors');
    let milliseconds = parseInt(millisecondsOrFn as string);

    if (isNaN(milliseconds)) {
        try {
            milliseconds = eval(fn);
        }
        catch (error) {
            logger.error('injection X=> ' + error);
            logger.error('    full source: ' + JSON.stringify(fn));
            return Q.reject(exceptions.InjectionError('invalid wait injection',
                { source: millisecondsOrFn, data: error.message }));
        }
    }

    logger.debug('Waiting %s ms...', milliseconds);
    return responsePromise.delay(milliseconds);
}

function quoteForShell (obj: object): string {
    const json = JSON.stringify(obj),
        isWindows = require('os').platform().indexOf('win') === 0,
        util = require('util');

    if (isWindows) {
        // Confused? Me too. All other approaches I tried were spectacular failures
        // in both 1) keeping the JSON as a single CLI arg, and 2) maintaining the inner quotes
        return util.format('"%s"', json.replace(/"/g, '\\"'));
    }
    else {
        return util.format("'%s'", json);
    }
}

function execShell (command, request: IRequest, response: IResponse, logger: ILogger):Q.Promise<IResponse> {
    const deferred = Q.defer<IResponse>(),
        util = require('util'),
        fullCommand = util.format('%s %s %s', command, quoteForShell(request), quoteForShell(response)),
        env = require('../util/helpers').clone(process.env);
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
function shellTransform (request: IRequest, responsePromise: Q.Promise<IResponse>, commandArray: string[], logger: ILogger) {
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
function decorate (originalRequest: IRequest, responsePromise: Q.Promise<IResponse>, fn, logger: ILogger) {
    if (originalRequest.isDryRun === true) {
        return responsePromise;
    }

    return responsePromise.then(response => {
        const helpers = require('../util/helpers'),
            config = {
                request: helpers.clone(originalRequest),
                response,
                logger
            },
            injected = `(${fn})(config, response, logger);`,
            exceptions = require('../util/errors'),
            compatibility = require('./compatibility');

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
            return Q.reject(exceptions.InjectionError('invalid decorator injection', { source: injected, data: error.message }));
        }
    });
}

function getKeyIgnoringCase (obj: object, expectedKey: string):string|undefined {
    return Object.keys(obj).find(key => {
        if (key.toLowerCase() === expectedKey.toLowerCase()) {
            return key;
        }
        else {
            return undefined;
        }
    });
}

function getFrom (obj: {[key: string]: any}, from: {[key: string]: never} | string): any {
    const isObject = require('../util/helpers').isObject;

    if (typeof obj === 'undefined') {
        return undefined;
    }
    else if (isObject(from)) {
        const keys = Object.keys(from);
        return getFrom(obj[keys[0]], from[keys[0]]);
    }
    else {
        const result = obj[getKeyIgnoringCase(obj, from as string)],
            util = require('util');

        // Some request fields, like query parameters, can be multi-valued
        if (util.isArray(result)) {
            return result[0];
        }
        else {
            return result;
        }
    }
}

function regexFlags (options) {
    let result = '';
    if (options && options.ignoreCase) {
        result += 'i';
    }
    if (options && options.multiline) {
        result += 'm';
    }
    return result;
}

function getMatches (selectionFn, selector, logger: ILogger) {
    const matches = selectionFn();

    if (matches && matches.length > 0) {
        return matches;
    }
    else {
        logger.debug('No match for "%s"', selector);
        return [];
    }
}

function regexValue (from, config, logger: ILogger) {
    const regex = new RegExp(config.using.selector, regexFlags(config.using.options)),
        selectionFn = () => regex.exec(from);
    return getMatches(selectionFn, regex, logger);
}

function xpathValue (from, config, logger: ILogger) {
    const selectionFn = () => {
        const xpath = require('./xpath');
        return xpath.select(config.using.selector, config.using.ns, from, logger);
    };
    return getMatches(selectionFn, config.using.selector, logger);
}

function jsonpathValue (from, config, logger: ILogger) {
    const selectionFn = () => {
        const jsonpath = require('./jsonpath');
        return jsonpath.select(config.using.selector, from, logger);
    };
    return getMatches(selectionFn, config.using.selector, logger);
}

function globalStringReplace (str: string, substring: string, newSubstring: string, logger: ILogger): string {
    if (substring !== newSubstring) {
        logger.debug('Replacing %s with %s', JSON.stringify(substring), JSON.stringify(newSubstring));
        return str.split(substring).join(newSubstring);
    }
    else {
        return str;
    }
}

function globalObjectReplace (obj: {[key: string]: any}, replacer: (input: any) => any): void {
    const isObject = require('../util/helpers').isObject;

    Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'string') {
            obj[key] = replacer(obj[key]);
        }
        else if (isObject(obj[key])) {
            globalObjectReplace(obj[key], replacer);
        }
    });
}

function replaceArrayValuesIn (response: IResponse, token, values, logger: ILogger) {
    const replacer = field => {
        values.forEach(function (replacement, index) {
            // replace ${TOKEN}[1] with indexed element
            const util = require('util'),
                indexedToken = util.format('%s[%s]', token, index);
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
function copy (originalRequest: IRequest, responsePromise: Q.Promise<IResponse>, copyArray:ICopyDescriptor[], logger: ILogger) {
    return responsePromise.then(response => {
        copyArray.forEach(function (copyConfig) {
            const from = getFrom(originalRequest, copyConfig.from),
                using = copyConfig.using || {},
                fnMap = { regex: regexValue, xpath: xpathValue, jsonpath: jsonpathValue },
                values = fnMap[using.method](from, copyConfig, logger);

            replaceArrayValuesIn(response, copyConfig.into, values, logger);
        });
        return Q(response);
    });
}

function containsKey (headers, keyColumn) {
    const helpers = require('../util/helpers'),
        key = Object.values(headers).find(value => value === keyColumn);
    return helpers.defined(key);
}

function createRowObject (headers, rowArray) {
    const row = {};
    rowArray.forEach(function (value, index) {
        row[headers[index]] = value;
    });
    return row;
}

function selectRowFromCSV (csvConfig, keyValue, logger: ILogger) {
    const fs = require('fs'),
        Q = require('q'),
        helpers = require('../util/helpers'),
        delimiter = csvConfig.delimiter || ',',
        inputStream = fs.createReadStream(csvConfig.path),
        parser = require('csv-parse')({ delimiter: delimiter }),
        pipe = inputStream.pipe(parser),
        deferred = Q.defer();
    let headers;

    inputStream.on('error', e => {
        logger.error('Cannot read ' + csvConfig.path + ': ' + e);
        deferred.resolve({});
    });

    pipe.on('data', function (rowArray) {
        if (!helpers.defined(headers)) {
            headers = rowArray;
            const keyOnHeader = containsKey(headers, csvConfig.keyColumn);
            if (!keyOnHeader) {
                logger.error('CSV headers "' + headers + '" with delimiter "' + delimiter + '" does not contain keyColumn:"' + csvConfig.keyColumn + '"');
                deferred.resolve({});
            }
        }
        else {
            const row = createRowObject(headers, rowArray);
            if (helpers.defined(row[csvConfig.keyColumn]) && row[csvConfig.keyColumn].localeCompare(keyValue) === 0) {
                deferred.resolve(row);
            }
        }
    });

    pipe.on('error', e => {
        logger.debug('Error: ' + e);
        deferred.resolve({});
    });

    pipe.on('end', () => {
        deferred.resolve({});
    });

    return deferred.promise;
}

function lookupRow (lookupConfig:ILookupDescriptor, originalRequest: IRequest, logger: ILogger) {
    const from = getFrom(originalRequest, lookupConfig.key.from),
        fnMap: {[key: string]: (from: any, config: any, logger: ILogger) => any} = { regex: regexValue, xpath: xpathValue, jsonpath: jsonpathValue },
        keyValues = fnMap[lookupConfig.key.using.method](from, lookupConfig.key, logger),
        index = lookupConfig.key.index || 0;

    if (lookupConfig.fromDataSource.csv) {
        return selectRowFromCSV(lookupConfig.fromDataSource.csv, keyValues[index], logger);
    }
    else {
        return Q({});
    }
}

function replaceObjectValuesIn (response: IResponse, token: string, values: {[key: string]: never}, logger: ILogger) {
    const replacer = (field:string) => {
        Object.keys(values).forEach(key => {
            const util = require('util');

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
function lookup (originalRequest: IRequest, responsePromise: Q.Promise<IResponse>, lookupArray:ILookupDescriptor[], logger: ILogger) {
    return responsePromise.then(response => {
        const lookupPromises = lookupArray.map(function (lookupConfig) {
                return lookupRow(lookupConfig, originalRequest, logger).then(function (row) {
                    replaceObjectValuesIn(response, lookupConfig.into, row, logger);
                });
            });
        return Q.all(lookupPromises).then(() => Q(response));
    }).catch(error => {
        logger.error(error);
    });
}

/**
 * The entry point to execute all behaviors provided in the API
 * @param {Object} request - The request object
 * @param {Object} response - The response generated from the stubs
 * @param {Object} behaviors - The behaviors specified in the API
 * @param {Object} logger - The mountebank logger, useful for debugging
 * @returns {Object}
 */
export function execute (request: IRequest, response: IResponse, behaviors: IBehaviors, logger: ILogger) {
    if (!behaviors) {
        return require('q')(response);
    }

    const combinators = require('../util/combinators'),
        waitFn:(input: never) => never = behaviors.wait ?
            result => wait(request, result, behaviors.wait, logger) :
            combinators.identity,
        copyFn:(input: never) => never = behaviors.copy ?
            result => copy(request, result, behaviors.copy, logger) :
            combinators.identity,
        lookupFn:(input: never) => never = behaviors.lookup ?
            result => lookup(request, result, behaviors.lookup, logger) :
            combinators.identity,
        shellTransformFn:(input: never) => never = behaviors.shellTransform ?
            result => shellTransform(request, result, behaviors.shellTransform, logger) :
            combinators.identity,
        decorateFn:(input: never) => never = behaviors.decorate ?
            result => decorate(request, result, behaviors.decorate, logger) :
            combinators.identity;

    logger.debug('using stub response behavior ' + JSON.stringify(behaviors));

    return combinators.compose(decorateFn, shellTransformFn, copyFn, lookupFn, waitFn, Q)(response);
}
