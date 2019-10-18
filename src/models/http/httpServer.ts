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

export default create(createBaseServer);
