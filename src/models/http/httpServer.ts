'use strict';

import {create} from "./baseHttpServer";

/**
 * Represents an http imposter
 * @module
 */

function createBaseServer () {
    return {
        metadata: {},
        createNodeServer: require('http').createServer
    };
}

const server = create(createBaseServer);
export default server;
