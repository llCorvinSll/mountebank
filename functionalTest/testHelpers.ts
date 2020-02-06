

import * as fs from 'fs';


// Like mocha-as-promised, but more explicit.
// Many times I'd forget to add the errback, making
// tests harder to fix when they failed because I'd
// miss the assertion message.
function wrap (test: any, that: { name: string }): any {
    return (done: any) => test.apply(that, []).done(() => { done(); }, done);
}

export function promiseIt (what: string, test: any) {
    return it(what, wrap(test, { name: what }));
}

promiseIt.only = (what: string, test: any) => it.only(what, wrap(test, { name: what }));

export function xpromiseIt () {}
xpromiseIt.only = () => {};

export function isOutOfProcessImposter (protocol: string): boolean {
    if (fs.existsSync('protocols.json')) {
        const protocols = require(process.cwd() + '/protocols.json');
        return Object.keys(protocols).indexOf(protocol) >= 0;
    }
    else {
        return false;
    }
}

export function isInProcessImposter (protocol: string): boolean {
    return !isOutOfProcessImposter(protocol);
}
