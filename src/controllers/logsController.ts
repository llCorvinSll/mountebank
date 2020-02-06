

import { Request, Response } from 'express';

/**
 * The controller that exposes the logs
 * @module
 */

/**
 * Creates the logs controller
 * @param {string} logfile - the path to the logfile
 * @returns {{get: get}}
 */
export function create (logfile: string) {
    /**
     * The function that responds to GET /logs
     * @memberOf module:controllers/logsController#
     * @param {Object} request - the HTTP request
     * @param {Object} response - the HTTP response
     */
    function get (request: Request, response: Response) {
        const fs = require('fs');
        const json = '[' + fs.readFileSync(logfile).toString().split('\n').join(',').replace(/,$/, '') + ']';
        const allLogs = JSON.parse(json);
        const url = require('url');
        const query = url.parse(request.url, true).query;
        const startIndex = parseInt(query.startIndex || 0);
        const endIndex = parseInt(query.endIndex || allLogs.length - 1);
        const logs = allLogs.slice(startIndex, endIndex + 1);

        response.format({
            json: () => { response.send({ logs: logs }); },
            html: () => { response.render('logs', { logs: logs, escape: require('escape-html') }); }
        });
    }

    return { get };
}
