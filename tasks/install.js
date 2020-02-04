'use strict';

const fs = require('fs-extra');
const run = require('./run').run;
const os = require('os');
const path = require('path');
const util = require('util');
const version = require('./version').getVersion();
// parent directory to avoid interaction with project node_modules
const testDir = '../.mb-test-dir';

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

    function failTask (task) {
        return function (exitCode) {
            grunt.warn(task + ' failed', exitCode);
        };
    }

    function setExecutableTo (mbPath) {
        process.env.MB_EXECUTABLE = mbPath;
        console.log('Setting MB_EXECUTABLE to ' + mbPath);
    }

    grunt.registerTask('install:tarball', 'Set test executable to mb inside OS-specific tarball', function (arch) {
        const done = this.async();
        const tarball = util.format('mountebank-v%s-%s-%s.tar.gz', version, os.platform(), arch || bitness());
        const tarballPath = path.join(testDir, tarball);

        fs.removeSync(testDir);
        fs.mkdirSync(testDir);
        fs.copySync('dist/' + tarball, tarballPath);

        run('tar', ['xzf', tarball], { cwd: testDir }).done(function () {
            fs.unlinkSync(tarballPath);
            setExecutableTo(tarballPath.replace('.tar.gz', '') + '/mb');
            done();
        }, failTask('install:tarball'));
    });

    grunt.registerTask('install:zip', 'Set test executable to mb inside Windows zip file', function (arch) {
        const done = this.async();
        const zipFile = util.format('mountebank-v%s-win-%s.zip', version, arch || bitness());
        const zipFilePath = path.resolve('dist', zipFile);
        const testDirPath = path.resolve(testDir);
        const command = util.format('[io.compression.zipfile]::ExtractToDirectory("%s","%s")',
            zipFilePath.replace(/\\/g, '\\\\'), testDirPath.replace(/\\/g, '\\\\'));

        fs.removeSync(testDir);
        fs.mkdirSync(testDir);

        run('powershell', ['-command', 'Add-Type', '-assembly', 'System.IO.Compression.FileSystem;', command]).done(function () {
            setExecutableTo(path.resolve(testDir, zipFile.replace('.zip', ''), 'mb.cmd'));
            done();
        }, failTask('install:zip'));
    });

    grunt.registerTask('install:npm', 'Set test executable to mb installed through local npm from tarball', function () {
        const done = this.async();
        const tarball = util.format('mountebank-v%s-npm.tar.gz', version);

        fs.removeSync(testDir);
        fs.mkdirSync(testDir);
        fs.copySync('dist/' + tarball, path.join(testDir, tarball));

        run('npm', ['install', './' + tarball], { cwd: testDir }).done(function () {
            setExecutableTo(testDir + '/node_modules/.bin/mb');
            done();
        }, failTask('install:npm'));
    });

    grunt.registerTask('install:pkg', 'Set test executable to mb installed in OSX pkg file', function () {
        const done = this.async();
        const pkg = util.format('mountebank-v%s.pkg', version);

        fs.removeSync(testDir);
        fs.mkdirSync(testDir);
        fs.copySync('dist/' + pkg, path.join(testDir, pkg));

        run('sudo', ['installer', '-pkg', pkg, '-target', '/'], { cwd: testDir }).done(function () {
            setExecutableTo('mb');
            done();
        }, failTask('install:pkg'));
    });

    grunt.registerTask('install:deb', 'Set test executable to mb installed in Debian file', function () {
        const done = this.async();
        const deb = util.format('mountebank_%s_amd64.deb', version);

        fs.removeSync(testDir);
        fs.mkdirSync(testDir);
        fs.copySync('dist/' + deb, path.join(testDir, deb));

        run('sudo', ['dpkg', '-i', deb], { cwd: testDir }).done(function () {
            setExecutableTo('mb');
            done();
        }, failTask('install:deb'));
    });

    grunt.registerTask('uninstall:deb', 'Verify uninstallation of Debian file', function () {
        const done = this.async();

        run('sudo', ['dpkg', '-r', 'mountebank'], { cwd: testDir }).done(function () {
            if (fs.existsSync('/usr/local/bin/mb')) {
                throw new Error('Uninstalling debian package did not remove /usr/local/bin/mb');
            }
            done();
        }, failTask('uninstall:deb'));
    });

    grunt.registerTask('install:rpm', 'Set test executable to mb installed in Red Hat package', function () {
        const done = this.async();
        const rpm = util.format('mountebank-%s-1.x86_64.rpm', version.replace('-', '_'));

        fs.removeSync(testDir);
        fs.mkdirSync(testDir);
        fs.copySync('dist/' + rpm, path.join(testDir, rpm));

        run('sudo', ['yum', '-y', '--nogpgcheck', 'localinstall', rpm], { cwd: testDir }).done(function () {
            setExecutableTo('mb');
            done();
        }, failTask('install:rpm'));
    });

    grunt.registerTask('uninstall:rpm', 'Verify uninstallation of Red Hat package', function () {
        const done = this.async();

        run('sudo', ['yum', 'remove', 'mountebank'], { cwd: testDir }).done(function () {
            if (fs.existsSync('/usr/local/bin/mb')) {
                throw new Error('Uninstalling Red Hat package did not remove /usr/local/bin/mb');
            }
            done();
        }, failTask('uninstall:rpm'));
    });
};
