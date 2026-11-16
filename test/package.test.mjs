import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// Imported by package name, so these go through the `exports` map like a consumer would.
import keyVaultEnv, { init, setup, createClient } from 'azure-key-vault-env';

const require = createRequire(import.meta.url);

test('ES modules get named and default exports', () => {

    assert.equal(typeof init, 'function');
    assert.equal(typeof setup, 'function');
    assert.equal(typeof createClient, 'function');
    assert.equal(keyVaultEnv.init, init);
    assert.equal(keyVaultEnv.setup, setup);
    assert.equal(keyVaultEnv.createClient, createClient);

});

test('require gets the same module', () => {

    assert.equal(require('azure-key-vault-env'), keyVaultEnv);

});

test('internal files cannot be imported', () => {

    assert.throws(() => require('azure-key-vault-env/lib/init'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });

});
