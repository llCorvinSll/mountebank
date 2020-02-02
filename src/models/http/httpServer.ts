'use strict';


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

const create = require('./baseHttpServer').create;

module.exports = create(createBaseServer);
