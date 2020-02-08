import * as Q from 'q';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { exec } from 'child_process';
import { BaseHttpClient } from './api/http/baseHttpClient';
const httpClient = new BaseHttpClient('http');
const isWindows = require('os').platform().indexOf('win') === 0;
const mbPath = process.env.MB_EXECUTABLE || path.join(__dirname, '/../bin/mb');
const pidfile = 'test.pid';
const logfile = 'mb-test.log';

function create (port: number, includeStdout: boolean) {

    let host = 'localhost';

    function whenFullyInitialized (operation: string, callback: Function) {
        let count = 0;
        const pidfileMustExist = operation === 'start';
        const spinWait = () => {
            count += 1;
            if (count > 20) {
                console.log(`ERROR: mb ${operation} not initialized after 2 seconds`);
                callback({});
            }
            else if (fs.existsSync(pidfile) === pidfileMustExist) {
                callback({});
            }
            else {
                Q.delay(100).done(spinWait);
            }
        };

        spinWait();
    }

    function spawnMb (args: string[]) {
        let command = mbPath;

        if (isWindows) {
            args.unshift(mbPath);

            if (mbPath.indexOf('.cmd') >= 0) {
                //Accommodate the self-contained Windows zip files that ship with mountebank
                args.unshift('/c');
                command = 'cmd';
            }
            else {
                command = 'node';
            }
        }

        const result = spawn(command, args);
        result.stderr.on('data', (data: any) => {
            console.log(data.toString('utf8'));
        });
        if (includeStdout) {
            result.stdout.on('data', (data: any) => {
                console.log(data.toString('utf8'));
            });
        }
        return result;
    }

    function start (args: string[]) {
        const deferred = Q.defer();
        const mbArgs = ['restart', '--port', `${port}`, '--logfile', logfile, '--pidfile', pidfile].concat(args || []);
        const hostIndex = mbArgs.indexOf('--host');

        if (hostIndex >= 0) {
            host = mbArgs[hostIndex + 1];
        }
        else {
            host = 'localhost';
        }

        whenFullyInitialized('start', deferred.resolve);
        const mb = spawnMb(mbArgs);
        mb.on('error', deferred.reject);

        return deferred.promise;
    }

    function stop () {
        const deferred = Q.defer();
        let command = `${mbPath} stop --pidfile ${pidfile}`;

        if (isWindows && mbPath.indexOf('.cmd') < 0) {
            command = `node ${command}`;
        }
        exec(command, (error, stdout, stderr) => {
            if (error) { throw error; }
            if (stdout) { console.log(stdout); }
            if (stderr) { console.error(stderr); }

            whenFullyInitialized('stop', deferred.resolve);
        });

        return deferred.promise;
    }

    //Can't simply call mb restart
    //The start function relies on whenFullyInitialized to wait for the pidfile to already exist
    //If it already does exist, and you're expecting mb restart to kill it, the function will
    //return before you're ready for it
    function restart (args: string[]) {
        return stop().then(() => start(args));
    }

    function execCommand (command: string, args: string[]) {
        const deferred = Q.defer();
        const mbArgs = [command, '--port', `${port}`].concat(args || []);
        let stdout = '';
        let stderr = '';
        const mb = spawnMb(mbArgs);

        mb.on('error', deferred.reject);
        mb.stdout.on('data', (chunk: any) => { stdout += chunk; });
        mb.stderr.on('data', (chunk: any) => { stderr += chunk; });
        mb.on('close', (exitCode: any) => {
            deferred.resolve({
                exitCode: exitCode,
                stdout: stdout,
                stderr: stderr
            });
        });

        return deferred.promise;
    }

    function save (args: string[]) {
        return execCommand('save', args);
    }

    function replay (args: string[]) {
        return execCommand('replay', args);
    }

    function get (endpoint: string) {
        return httpClient.responseFor({ method: 'GET', path: endpoint, port, hostname: host });
    }

    function post (endpoint: string, body: any) {
        return httpClient.responseFor({ method: 'POST', path: endpoint, port, body, hostname: host });
    }

    function put (endpoint: string, body: any) {
        return httpClient.responseFor({ method: 'PUT', path: endpoint, port, body, hostname: host });
    }

    return { port, url: `http://localhost:${port}`, start, restart, stop, save, get, post, put, replay };
}

module.exports = { create };
