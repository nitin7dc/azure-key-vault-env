const { beforeEach, afterEach } = require('node:test');

/**
 * Give every test in the file a clean `process.env`: the listed variables
 * are removed before each test and the original environment is restored after.
 */
function isolateEnv (...names) {

    let snapshot;

    beforeEach(() => {

        snapshot = { ...process.env };
        names.forEach(name => delete process.env[name]);

    });

    afterEach(() => {

        Object.keys(process.env).forEach(name => delete process.env[name]);
        Object.assign(process.env, snapshot);

    });

}

module.exports = isolateEnv;
