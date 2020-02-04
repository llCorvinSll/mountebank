

import { Socket } from 'net';

interface IIndexed {
    [key: string]: any;
}

/** @module */

/**
 * Returns true if obj is a defined value
 * @param {Object} obj - the value to test
 * @returns {boolean}
 */
export function defined (obj: unknown): boolean {
    return typeof obj !== 'undefined';
}

/**
 * Returns true if obj is a non-null object
 * Checking for typeof 'object' without checking for nulls
 * is a very common source of bugs
 * @param {Object} obj - the value to test
 * @returns {boolean}
 */
export function isObject (obj: any): boolean {
    return typeof obj === 'object' && obj !== null;
}

/**
 * Returns the text used for logging purposes related to this socket
 * @param {Object} socket - the socket
 * @returns {string}
 */
export function socketName (socket: Socket): string {
    let result = socket.remoteAddress as string;
    if (socket.remotePort) {
        result += `:${socket.remotePort}`;
    }
    return result;
}

/**
 * Returns a deep clone of obj
 * @param {Object} obj - the object to clone
 * @returns {Object}
 */
export function clone<T> (obj: T): T {
    if (typeof obj === 'undefined') {
        return undefined as any;
    }

    return JSON.parse(JSON.stringify(obj));
}

/**
 * Returns a new object combining the two parameters
 * @param {Object} defaults - The base object
 * @param {Object} overrides - The object to merge from.  Where the same property exists in both defaults
 * and overrides, the values for overrides will be used
 * @returns {Object}
 */
export function merge<T1 extends IIndexed, T2 extends IIndexed> (defaults: T1, overrides: T2): T1 & T2 {
    const result: any = clone(defaults);
    Object.keys(overrides).forEach(key => {
        if (typeof overrides[key] === 'object' && overrides[key] !== null) {
            result[key] = merge(result[key] || {}, overrides[key]);
        }
        else {
            result[key] = overrides[key];
        }
    });
    return result;
}

/**
 * Sets a value of nested key string descriptor inside a Object.
 * It changes the passed object.
 * Ex:
 *    let obj = {a: {b:{c:'initial'}}}
 *    setNestedKey(obj, ['a', 'b', 'c'], 'changed-value')
 *    assert(obj === {a: {b:{c:'changed-value'}}})
 *
 * @param {Object} obj   Object to set the nested key
 * @param {Array} path  An array to describe the path(Ex: ['a', 'b', 'c'])
 * @param {Object} value Any value
 * @returns {undefined}
 * from https://stackoverflow.com/a/49754647
 */
export function setDeep (obj: Record<string, any> & IIndexed, path: string[], value: Record<string, any> | boolean): void {
    if (path.length === 1) {
        obj[path[0]] = value;
        return;
    }
    setDeep(obj[path[0]], path.slice(1), value);
}
