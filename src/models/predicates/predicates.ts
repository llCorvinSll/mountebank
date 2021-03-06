import { ILogger } from '../../util/scopedLogger';
import { IJsonPathConfig, IPredicate, IXPathConfig } from './IPredicate';
import { IServerRequestData } from '../IProtocol';
import * as errors from '../../util/errors';
import * as helpers from '../../util/helpers';
import * as combinators from '../../util/combinators';
import * as stringify from 'json-stable-stringify';
import * as compatibility from '../compatibility';
import * as xpath from '../xpath';
import * as jsonpath from '../jsonpath';
import { IHashMap } from '../../util/types';


/**
 * All the PREDICATES that determine whether a stub matches a request
 * @module
 */

function sortObjects (a: any, b: any): number {
    if (helpers.isObject(a) && helpers.isObject(b)) {
        // Make best effort at sorting arrays of objects to make
        // deepEquals order-independent
        return sortObjects(stringify(a), stringify(b));
    }
    else if (a < b) {
        return -1;
    }
    else {
        return 1;
    }
}

function forceStrings (value: IHashMap<IHashMap | any>): any {
    if (value === null) {
        return 'null';
    }
    else if (Array.isArray(value)) {
        return value.map(forceStrings) as any;
    }
    else if (helpers.isObject(value)) {
        return Object.keys(value).reduce((accumulator, key) => {
            accumulator[key] = forceStrings(value[key]);
            return accumulator;
        }, {} as any);
    }
    else if (typeof value.toString === 'function') {
        return value.toString();
    }
    else {
        return value;
    }
}

function select (type: any, selectFn: Function, encoding: string) {
    if (encoding === 'base64') {
        throw errors.ValidationError(`the ${type} predicate parameter is not allowed in binary mode`);
    }

    const nodeValues = selectFn();

    // Return either a string if one match or array if multiple
    // This matches the behavior of node's handling of query parameters,
    // which allows us to maintain the same semantics between deepEquals
    // (all have to match, passing in an array if necessary) and the other
    // PREDICATES (any can match)
    if (nodeValues && nodeValues.length === 1) {
        return nodeValues[0];
    }
    else {
        return nodeValues;
    }
}

function orderIndependent (possibleArray: object) {
    if (Array.isArray(possibleArray)) {
        return possibleArray.sort(sortObjects);
    }
    else {
        return possibleArray;
    }
}

function transformObject (obj: any, transform: (inp: any) => any) {
    Object.keys(obj).forEach(key => {
        obj[key] = transform(obj[key]);
    });
    return obj;
}

function selectXPath (config: IXPathConfig, encoding: string, text: string) {
    const selectFn = combinators.curry(xpath.select, config.selector, config.ns, text);

    return orderIndependent(select('xpath', selectFn, encoding));
}

function selectTransform (config: IPredicate, options: INormalizeOptions) {
    const cloned = helpers.clone(config);

    if (config.jsonpath) {
        const stringTransform = options.shouldForceStrings ? forceStrings : combinators.identity;

        // use keyCaseSensitive instead of caseSensitive to help "matches" PREDICATES too
        // see https://github.com/bbyars/mountebank/issues/361
        if (!cloned.keyCaseSensitive) {
            cloned.jsonpath!.selector = cloned.jsonpath!.selector.toLowerCase();
        }

        return combinators.curry(selectJSONPath, cloned.jsonpath, options.encoding, config, stringTransform);
    }
    else if (config.xpath) {
        if (!cloned.caseSensitive) {
            cloned.xpath!.ns = transformObject(cloned.xpath!.ns || {}, lowercase);
            cloned.xpath!.selector = cloned.xpath!.selector.toLowerCase();
        }
        return combinators.curry(selectXPath, cloned.xpath, options.encoding);
    }
    else {
        return combinators.identity;
    }
}

function lowercase (text: string): string {
    return text.toLowerCase();
}

function caseTransform (config: IPredicate) {
    return config.caseSensitive ? combinators.identity : lowercase;
}

function exceptTransform (config: IPredicate) {
    const exceptRegexOptions = config.caseSensitive ? 'g' : 'gi';

    if (config.except) {
        return (text: string) => text.replace(new RegExp(config.except!, exceptRegexOptions), '');
    }
    else {
        return combinators.identity;
    }
}

function encodingTransform (encoding: string) {
    if (encoding === 'base64') {
        return (text: string) => Buffer.from(text, 'base64').toString();
    }
    else {
        return combinators.identity;
    }
}

function tryJSON (value: string, predicateConfig: IPredicate) {
    try {
        const keyCaseTransform = predicateConfig.keyCaseSensitive === false ? lowercase : caseTransform(predicateConfig);
        const valueTransforms = [exceptTransform(predicateConfig), caseTransform(predicateConfig)];

        // We can't call normalize because we want to avoid the array sort transform,
        // which will mess up indexed selectors like $..title[1]
        return transformAll(JSON.parse(value), [keyCaseTransform], valueTransforms, []);
    }
    catch (e) {
        return value;
    }
}

function selectJSONPath (config: IJsonPathConfig, encoding: string, predicateConfig: IPredicate, stringTransform: (inp: string) => string, text: string) {
    const possibleJSON = stringTransform(tryJSON(text, predicateConfig));
    const selectFn = combinators.curry(jsonpath.select, config.selector, possibleJSON);

    return orderIndependent(select('jsonpath', selectFn, encoding));
}


function transformAll (obj: any, keyTransforms: any, valueTransforms: any, arrayTransforms: any): any {
    const apply = (fns: Function) => combinators.compose.apply(null, fns);

    if (Array.isArray(obj)) {
        return apply(arrayTransforms)(obj.map(element => transformAll(element, keyTransforms, valueTransforms, arrayTransforms)));
    }
    else if (helpers.isObject(obj)) {
        return Object.keys(obj).reduce((accumulator, key) => {
            accumulator[apply(keyTransforms)(key)] = transformAll((obj as IHashMap)[key], keyTransforms, valueTransforms, arrayTransforms);
            return accumulator;
        }, {} as any);
    }
    else if (typeof obj === 'string') {
        return apply(valueTransforms)(obj);
    }
    else {
        return obj;
    }
}

interface INormalizeOptions {
    withSelectors?: boolean;
    encoding?: string;
    shouldForceStrings?: boolean;
}


function normalize (obj: any, config: IPredicate, options: INormalizeOptions) {
    // Needed to solve a tricky case conversion for "matches" PREDICATES with jsonpath/xpath parameters
    if (typeof config.keyCaseSensitive === 'undefined') {
        config.keyCaseSensitive = config.caseSensitive;
    }

    const keyCaseTransform = config.keyCaseSensitive === false ? lowercase : caseTransform(config);
    const sortTransform = (array: any[]) => array.sort(sortObjects);
    const transforms = [];

    if (options.withSelectors) {
        transforms.push(selectTransform(config, options));
    }

    transforms.push(exceptTransform(config));
    transforms.push(caseTransform(config));
    transforms.push(encodingTransform(options.encoding as string));

    // sort to provide deterministic comparison for deepEquals,
    // where the order in the array for multi-valued querystring keys
    // and xpath selections isn't important
    return transformAll(obj, [keyCaseTransform], transforms, [sortTransform]);
}

function testPredicate (expected: any, actual: any, predicateConfig: IPredicate, predicateFn: Function): any {
    if (!helpers.defined(actual)) {
        actual = '';
    }
    if (helpers.isObject(expected)) {
        return predicateSatisfied(expected, actual, predicateConfig, predicateFn);
    }
    else {
        return predicateFn(expected, actual);
    }
}

function bothArrays (expected: object, actual: object): any {
    return Array.isArray(actual) && Array.isArray(expected);
}

function allExpectedArrayValuesMatchActualArray (expectedArray: any[], actualArray: any[], predicateConfig: IPredicate, predicateFn: Function): boolean {
    return expectedArray.every(expectedValue =>
        actualArray.some(actualValue => testPredicate(expectedValue, actualValue, predicateConfig, predicateFn)));
}

function onlyActualIsArray (expected: any, actual: any): boolean {
    return Array.isArray(actual) && !Array.isArray(expected);
}

function expectedMatchesAtLeastOneValueInActualArray (expected: any, actualArray: any[], predicateConfig: IPredicate, predicateFn: Function): boolean {
    return actualArray.some((actual: object) => testPredicate(expected, actual, predicateConfig, predicateFn));
}

function expectedLeftOffArraySyntaxButActualIsArrayOfObjects (expected: any, actual: any, fieldName: string) {
    return !Array.isArray(expected[fieldName]) && !helpers.defined(actual[fieldName]) && Array.isArray(actual);
}

function predicateSatisfied (expected: any, actual: any, predicateConfig: IPredicate, predicateFn: Function): boolean {
    if (!actual) {
        return false;
    }

    // Support PREDICATES that reach into fields encoded in JSON strings (e.g. HTTP bodies)
    if (typeof actual === 'string') {
        actual = tryJSON(actual, predicateConfig);
    }

    return Object.keys(expected).every(fieldName => {
        if (bothArrays(expected[fieldName], actual[fieldName])) {
            return allExpectedArrayValuesMatchActualArray(
                expected[fieldName], actual[fieldName], predicateConfig, predicateFn);
        }
        else if (onlyActualIsArray(expected[fieldName], actual[fieldName])) {
            if (predicateConfig.exists && expected[fieldName]) {
                return true;
            }
            else {
                return expectedMatchesAtLeastOneValueInActualArray(
                    expected[fieldName], actual[fieldName], predicateConfig, predicateFn);
            }
        }
        else if (expectedLeftOffArraySyntaxButActualIsArrayOfObjects(expected, actual, fieldName)) {
            // This is a little confusing, but predated the ability for users to specify an
            // array for the expected values and is left for backwards compatibility.
            // The predicate might be:
            //     { equals: { examples: { key: 'third' } } }
            // and the request might be
            //     { examples: '[{ "key": "first" }, { "different": true }, { "key": "third" }]' }
            // We expect that the "key" field in the predicate definition matches any object key
            // in the actual array
            return expectedMatchesAtLeastOneValueInActualArray(expected, actual, predicateConfig, predicateFn);
        }
        else if (helpers.isObject(expected[fieldName])) {
            return predicateSatisfied(expected[fieldName], actual[fieldName], predicateConfig, predicateFn);
        }
        else {
            return testPredicate(expected[fieldName], actual[fieldName], predicateConfig, predicateFn);
        }
    });
}

function create (operator: string, predicateFn: (expected: string, actual: string) => boolean): PredicateFunction {
    return (predicate, request, encoding) => {
        const expected = normalize(predicate[operator], predicate, { encoding: encoding });
        const actual = normalize(request, predicate, { encoding: encoding, withSelectors: true });

        return predicateSatisfied(expected, actual, predicate, predicateFn);
    };
}

function deepEquals (predicate: IPredicate, request: IServerRequestData, encoding: string) {
    const expected = normalize(forceStrings(predicate.deepEquals!), predicate, { encoding: encoding });
    const actual = normalize(forceStrings(request), predicate, { encoding: encoding, withSelectors: true, shouldForceStrings: true });

    return Object.keys(expected).every(fieldName => {
        // Support PREDICATES that reach into fields encoded in JSON strings (e.g. HTTP bodies)
        if (helpers.isObject(expected[fieldName]) && typeof actual[fieldName] === 'string') {
            const possibleJSON = tryJSON(actual[fieldName], predicate);
            actual[fieldName] = normalize(forceStrings(possibleJSON), predicate, { encoding: encoding });
        }
        return stringify(expected[fieldName]) === stringify(actual[fieldName]);
    });
}

function matches (predicate: IPredicate, request: IServerRequestData, encoding: string) {
    // We want to avoid the lowerCase transform on values so we don't accidentally butcher
    // a regular expression with upper case metacharacters like \W and \S
    // However, we need to maintain the case transform for keys like http header names (issue #169)
    // eslint-disable-next-line no-unneeded-ternary
    const caseSensitive = Boolean(predicate.caseSensitive); // convert to boolean even if undefined
    const clone = helpers.merge(predicate, { caseSensitive: true, keyCaseSensitive: caseSensitive });
    const noexcept = helpers.merge(clone, { except: '' });
    const expected = normalize(predicate.matches, noexcept, { encoding: encoding });
    const actual = normalize(request, clone, { encoding: encoding, withSelectors: true });
    const options = caseSensitive ? '' : 'i';

    if (encoding === 'base64') {
        throw errors.ValidationError('the matches predicate is not allowed in binary mode');
    }

    return predicateSatisfied(expected, actual, clone, (a: string, b: string) => new RegExp(a, options).test(b));
}

function not (predicate: IPredicate, request: IServerRequestData, encoding: string, logger: ILogger, imposterState: unknown) {
    return !evaluate(predicate.not!, request, encoding, logger, imposterState);
}

function evaluateFn (request: IServerRequestData, encoding: string, logger: ILogger, imposterState: unknown) {
    return (subPredicate: IPredicate) => evaluate(subPredicate, request, encoding, logger, imposterState);
}

function or (predicate: IPredicate, request: IServerRequestData, encoding: string, logger: ILogger, imposterState: unknown) {
    return predicate.or!.some(evaluateFn(request, encoding, logger, imposterState));
}

function and (predicate: IPredicate, request: IServerRequestData, encoding: string, logger: ILogger, imposterState: unknown) {
    return predicate.and!.every(evaluateFn(request, encoding, logger, imposterState));
}

function inject (predicate: IPredicate, request: IServerRequestData, encoding: string, logger: ILogger, imposterState: unknown) {
    if (request.isDryRun === true) {
        return true;
    }

    const config = {
        request: helpers.clone(request),
        state: imposterState,
        logger: logger
    };

    compatibility.downcastInjectionConfig(config);

    const injected = `(${predicate.inject})(config, logger, imposterState);`;

    try {
        return eval(injected);
    }
    catch (error) {
        logger.error(`injection X=> ${error}`);
        logger.error(`    source: ${JSON.stringify(injected)}`);
        logger.error(`    config: ${JSON.stringify(config)}`);
        throw errors.InjectionError('invalid predicate injection', { source: injected, data: error.message });
    }
}

function toString (value: any): string {
    if (value !== null && typeof value !== 'undefined' && typeof value.toString === 'function') {
        return value.toString();
    }
    else {
        return value;
    }
}

type PredicateFunction = (clone: IPredicate, request: IServerRequestData, encoding?: string, logger?: ILogger, imposter?: unknown) => boolean;


const PREDICATES: { [key: string]: PredicateFunction } = {
    equals: create('equals', (expected, actual) => toString(expected) === toString(actual)),
    deepEquals,
    contains: create('contains', (expected, actual) => actual.indexOf(expected) >= 0),
    startsWith: create('startsWith', (expected, actual) => actual.indexOf(expected) === 0),
    endsWith: create('endsWith', (expected, actual) => actual.indexOf(expected, actual.length - expected.length) >= 0),
    matches,
    exists: create('exists', function (expected, actual) {
        return expected ? (typeof actual !== 'undefined' && actual !== '') : (typeof actual === 'undefined' || actual === '');
    }),
    not,
    or,
    and,
    inject
};

/**
 * Resolves all predicate keys in given predicate
 * @param {Object} predicate - The predicate configuration
 * @param {Object} request - The protocol request object
 * @param {string} encoding - utf8 or base64
 * @param {Object} logger - The logger, useful for debugging purposes
 * @param {Object} imposterState - The current state for the imposter
 * @returns {boolean}
 */
export function evaluate (predicate: IPredicate, request: IServerRequestData, encoding?: string, logger?: ILogger, imposterState?: unknown): boolean {
    const predicateFn = Object.keys(predicate).find(key => Object.keys(PREDICATES).indexOf(key) >= 0);
    const clone: IPredicate = helpers.clone(predicate);

    if (predicateFn) {
        return PREDICATES[predicateFn](clone, request, encoding, logger, imposterState);
    }
    else {
        throw errors.ValidationError('missing predicate', { source: predicate });
    }
}
