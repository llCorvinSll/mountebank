'use strict';

import { Request, Response } from 'express';
import {IRelease} from "../models/IMountebankOptions";

/**
 * The controller that returns the base mountebank hypermedia
 * @module
 */

interface IReleaseNotice {
    version: string;
    when: string;
}

/**
 * Creates the home controller
 * @param {Object} releases - The releases.json file
 * @returns {Object} The controller
 */
export function create (releases: IRelease[]) {
    function createNotice (release: IRelease) {
        const date = require('../util/date');
        return <IReleaseNotice>{
            version: release.version,
            when: date.howLongAgo(release.date)
        };
    }

    const isRecent = (notice:IReleaseNotice) => notice.when !== '';

    /**
     * The function that responds to GET /
     * @memberOf module:controllers/homeController#
     * @param {Object} request - the HTTP request
     * @param {Object} response - the HTTP response
     */
    function get (request: Request, response: Response) {
        const hypermedia = {
                _links: {
                    imposters: { href: '/imposters' },
                    config: { href: '/config' },
                    logs: { href: '/logs' }
                }
            },
            notices = releases.map(createNotice).filter(isRecent),
            viewNotices:IReleaseNotice[] = [];

        if (notices.length > 0) {
            notices.reverse();
            viewNotices.push(notices[0]);
        }

        response.format({
            json: () => { response.send(hypermedia); },
            html: () => { response.render('index', { notices: viewNotices }); }
        });
    }

    return { get };
}
