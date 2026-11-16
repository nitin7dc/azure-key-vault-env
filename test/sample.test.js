const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const packageRoot = path.resolve(__dirname, '..');
const withoutAzure = path.join(__dirname, 'helpers', 'without-azure.js');

/** Run sample.js in its own process, with only the given variables set. */
function runSample (env, ...nodeOptions) {

    return spawnSync(process.execPath, [...nodeOptions, 'sample.js'], {
        cwd: packageRoot,
        env: { PATH: process.env.PATH, ...env },
        encoding: 'utf8'
    });

}

test('sample.js saves two variables and loads them back', () => {

    const child = runSample({
        KEY_VAULT_URI: 'https://my-vault.vault.azure.net/',
        AZURE_TENANT_ID: 'tenant-id',
        AZURE_CLIENT_ID: 'client-id',
        AZURE_CLIENT_SECRET: 'client-s3cret'
    }, '--require', withoutAzure);

    assert.equal(child.stderr, '');
    assert.equal(child.status, 0);
    assert.deepEqual(child.stdout.trimEnd().split('\n'), [
        'Saving two sample variables to Key Vault',
        'SAMPLE0xDB0xHOST saved',
        'SAMPLE0xDB0xPASS saved',
        'Loading them into process.env',
        'loaded 2 environment variables from key-vault, 0 already set',
        'SAMPLE_DB_HOST = db.example.com',
        'SAMPLE_DB_PASS = a-long-password'
    ]);

});

test('sample.js says what is missing when it is not configured', () => {

    const child = runSample({});

    assert.equal(child.status, 1);
    assert.equal(child.stdout, 'Saving two sample variables to Key Vault\n');
    assert.match(child.stderr, /^Key vault URI is missing: set the KEY_VAULT_URI environment variable/);

});
