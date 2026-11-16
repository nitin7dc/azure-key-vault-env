const { test } = require('node:test');
const assert = require('node:assert/strict');

const { setup } = require('..');
const fakeVault = require('./helpers/fake-vault');
const isolateEnv = require('./helpers/isolate-env');

isolateEnv('KEY_VAULT_URI');

test('saves each variable under its secret name, in order', async () => {

    const client = fakeVault();

    const result = await setup({ envKeys: { APP_DB_HOST: 'db.internal', APP_DB_PASS: 's3cret' }, client });

    assert.deepEqual(Object.fromEntries(client.secrets), { APP0xDB0xHOST: 'db.internal', APP0xDB0xPASS: 's3cret' });
    assert.deepEqual(client.writes, ['APP0xDB0xHOST', 'APP0xDB0xPASS']);
    assert.deepEqual(result, { saved: ['APP0xDB0xHOST', 'APP0xDB0xPASS'] });

});

test('applies prefix and underscoreReplacedBy', async () => {

    const client = fakeVault();

    await setup({ envKeys: { APP_DB_HOST: 'db.internal' }, prefix: 'staging-', underscoreReplacedBy: '-', client });

    assert.deepEqual(Object.fromEntries(client.secrets), { 'staging-APP-DB-HOST': 'db.internal' });

});

test('stops at the first failure and says how far it got', async () => {

    const client = fakeVault();
    const refusal = Object.assign(new Error('Forbidden\nCaller is not authorized'), { statusCode: 403 });
    client.setSecret = async name => {

        if (name === 'APP0xDB0xPASS') {

            throw refusal;

        }

        client.writes.push(name);

    };

    const error = await setup({ envKeys: { APP_DB_HOST: 'a', APP_DB_PASS: 'b', APP_API_KEY: 'c' }, client })
        .then(() => assert.fail('setup should have rejected'), error => error);

    assert.equal(error.message, 'Failed to save APP_DB_PASS as secret "APP0xDB0xPASS" (1 of 3 saved): Forbidden');
    assert.equal(error.cause, refusal);
    assert.deepEqual(client.writes, ['APP0xDB0xHOST']);

});

test('does nothing, and needs no vault configuration, without variables', async () => {

    assert.deepEqual(await setup(), { saved: [] });

});

test('fails with a clear message when the vault URI is missing', async () => {

    await assert.rejects(setup({ envKeys: { APP_DB_HOST: 'db.internal' } }), /KEY_VAULT_URI/);

});

test('is silent by default', async t => {

    const methods = ['log', 'info', 'debug', 'warn', 'error'].map(name => t.mock.method(console, name, () => {}));

    await setup({ envKeys: { APP_DB_HOST: 'db.internal' }, client: fakeVault() });

    assert.deepEqual(methods.map(method => method.mock.callCount()), [0, 0, 0, 0, 0]);

});

test('reports progress to the given logger without leaking values', async () => {

    const messages = [];
    const logger = { info: message => messages.push(message) };

    await setup({ envKeys: { APP_DB_HOST: 'db.internal', APP_DB_PASS: 's3cret' }, client: fakeVault(), logger });

    assert.deepEqual(messages, ['APP0xDB0xHOST saved', 'APP0xDB0xPASS saved']);

});
