'use strict';

import * as Q from "q";
import {IServerRequestData} from "../IProtocol";

/**
 * Transforms a node http/s request to a simplified mountebank http/s request
 * that will be shown in the API
 * @module
 */

function transform (request: any): IServerRequestData {
    const helpers = require('../../util/helpers'),
        url = require('url'),
        queryString = require('query-string'),
        parts = url.parse(request.url as string),
        headersHelper = require('./headersHelper');

    const headers = headersHelper.headersFor(request.rawHeaders);

    const transformed: IServerRequestData = {
        requestFrom: helpers.socketName(request.socket),
        method: request.method,
        path: parts.pathname,
        query: parts.query,
        headers,
        body: request.body,
        ip: request.socket.remoteAddress
    };

    const contentType = headersHelper.getHeader('Content-Type', headers);
    if (request.body && isUrlEncodedForm(contentType)) {
        transformed.form = queryString.parse(request.body);
    }

    return transformed;
}

function isUrlEncodedForm (contentType: string) {
    if (!contentType) {
        return false;
    }

    const index = contentType.indexOf(';');
    const type = index !== -1 ?
        contentType.substr(0, index).trim() :
        contentType.trim();

    return type === 'application/x-www-form-urlencoded';
}

/**
 * Creates the API-friendly http/s request
 * @param {Object} request - The raw http/s request
 * @returns {Object} - Promise resolving to the simplified request
 */
export function createFrom (request:any): Q.Promise<IServerRequestData> {
    const deferred = Q.defer<IServerRequestData>();
    request.body = '';
    request.setEncoding('binary');
    request.on('data', (chunk:any) => { request.body += chunk; });
    request.on('end', () => { deferred.resolve(transform(request)); });
    return deferred.promise;
}