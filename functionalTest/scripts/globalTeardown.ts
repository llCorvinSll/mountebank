import * as child_process from 'child_process';

const port = process.env.MB_PORT || '2525';

async function startMb() {

    return new Promise((done, fail) => {

        child_process.spawn(
            "bin/mb",
            ['stop', '--port', port, '--pidfile', 'mb-grunt.pid', '--logfile', 'mb-grunt.log', '--allowInjection', '--mock', '--debug', '--localOnly'],
            {
                detached: true
            }
        )
    });
}

export default startMb
