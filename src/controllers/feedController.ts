

import { Request, Response } from 'express';
import { IMountebankOptions, IRelease } from '../models/IMountebankOptions';

/**
 * The controller that exposes information about releases
 * @module
 */


interface IReleaseView extends IRelease {
    view?: string;
}

/**
 * @param {Object} releases - The object represented in the releases.json file
 * @param {Object} options - The command line options used to start mountebank
 * @returns {Object} The controller
 */
export function create (releases: IRelease[], options: IMountebankOptions) {
    const helpers = require('../util/helpers');
    const feedReleases: IReleaseView[] = helpers.clone(releases);

    //Init once since we hope many consumers poll the heroku feed and we don't have monitoring
    feedReleases.reverse();

    const releaseViewFor = (version: string) => `releases/${version}.ejs`;

    const releaseFilenameFor = (version: string) => {
        const path = require('path');
        return path.join(__dirname, '/../views/', releaseViewFor(version));
    };

    /**
     * The function that responds to GET /feed
     * @memberOf module:controllers/feedController#
     * @param {Object} request - The HTTP request
     * @param {Object} response - The HTTP response
     */
    function getFeed (request: Request, response: Response) {
        const fs = require('fs');
        const ejs = require('ejs');
        const page = parseInt(request.query.page || '1');
        const nextPage = page + 1;
        const entriesPerPage = 10;
        const hasNextPage = feedReleases.slice((nextPage * entriesPerPage) - 10, entriesPerPage * nextPage).length > 0;
        const config = {
            host: request.headers.host,
            releases: feedReleases.slice(page * entriesPerPage - 10, entriesPerPage * page),
            hasNextPage: hasNextPage,
            nextLink: `/feed?page=${nextPage}`
        };

        //I'd prefer putting this as an include in the view, but EJS doesn't support dynamic includes
        if (!feedReleases[0].view) {
            feedReleases.forEach(release => {
                const contents = fs.readFileSync(releaseFilenameFor(release.version), { encoding: 'utf8' });
                release.view = ejs.render(contents, {
                    host: request.headers.host,
                    releaseMajorMinor: release.version.replace(/^v(\d+\.\d+).*/, '$1'),
                    releaseVersion: release.version.replace('v', '')
                });
            });
        }

        response.type('application/atom+xml');
        response.render('feed', config);
    }

    /**
     * The function that responds to GET /releases
     * @memberOf module:controllers/feedController#
     * @param {Object} request - The HTTP request
     * @param {Object} response - The HTTP response
     */
    function getReleases (request: Request, response: Response) {
        response.render('releases', { releases: feedReleases });
    }

    /**
     * The function that responds to GET /releases/:version
     * @memberOf module:controllers/feedController#
     * @param {Object} request - The HTTP request
     * @param {Object} response - The HTTP response
     */
    function getRelease (request: Request, response: Response) {
        const fs = require('fs');
        const version = request.params.version;
        const config = {
            host: request.headers.host,
            heroku: options.heroku,
            releaseMajorMinor: version.replace(/^v(\d+\.\d+).*/, '$1'),
            releaseVersion: version.replace('v', '')
        };

        if (fs.existsSync(releaseFilenameFor(version))) {
            response.render('_header', config, (headerError, header) => {
                if (headerError) { throw headerError; }
                response.render(releaseViewFor(version), config, (bodyError, body) => {
                    if (bodyError) { throw bodyError; }
                    response.render('_footer', config, (footerError, footer) => {
                        if (footerError) { throw footerError; }
                        response.send(header + body + footer);
                    });
                });
            });
        }
        else {
            response.status(404).send('No such release');
        }
    }

    return {
        getFeed,
        getReleases,
        getRelease
    };
}
