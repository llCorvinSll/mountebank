'use strict';

import {IServerCreationOptions} from "../IProtocol";
import * as path from "path";
import * as fs from "fs";
import {create} from '../http/baseHttpServer'

/**
 * Represents an https imposter
 * @module
 */

function createBaseServer (options: IServerCreationOptions) {
    const metadata = {
            key: options.key || fs.readFileSync(path.join(__dirname, '/cert/mb-key.pem'), 'utf8'),
            cert: options.cert || fs.readFileSync(path.join(__dirname, '/cert/mb-cert.pem'), 'utf8'),
            mutualAuth: Boolean(options.mutualAuth)
        },
        createNodeServer = () =>
            // client certs will not reject the request.  It does set the request.client.authorized variable
            // to false for all self-signed certs; use rejectUnauthorized: true and a ca: field set to an array
            // containing the client cert to see request.client.authorized = true
            require('https').createServer({
                key: metadata.key,
                cert: metadata.cert,
                requestCert: metadata.mutualAuth,
                rejectUnauthorized: false
            })
        ;

    return { metadata, createNodeServer };
}

module.exports = create(createBaseServer);
