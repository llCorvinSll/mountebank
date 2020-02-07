import * as childProcess from 'child_process';

const port = process.env.MB_PORT || '2525';

async function startMb () {

    return new Promise((done, fail) => {

        childProcess.spawn(
            'bin/mb',
            ['stop', '--port', port, '--pidfile', 'mb-grunt.pid', '--logfile', 'mb-jest.log', '--allowInjection', '--mock', '--debug', '--localOnly'],
            {
                detached: true
            }
        );
    });
}

export default startMb;
