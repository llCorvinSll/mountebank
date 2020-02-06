

import { Request, Response } from 'express';
import { IMountebankOptions } from '../models/IMountebankOptions';

/**
 * The controller that exposes the mountebank configuration for the running process
 * @module
 */

/**
 * Creates the config controller
 * @param {string} version - The version of the currently running process
 * @param {Object} options - The command line options used to start mb
 * @returns {Object}
 */
export function create (version: string, options: IMountebankOptions) {
    const helpers = require('../util/helpers');
    const publicOptions = helpers.clone(options);

    delete publicOptions.heroku;
    delete publicOptions.version;

    // On some OS's, it duplicates camelCase as hypen-case (e.g. noParse and no-parse)
    // I assume this was a change in yargs at some point
    for (const prop in publicOptions) {
        if (prop.indexOf('-') > 0) {
            delete publicOptions[prop];
        }
    }

    /**
     * The method that responds to GET /config
     * @memberOf module:controllers/configController#
     * @param {Object} request - The HTTP request
     * @param {Object} response - The HTTP response
     */
    function get (request: Request, response: Response) {
        const config = {
            version,
            options: publicOptions,
            process: {
                nodeVersion: process.version,
                architecture: process.arch,
                platform: process.platform,
                rss: process.memoryUsage().rss,
                heapTotal: process.memoryUsage().heapTotal,
                heapUsed: process.memoryUsage().heapUsed,
                uptime: process.uptime(),
                cwd: process.cwd()
            }
        };

        response.format({
            json: () => response.send(config),
            html: () => response.render('config', config)
        });
    }

    return { get };
}
