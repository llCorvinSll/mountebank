import { ILogger } from '../../util/scopedLogger';
import { IRequest, IResponse } from '../IRequest';
import * as Q from 'q';
import { UrlWithStringQuery } from 'url';
import { ClientRequest, IncomingHttpHeaders } from 'http';
import { InvalidProxyError } from '../../util/errors';
import { IProxyImplementation } from '../IProtocol';
import { IProxyConfig } from '../stubs/IStubConfig';

/**
 * The proxy implementation for http/s imposters
 * @module
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

/**
 * Creates the proxy
 * @param {Object} logger - The logger
 * @returns {Object}
 */
export function create (logger: ILogger): IProxyImplementation {
    function addInjectedHeadersTo (request: any, headersToInject: any) {
        Object.keys(headersToInject || {}).forEach(key => {
            request.headers[key] = headersToInject[key];
        });
    }

    function toUrl (path: string | undefined, query: any, requestDetails: any) {
        if (requestDetails) {
            //Not passed in outOfProcess mode
            return requestDetails.rawUrl;
        }

        const querystring = require('querystring');
        const tail = querystring.stringify(query);

        if (tail === '') {
            return path;
        }
        return `${path}?${tail}`;
    }

    function hostnameFor (protocol: string, host: string, port: number): string {
        let result = host;
        if ((protocol === 'http:' && port !== 80) || (protocol === 'https:' && port !== 443)) {
            result += `:${port}`;
        }
        return result;
    }

    function setProxyAgent (parts: UrlWithStringQuery, options: any) {
        const HttpProxyAgent = require('http-proxy-agent');
        const HttpsProxyAgent = require('https-proxy-agent');

        if (process.env.http_proxy && parts.protocol === 'http:') {
            options.agent = new HttpProxyAgent(process.env.http_proxy);
        }
        else if (process.env.https_proxy && parts.protocol === 'https:') {
            options.agent = new HttpsProxyAgent(process.env.https_proxy);
        }
    }

    function getProxyRequest (baseUrl: string, originalRequest: IRequest, proxyOptions: IProxyConfig, requestDetails?: unknown): ClientRequest {
        /*eslint complexity: 0 */
        const helpers = require('../../util/helpers');
        const headersHelper = require('./headersHelper');
        const url = require('url');
        const parts = url.parse(baseUrl);
        const protocol = parts.protocol === 'https:' ? require('https') : require('http');
        const defaultPort = parts.protocol === 'https:' ? 443 : 80;
        const options = {
            method: originalRequest.method,
            hostname: parts.hostname,
            port: parts.port || defaultPort,
            auth: parts.auth,
            path: toUrl(originalRequest.path, originalRequest.query, requestDetails),
            headers: helpers.clone(originalRequest.headers),
            cert: proxyOptions.cert,
            key: proxyOptions.key,
            ciphers: proxyOptions.ciphers || 'ALL',
            secureProtocol: proxyOptions.secureProtocol,
            passphrase: proxyOptions.passphrase,
            rejectUnauthorized: false
        };

        //Only set host header if not overridden via injectHeaders (issue #388)
        if (!proxyOptions.injectHeaders || !headersHelper.hasHeader('host', proxyOptions.injectHeaders)) {
            options.headers.host = hostnameFor(parts.protocol, parts.hostname, options.port);
        }
        setProxyAgent(parts, options);

        //Avoid implicit chunked encoding (issue #132)
        if (originalRequest.body &&
            !headersHelper.hasHeader('Transfer-Encoding', originalRequest.headers) &&
            !headersHelper.hasHeader('Content-Length', originalRequest.headers)) {
            options.headers['Content-Length'] = Buffer.byteLength(originalRequest.body, 'binary');
        }

        const proxiedRequest = protocol.request(options);
        if (originalRequest.body) {
            proxiedRequest.write(originalRequest.body, 'binary');
        }
        return proxiedRequest;
    }

    function isBinaryResponse (headers: IncomingHttpHeaders) {
        const contentEncoding = headers['content-encoding'] || '';
        const contentType = headers['content-type'] || '';

        if (contentEncoding.indexOf('gzip') >= 0) {
            return true;
        }

        if (contentType === 'application/octet-stream') {
            return true;
        }

        return ['audio', 'image', 'video'].some(typeName => contentType.indexOf(typeName) === 0);
    }

    function proxy (proxiedRequest: ClientRequest): Q.Promise<IResponse> {
        const deferred = Q.defer<IResponse>();

        proxiedRequest.end();

        proxiedRequest.once('response', response => {
            let packets: any[] = [];

            response.on('data', chunk => {
                packets.push(chunk);
            });

            response.on('end', () => {
                const body = Buffer.concat(packets);
                const mode = isBinaryResponse(response.headers) ? 'binary' : 'text';
                const encoding = mode === 'binary' ? 'base64' : 'utf8';
                const headersHelper = require('./headersHelper');
                const stubResponse: IResponse = {
                    statusCode: response.statusCode,
                    headers: headersHelper.headersFor(response.rawHeaders),
                    body: body.toString(encoding),
                    _mode: mode
                };

                packets = null as any;
                deferred.resolve(stubResponse);
            });
        });

        return deferred.promise;
    }

    /**
     * Proxies an http/s request to a destination
     * @memberOf module:models/http/httpProxy#
     * @param {string} proxyDestination - The base URL to proxy to, without a path (e.g. http://www.google.com)
     * @param {Object} originalRequest - The original http/s request to forward on to proxyDestination
     * @param {Object} options - Proxy options
     * @param {string} [options.cert] - The certificate, in case the destination requires mutual authentication
     * @param {string} [options.key] - The private key, in case the destination requires mutual authentication
     * @param {Object} [options.injectHeaders] - The headers to inject in the proxied request
     * @param {Object} [options.passphrase] - The passphrase for the private key
     * @param {Object} requestDetails - Additional details about the request not stored in the simplified JSON
     * @returns {Object} - Promise resolving to the response
     */
    function to (proxyDestination: string, originalRequest: IRequest, options: IProxyConfig, requestDetails?: unknown): Q.Promise<IResponse> {

        addInjectedHeadersTo(originalRequest, options.injectHeaders);

        function log (direction: string, what: object) {
            logger.debug('Proxy %s %s %s %s %s',
                originalRequest.requestFrom, direction, JSON.stringify(what), direction, proxyDestination);
        }

        const deferred = Q.defer<IResponse>();
        const proxiedRequest = getProxyRequest(proxyDestination, originalRequest, options, requestDetails);

        log('=>', originalRequest);

        proxy(proxiedRequest).done(response => {
            log('<=', response);
            deferred.resolve(response);
        });

        proxiedRequest.once('error', (error: any) => {
            if (error.code === 'ENOTFOUND') {
                deferred.reject(InvalidProxyError(`Cannot resolve ${JSON.stringify(proxyDestination)}`));
            }
            else if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
                deferred.reject(InvalidProxyError(`Unable to connect to ${JSON.stringify(proxyDestination)}`));
            }
            else {
                deferred.reject(error);
            }
        });

        return deferred.promise;
    }

    return {
        //eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        //@ts-ignore
        to
    };
}
