

import { ILogger } from '../util/scopedLogger';
import { JSONPath } from 'jsonpath-plus';
import { isObject } from '../util/helpers';

/**
 * Shared logic for xpath selector
 * @module
 */

/**
 * Returns xpath value(s) from given xml
 * @param {String} selector - The xpath selector
 * @param {String} possibleJSON - the JSON string
 * @param {Logger} logger - Optional, used to log JSON parsing errors
 * @returns {Object}
 */
export function select (selector: string, possibleJSON: string, logger: ILogger): string | undefined {
    try {
        const json = isObject(possibleJSON) ? possibleJSON : JSON.parse(possibleJSON);
        const result = JSONPath(selector, json, undefined, undefined);
        if (typeof result === 'string') {
            return result;
        }
        else if (result.length === 0) {
            return undefined;
        }
        else {
            return result;
        }
    }
    catch (e) {
        if (logger) {
            logger.warn(`Cannot parse as JSON: ${JSON.stringify(possibleJSON)}`);
        }
        return undefined;
    }
}
