import { ILogger } from '../util/scopedLogger';
import { SelectedValue } from 'xpath';
import * as errors from '../util/errors';
import * as helpers from '../util/helpers';

/**
 * Shared logic for xpath selector
 * @module
 */

function xpathSelect (selectFn: (selector: string, doc: Document) => SelectedValue[], selector: string, doc: Document): SelectedValue[] {
    if (!helpers.defined(doc)) {
        return [];
    }

    try {
        return selectFn(selector, doc);
    }
    catch (e) {
        throw errors.ValidationError('malformed xpath predicate selector', {
            source: selector,
            inner: e
        });
    }
}

function nodeValue (node: any) {
    if (node.nodeType === node.TEXT_NODE) {
        return node.nodeValue;
    }
    else if (node.nodeType === node.ATTRIBUTE_NODE) {
        return node.value;
    }
    else if (node.firstChild) {
        //Converting to a string allows exists to return true if the node exists,
        //even if there's no data
        return String(node.firstChild.data);
    }
    else {
        return String(node.data);
    }
}

/**
 * Returns xpath value(s) from given xml
 * @param {String} selector - The xpath selector
 * @param {Object} ns - The namespace map
 * @param {String} possibleXML - the xml
 * @param {Object} logger - Optional, used to log XML parsing errors
 * @returns {Object}
 */
export function select (selector: string, ns: {}, possibleXML: string, logger: ILogger) {
    const xpath = require('xpath');
    const DOMParser = require('xmldom').DOMParser;
    const parser = new DOMParser({
        errorHandler: (level: string, message: any) => {
            const warn = (logger || {}).warn || (() => {});
            warn('%s (source: %s)', message, JSON.stringify(possibleXML));
        }
    });
    const doc = parser.parseFromString(possibleXML);
    const selectFn = xpath.useNamespaces(ns || {});
    const result = xpathSelect(selectFn, selector, doc);

    if (['number', 'boolean'].indexOf(typeof result) >= 0) {
        return result;
    }

    const nodeValues = result.map(nodeValue);

    if (nodeValues.length === 0) {
        return undefined;
    }
    else {
        return nodeValues;
    }
}
