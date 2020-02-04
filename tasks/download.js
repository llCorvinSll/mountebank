'use strict';

const fs = require('fs-extra');
const Q = require('q');
const https = require('https');
const os = require('os');
const util = require('util');
const version = require('./version').getVersion();
const versionMajorMinor = version.replace(/\.\d+(-beta\.\d+)?$/, '');
const urlPrefix = 'https://s3.amazonaws.com/mountebank/v' + versionMajorMinor;

function download (file, destination) {
    const deferred = Q.defer();
    const stream = fs.createWriteStream(destination);
    const url = urlPrefix + '/' + encodeURIComponent(file);

    console.log(url + ' => ' + destination);
    stream.on('open', function () {
        https.get(url, function (response) {
            response.pipe(stream);
            response.on('error', deferred.reject);
        });
    });
    stream.on('finish', function () {
        stream.close(deferred.resolve);
    });
    stream.on('error', deferred.reject);

    return deferred.promise;
}

function bitness () {
    if (os.arch() === 'x64') {
        return 'x64';
    }
    else {
        // avoid "ia32" result on windows
        return 'x86';
    }
}

module.exports = function (grunt) {

    grunt.registerTask('download:zip', 'Download this version of the Windows zip file', function (arch) {
        const zipFile = util.format('mountebank-v%s-win-%s.zip', version, arch || bitness());

        if (!fs.existsSync('dist')) {
            fs.mkdirSync('dist');
        }
        download(zipFile, 'dist/' + zipFile).done(this.async(), grunt.warn);
    });

    grunt.registerTask('download:rpm', 'Download this version of the rpm', function () {
        const rpmFile = util.format('mountebank-%s-1.x86_64.rpm', version.replace('-', '_'));

        if (!fs.existsSync('dist')) {
            fs.mkdirSync('dist');
        }
        download(rpmFile, 'dist/' + rpmFile).done(this.async(), grunt.warn);
    });
};
