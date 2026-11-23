const { test } = require('node:test');
const assert = require('node:assert/strict');

const { setup } = require('..');
const fakeVault = require('./helpers/fake-vault');
const isolateEnv = require('./helpers/isolate-env');

isolateEnv('KEY_VAULT_URI', 'AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET');

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

test('rejects a replacement collision before writing any secret', async () => {

    const client = fakeVault();

    const error = await setup({
        envKeys: {
            APP_DB_HOST: 'value-that-must-stay-secret',
            A_B: 'other-secret-value',
            A0xB: 'third-secret-value'
        },
        client
    }).then(() => assert.fail('setup should have rejected'), error => error);

    assert.equal(error.message, [
        'These environment variables map to the same key vault secret:',
        '  - A_B and A0xB both map to "A0xB"'
    ].join('\n'));
    assert.doesNotMatch(error.message, /value-that-must-stay-secret|other-secret-value|third-secret-value/);
    assert.deepEqual(client.writes, []);
    assert.equal(client.secrets.size, 0);

});

test('rejects a case-insensitive collision before writing any secret', async () => {

    const client = fakeVault();

    const error = await setup({
        envKeys: { db_host: 'value-that-must-stay-secret', DB_HOST: 'other-secret-value' },
        client
    }).then(() => assert.fail('setup should have rejected'), error => error);

    assert.equal(error.message, [
        'These environment variables map to the same key vault secret:',
        '  - db_host ("db0xhost") and DB_HOST ("DB0xHOST") are the same secret, because secret names are case-insensitive'
    ].join('\n'));
    assert.doesNotMatch(error.message, /value-that-must-stay-secret|other-secret-value/);
    assert.deepEqual(client.writes, []);
    assert.equal(client.secrets.size, 0);

});

test('reports every colliding group and every variable in a group before writing', async () => {

    const client = fakeVault();

    const error = await setup({
        envKeys: {
            AB: 'value-that-must-stay-secret',
            A_B: 'other-secret-value',
            A__B: 'third-secret-value',
            db_host: 'fourth-secret-value',
            DB_HOST: 'fifth-secret-value'
        },
        underscoreReplacedBy: '',
        client
    }).then(() => assert.fail('setup should have rejected'), error => error);

    assert.equal(error.message, [
        'These environment variables map to the same key vault secret:',
        '  - AB, A_B and A__B all map to "AB"',
        '  - db_host ("dbhost") and DB_HOST ("DBHOST") are the same secret, because secret names are case-insensitive'
    ].join('\n'));
    assert.doesNotMatch(error.message, /value-that-must-stay-secret|secret-value/);
    assert.deepEqual(client.writes, []);
    assert.equal(client.secrets.size, 0);

});

test('rejects a collision caused by a custom underscore replacement', async () => {

    const client = fakeVault();

    const error = await setup({
        envKeys: { A_B: 'value-that-must-stay-secret', 'A-B': 'other-secret-value' },
        underscoreReplacedBy: '-',
        client
    }).then(() => assert.fail('setup should have rejected'), error => error);

    assert.equal(error.message, [
        'These environment variables map to the same key vault secret:',
        '  - A_B and A-B both map to "A-B"'
    ].join('\n'));
    assert.doesNotMatch(error.message, /value-that-must-stay-secret|other-secret-value/);
    assert.deepEqual(client.writes, []);
    assert.equal(client.secrets.size, 0);

});

test('rejects secret names with characters key vault forbids before writing', async () => {

    const client = fakeVault();

    const error = await setup({
        envKeys: { APP_DB_HOST: 'value-that-must-stay-secret', 'APP.DB.PASS': 'other-secret-value' },
        client
    }).then(() => assert.fail('setup should have rejected'), error => error);

    assert.equal(error.message, [
        'Invalid key vault secret names. Names must match /^[0-9a-zA-Z-]{1,127}$/:',
        '  - APP.DB.PASS maps to "APP.DB.PASS"'
    ].join('\n'));
    assert.doesNotMatch(error.message, /value-that-must-stay-secret|other-secret-value/);
    assert.deepEqual(client.writes, []);
    assert.equal(client.secrets.size, 0);

});

test('rejects a prefix that puts an underscore in the secret name', async () => {

    const client = fakeVault();

    const error = await setup({
        envKeys: { APP_DB_HOST: 'value-that-must-stay-secret', APP_DB_PASS: 'other-secret-value' },
        prefix: 'my_',
        client
    }).then(() => assert.fail('setup should have rejected'), error => error);

    assert.equal(error.message, [
        'Invalid key vault secret names. Names must match /^[0-9a-zA-Z-]{1,127}$/:',
        '  - APP_DB_HOST maps to "my_APP0xDB0xHOST"',
        '  - APP_DB_PASS maps to "my_APP0xDB0xPASS"'
    ].join('\n'));
    assert.doesNotMatch(error.message, /value-that-must-stay-secret|other-secret-value/);
    assert.deepEqual(client.writes, []);
    assert.equal(client.secrets.size, 0);

});

test('rejects an underscore replacement that puts other invalid characters in the secret name', async () => {

    const client = fakeVault();

    const error = await setup({
        envKeys: { APP_DB_HOST: 'value-that-must-stay-secret' },
        underscoreReplacedBy: '.',
        client
    }).then(() => assert.fail('setup should have rejected'), error => error);

    assert.equal(error.message, [
        'Invalid key vault secret names. Names must match /^[0-9a-zA-Z-]{1,127}$/:',
        '  - APP_DB_HOST maps to "APP.DB.HOST"'
    ].join('\n'));
    assert.doesNotMatch(error.message, /value-that-must-stay-secret/);
    assert.deepEqual(client.writes, []);
    assert.equal(client.secrets.size, 0);

});

test('rejects a secret name longer than 127 characters before writing', async () => {

    const name = 'C'.repeat(128);
    const client = fakeVault();

    const error = await setup({
        envKeys: { APP_DB_HOST: 'value-that-must-stay-secret', [name]: 'other-secret-value' },
        client
    }).then(() => assert.fail('setup should have rejected'), error => error);

    assert.equal(name.length, 128);
    assert.equal(error.message, [
        'Invalid key vault secret names. Names must match /^[0-9a-zA-Z-]{1,127}$/:',
        `  - ${name} maps to "${name}"`
    ].join('\n'));
    assert.doesNotMatch(error.message, /value-that-must-stay-secret|other-secret-value/);
    assert.deepEqual(client.writes, []);
    assert.equal(client.secrets.size, 0);

});

test('rejects a prefix that pushes the secret name past 127 characters', async () => {

    const prefix = 'p'.repeat(120);
    const secretName = `${prefix}APP0xDB0xHOST`;
    const client = fakeVault();

    const error = await setup({
        envKeys: { APP_DB_HOST: 'value-that-must-stay-secret' },
        prefix,
        client
    }).then(() => assert.fail('setup should have rejected'), error => error);

    assert.equal(secretName.length, 133);
    assert.equal(error.message, [
        'Invalid key vault secret names. Names must match /^[0-9a-zA-Z-]{1,127}$/:',
        `  - APP_DB_HOST maps to "${secretName}"`
    ].join('\n'));
    assert.doesNotMatch(error.message, /value-that-must-stay-secret/);
    assert.deepEqual(client.writes, []);
    assert.equal(client.secrets.size, 0);

});

test('rejects an empty secret name', async () => {

    const client = fakeVault();

    const error = await setup({
        envKeys: { APP_DB_HOST: 'value-that-must-stay-secret', _: 'other-secret-value' },
        underscoreReplacedBy: '',
        client
    }).then(() => assert.fail('setup should have rejected'), error => error);

    assert.equal(error.message, [
        'Invalid key vault secret names. Names must match /^[0-9a-zA-Z-]{1,127}$/:',
        '  - _ maps to ""'
    ].join('\n'));
    assert.doesNotMatch(error.message, /value-that-must-stay-secret|other-secret-value/);
    assert.deepEqual(client.writes, []);
    assert.equal(client.secrets.size, 0);

});

test('accepts a mapped secret name of exactly 127 characters', async () => {

    const prefix = 'p'.repeat(123);
    const secretName = `${prefix}A0xB`;
    const client = fakeVault();

    assert.equal(secretName.length, 127);

    const result = await setup({ envKeys: { A_B: 'kept' }, prefix, client });

    assert.deepEqual(result, { saved: [secretName] });
    assert.deepEqual(client.writes, [secretName]);
    assert.equal(client.secrets.get(secretName), 'kept');

});
