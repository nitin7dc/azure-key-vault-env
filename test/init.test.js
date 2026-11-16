const { test } = require('node:test');
const assert = require('node:assert/strict');

const { init, setup } = require('..');
const fakeVault = require('./helpers/fake-vault');
const isolateEnv = require('./helpers/isolate-env');

isolateEnv('KEY_VAULT_URI', 'AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET', 'APP_DB_HOST', 'APP_DB_PASS', 'APP_API_KEY');

test('loads missing variables from the vault', async () => {

    const client = fakeVault({ APP0xDB0xHOST: 'db.internal', APP0xDB0xPASS: 's3cret' });

    const result = await init({ envKeys: { APP_DB_HOST: '', APP_DB_PASS: '' }, client });

    assert.equal(process.env.APP_DB_HOST, 'db.internal');
    assert.equal(process.env.APP_DB_PASS, 's3cret');
    assert.deepEqual(result, { loaded: ['APP_DB_HOST', 'APP_DB_PASS'], skipped: [] });

});

test('leaves variables that already have a value alone', async () => {

    process.env.APP_DB_HOST = 'localhost';
    const client = fakeVault({ APP0xDB0xHOST: 'db.internal', APP0xDB0xPASS: 's3cret' });

    const result = await init({ envKeys: { APP_DB_HOST: '', APP_DB_PASS: '' }, client });

    assert.equal(process.env.APP_DB_HOST, 'localhost');
    assert.deepEqual(client.reads, ['APP0xDB0xPASS']);
    assert.deepEqual(result, { loaded: ['APP_DB_PASS'], skipped: ['APP_DB_HOST'] });

});

test('treats an empty variable as missing', async () => {

    process.env.APP_DB_HOST = '';
    const client = fakeVault({ APP0xDB0xHOST: 'db.internal' });

    await init({ envKeys: { APP_DB_HOST: '' }, client });

    assert.equal(process.env.APP_DB_HOST, 'db.internal');

});

test('reads back what setup saved under a prefix', async () => {

    const client = fakeVault();
    const options = { prefix: 'staging-', client };

    await setup({ envKeys: { APP_DB_HOST: 'db.staging', APP_API_KEY: 'key-123' }, ...options });
    await init({ envKeys: { APP_DB_HOST: '', APP_API_KEY: '' }, ...options });

    assert.deepEqual(client.reads, ['staging-APP0xDB0xHOST', 'staging-APP0xAPI0xKEY']);
    assert.equal(process.env.APP_DB_HOST, 'db.staging');
    assert.equal(process.env.APP_API_KEY, 'key-123');

});

test('honours underscoreReplacedBy', async () => {

    const client = fakeVault({ 'APP-DB-HOST': 'db.internal' });

    await init({ envKeys: { APP_DB_HOST: '' }, underscoreReplacedBy: '-', client });

    assert.equal(process.env.APP_DB_HOST, 'db.internal');

});

test('rejects instead of exiting, naming every variable that failed', async t => {

    const exit = t.mock.method(process, 'exit', () => {});
    const client = fakeVault({ APP0xDB0xHOST: 'db.internal' });

    const error = await init({ envKeys: { APP_DB_HOST: '', APP_DB_PASS: '', APP_API_KEY: '' }, client })
        .then(() => assert.fail('init should have rejected'), error => error);

    assert.equal(exit.mock.callCount(), 0);
    assert.ok(error instanceof AggregateError);
    assert.equal(error.message, [
        'Failed to load 2 of 3 environment variables from key-vault:',
        '  - APP_DB_PASS (secret "APP0xDB0xPASS"): A secret with (name/id) APP0xDB0xPASS was not found in this key vault.',
        '  - APP_API_KEY (secret "APP0xAPI0xKEY"): A secret with (name/id) APP0xAPI0xKEY was not found in this key vault.'
    ].join('\n'));
    assert.equal(error.errors.length, 2);
    assert.equal(error.errors[0].cause.code, 'SecretNotFound');

});

test('writes nothing to process.env when any variable fails', async () => {

    const client = fakeVault({ APP0xDB0xHOST: 'db.internal' });

    await assert.rejects(init({ envKeys: { APP_DB_HOST: '', APP_DB_PASS: '' }, client }));

    assert.equal(process.env.APP_DB_HOST, undefined);
    assert.equal(process.env.APP_DB_PASS, undefined);

});

test('fails when a secret has no value', async () => {

    const client = { getSecret: async name => ({ name, value: undefined }) };

    await assert.rejects(
        init({ envKeys: { APP_DB_HOST: '' }, client }),
        /APP_DB_HOST \(secret "APP0xDB0xHOST"\): secret has no value/
    );
    assert.equal(process.env.APP_DB_HOST, undefined);

});

test('useLocalEnv never calls the vault and lists every missing variable', async () => {

    process.env.APP_DB_HOST = 'localhost';
    const client = fakeVault({ APP0xDB0xPASS: 's3cret', APP0xAPI0xKEY: 'key-123' });

    await assert.rejects(
        init({ envKeys: { APP_DB_HOST: '', APP_DB_PASS: '', APP_API_KEY: '' }, useLocalEnv: true, client }),
        { message: 'Missing environment variables: APP_DB_PASS, APP_API_KEY' }
    );
    assert.deepEqual(client.reads, []);

});

test('useLocalEnv passes without any vault configuration when everything is set', async () => {

    process.env.APP_DB_HOST = 'localhost';

    const result = await init({ envKeys: { APP_DB_HOST: '' }, useLocalEnv: true });

    assert.deepEqual(result, { loaded: [], skipped: ['APP_DB_HOST'] });

});

test('needs no vault configuration when every variable is already set', async () => {

    process.env.APP_DB_HOST = 'localhost';

    const result = await init({ envKeys: { APP_DB_HOST: '' } });

    assert.deepEqual(result, { loaded: [], skipped: ['APP_DB_HOST'] });

});

test('fails with a clear message when the vault URI is missing', async () => {

    await assert.rejects(init({ envKeys: { APP_DB_HOST: '' } }), /KEY_VAULT_URI/);

});

test('resolves when called without arguments', async () => {

    assert.deepEqual(await init(), { loaded: [], skipped: [] });

});

test('is silent by default', async t => {

    const methods = ['log', 'info', 'debug', 'warn', 'error'].map(name => t.mock.method(console, name, () => {}));
    process.env.APP_DB_HOST = 'localhost';

    await init({ envKeys: { APP_DB_HOST: '', APP_DB_PASS: '' }, client: fakeVault({ APP0xDB0xPASS: 's3cret' }) });

    assert.deepEqual(methods.map(method => method.mock.callCount()), [0, 0, 0, 0, 0]);

});

test('reports progress to the given logger without leaking values', async () => {

    const messages = [];
    const logger = { debug: message => messages.push(message), info: message => messages.push(message) };
    process.env.APP_DB_HOST = 'localhost';

    await init({ envKeys: { APP_DB_HOST: '', APP_DB_PASS: '' }, client: fakeVault({ APP0xDB0xPASS: 's3cret' }), logger });

    assert.deepEqual(messages, [
        'APP_DB_HOST is already set, skipping',
        'loaded 1 environment variables from key-vault, 1 already set'
    ]);

});
