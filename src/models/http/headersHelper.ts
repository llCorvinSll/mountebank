'use strict';

function add (current: string | string[], value: string | string[]) {
    return Array.isArray(current) ? current.concat(value) : [current].concat(value);
}

function arrayifyIfExists (current: string | string[], value: string) {
    return current ? add(current, value) : value;
}

interface IHeadersMap {
    [key:string]:string | string[];
}

export function headersFor (rawHeaders: string[]): IHeadersMap {
    const result:IHeadersMap = {};
    for (let i = 0; i < rawHeaders.length; i += 2) {
        const name = rawHeaders[i];
        const value = rawHeaders[i + 1];
        result[name] = arrayifyIfExists(result[name], value);
    }
    return result;
}

export function hasHeader (headerName: string, headers: IHeadersMap) {
    return Object.keys(headers).some(header => header.toLowerCase() === headerName.toLowerCase());
}

export function getHeader (headerName: string, headers: IHeadersMap) {
    return headers[headerNameFor(headerName, headers) as string];
}

export function setHeader (headerName: string, value: string, headers: IHeadersMap) {
    headers[headerNameFor(headerName, headers) as string] = value;
}

export function headerNameFor (headerName: string, headers: IHeadersMap): string | undefined {
    const helpers = require('../../util/helpers'),
        result = Object.keys(headers).find(header => header.toLowerCase() === headerName.toLowerCase());

    if (!helpers.defined(result)) {
        return headerName;
    }
    else {
        return result;
    }
}

export function getJar (headers: IHeadersMap) {
    return {
        get: (header:string) => getHeader(header, headers),
        set: (header: string, value: string) => setHeader(header, value, headers)
    };
}
