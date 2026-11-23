const { test } = require('node:test');
const assert = require('node:assert/strict');

const { init, setup } = require('..');
const fakeVault = require('./helpers/fake-vault');
const isolateEnv = require('./helpers/isolate-env');

isolateEnv(
    'KEY_VAULT_URI',
    'AZURE_TENANT_ID',
    'AZURE_CLIENT_ID',
    'AZURE_CLIENT_SECRET',
    'APP_DB_HOST',
    'APP_DB_PASS',
    'APP_API_KEY',
    'A_B',
    'A0xB',
    'A-B',
    'AB',
    'A__B',
    'db_host',
    'DB_HOST',
    'APP.DB.PASS',
    '_'
);

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

test('rejects a replacement collision before reading any secret', async () => {

    const client = fakeVault({ APP0xDB0xHOST: 'from-the-vault', A0xB: 'from-the-vault' });

    const error = await init({
        envKeys: {
            APP_DB_HOST: 'value-that-must-stay-secret',
            A_B: 'other-secret-value',
            A0xB: 'third-secret-value'
        },
        client
    }).then(() => assert.fail('init should have rejected'), error => error);

    assert.equal(error.message, [
        'These environment variables map to the same key vault secret:',
        '  - A_B and A0xB both map to "A0xB"'
    ].join('\n'));
    assert.doesNotMatch(error.message, /value-that-must-stay-secret|other-secret-value|third-secret-value|from-the-vault/);
    assert.deepEqual(client.reads, []);
    assert.equal(process.env.APP_DB_HOST, undefined);
    assert.equal(process.env.A_B, undefined);
    assert.equal(process.env.A0xB, undefined);

});

test('rejects a case-insensitive collision before reading any secret', async () => {

    const client = fakeVault({ db0xhost: 'from-the-vault', DB0xHOST: 'from-the-vault' });

    const error = await init({
        envKeys: { db_host: 'value-that-must-stay-secret', DB_HOST: 'other-secret-value' },
        client
    }).then(() => assert.fail('init should have rejected'), error => error);

    assert.equal(error.message, [
        'These environment variables map to the same key vault secret:',
        '  - db_host ("db0xhost") and DB_HOST ("DB0xHOST") are the same secret, because secret names are case-insensitive'
    ].join('\n'));
    assert.doesNotMatch(error.message, /value-that-must-stay-secret|other-secret-value|from-the-vault/);
    assert.deepEqual(client.reads, []);
    assert.equal(process.env.db_host, undefined);
    assert.equal(process.env.DB_HOST, undefined);

});

test('reports every colliding group before reading any secret', async () => {

    const client = fakeVault();

    const error = await init({
        envKeys: {
            APP_DB_HOST: 'value-that-must-stay-secret',
            A_B: 'other-secret-value',
            A0xB: 'third-secret-value',
            db_host: 'fourth-secret-value',
            DB_HOST: 'fifth-secret-value'
        },
        client
    }).then(() => assert.fail('init should have rejected'), error => error);

    assert.equal(error.message, [
        'These environment variables map to the same key vault secret:',
        '  - A_B and A0xB both map to "A0xB"',
        '  - db_host ("db0xhost") and DB_HOST ("DB0xHOST") are the same secret, because secret names are case-insensitive'
    ].join('\n'));
    assert.doesNotMatch(error.message, /value-that-must-stay-secret|secret-value|from-the-vault/);
    assert.deepEqual(client.reads, []);
    assert.equal(process.env.APP_DB_HOST, undefined);

});

test('rejects a collision that includes a variable already set in the environment', async () => {

    process.env.DB_HOST = 'localhost';
    const messages = [];
    const logger = {
        debug: message => messages.push(message),
        info: message => messages.push(message)
    };
    const client = fakeVault({ db0xhost: 'from-the-vault', DB0xHOST: 'from-the-vault' });

    const error = await init({
        envKeys: { db_host: 'value-that-must-stay-secret', DB_HOST: '' },
        client,
        logger
    }).then(() => assert.fail('init should have rejected'), error => error);

    assert.equal(error.message, [
        'These environment variables map to the same key vault secret:',
        '  - db_host ("db0xhost") and DB_HOST ("DB0xHOST") are the same secret, because secret names are case-insensitive'
    ].join('\n'));
    assert.doesNotMatch(error.message, /value-that-must-stay-secret|from-the-vault|localhost/);
    assert.deepEqual(messages, []);
    assert.deepEqual(client.reads, []);
    assert.equal(process.env.db_host, undefined);
    assert.equal(process.env.DB_HOST, 'localhost');

});

test('rejects colliding names when useLocalEnv is set', async () => {

    process.env.A_B = 'kept-locally';
    process.env.A0xB = 'also-kept';

    const error = await init({
        envKeys: { A_B: '', A0xB: '' },
        useLocalEnv: true
    }).then(() => assert.fail('init should have rejected'), error => error);

    assert.equal(error.message, [
        'These environment variables map to the same key vault secret:',
        '  - A_B and A0xB both map to "A0xB"'
    ].join('\n'));
    assert.equal(process.env.A_B, 'kept-locally');
    assert.equal(process.env.A0xB, 'also-kept');

});

test('rejects a collision caused by a custom underscore replacement', async () => {

    const client = fakeVault({ 'A-B': 'from-the-vault' });

    const error = await init({
        envKeys: { A_B: 'value-that-must-stay-secret', 'A-B': 'other-secret-value' },
        underscoreReplacedBy: '-',
        client
    }).then(() => assert.fail('init should have rejected'), error => error);

    assert.equal(error.message, [
        'These environment variables map to the same key vault secret:',
        '  - A_B and A-B both map to "A-B"'
    ].join('\n'));
    assert.doesNotMatch(error.message, /value-that-must-stay-secret|other-secret-value|from-the-vault/);
    assert.deepEqual(client.reads, []);

});

test('rejects secret names with characters key vault forbids before reading', async () => {

    const client = fakeVault({ APP0xDB0xHOST: 'from-the-vault' });

    const error = await init({
        envKeys: { APP_DB_HOST: 'value-that-must-stay-secret', 'APP.DB.PASS': 'other-secret-value' },
        client
    }).then(() => assert.fail('init should have rejected'), error => error);

    assert.equal(error.message, [
        'Invalid key vault secret names. Names must match /^[0-9a-zA-Z-]{1,127}$/:',
        '  - APP.DB.PASS maps to "APP.DB.PASS"'
    ].join('\n'));
    assert.doesNotMatch(error.message, /value-that-must-stay-secret|other-secret-value|from-the-vault/);
    assert.deepEqual(client.reads, []);
    assert.equal(process.env.APP_DB_HOST, undefined);
    assert.equal(process.env['APP.DB.PASS'], undefined);

});

test('rejects a prefix that puts an underscore in the secret name', async () => {

    const client = fakeVault();

    const error = await init({
        envKeys: { APP_DB_HOST: 'value-that-must-stay-secret', APP_DB_PASS: 'other-secret-value' },
        prefix: 'my_',
        client
    }).then(() => assert.fail('init should have rejected'), error => error);

    assert.equal(error.message, [
        'Invalid key vault secret names. Names must match /^[0-9a-zA-Z-]{1,127}$/:',
        '  - APP_DB_HOST maps to "my_APP0xDB0xHOST"',
        '  - APP_DB_PASS maps to "my_APP0xDB0xPASS"'
    ].join('\n'));
    assert.doesNotMatch(error.message, /value-that-must-stay-secret|other-secret-value/);
    assert.deepEqual(client.reads, []);

});

test('rejects an underscore replacement that puts other invalid characters in the secret name', async () => {

    const client = fakeVault();

    const error = await init({
        envKeys: { APP_DB_HOST: 'value-that-must-stay-secret' },
        underscoreReplacedBy: '.',
        client
    }).then(() => assert.fail('init should have rejected'), error => error);

    assert.equal(error.message, [
        'Invalid key vault secret names. Names must match /^[0-9a-zA-Z-]{1,127}$/:',
        '  - APP_DB_HOST maps to "APP.DB.HOST"'
    ].join('\n'));
    assert.doesNotMatch(error.message, /value-that-must-stay-secret/);
    assert.deepEqual(client.reads, []);

});

test('rejects a secret name longer than 127 characters before reading', async () => {

    const name = 'C'.repeat(128);
    const client = fakeVault({ APP0xDB0xHOST: 'from-the-vault' });

    const error = await init({
        envKeys: { APP_DB_HOST: 'value-that-must-stay-secret', [name]: 'other-secret-value' },
        client
    }).then(() => assert.fail('init should have rejected'), error => error);

    assert.equal(error.message, [
        'Invalid key vault secret names. Names must match /^[0-9a-zA-Z-]{1,127}$/:',
        `  - ${name} maps to "${name}"`
    ].join('\n'));
    assert.equal(name.length, 128);
    assert.doesNotMatch(error.message, /value-that-must-stay-secret|other-secret-value|from-the-vault/);
    assert.deepEqual(client.reads, []);
    assert.equal(process.env.APP_DB_HOST, undefined);
    assert.equal(process.env[name], undefined);

});

test('rejects a prefix that pushes the secret name past 127 characters', async () => {

    const prefix = 'p'.repeat(120);
    const secretName = `${prefix}APP0xDB0xHOST`;
    const client = fakeVault();

    const error = await init({
        envKeys: { APP_DB_HOST: 'value-that-must-stay-secret' },
        prefix,
        client
    }).then(() => assert.fail('init should have rejected'), error => error);

    assert.equal(secretName.length, 133);
    assert.equal(error.message, [
        'Invalid key vault secret names. Names must match /^[0-9a-zA-Z-]{1,127}$/:',
        `  - APP_DB_HOST maps to "${secretName}"`
    ].join('\n'));
    assert.doesNotMatch(error.message, /value-that-must-stay-secret/);
    assert.deepEqual(client.reads, []);

});

test('rejects an empty secret name', async () => {

    const client = fakeVault();

    const error = await init({
        envKeys: { APP_DB_HOST: 'value-that-must-stay-secret', _: 'other-secret-value' },
        underscoreReplacedBy: '',
        client
    }).then(() => assert.fail('init should have rejected'), error => error);

    assert.equal(error.message, [
        'Invalid key vault secret names. Names must match /^[0-9a-zA-Z-]{1,127}$/:',
        '  - _ maps to ""'
    ].join('\n'));
    assert.doesNotMatch(error.message, /value-that-must-stay-secret|other-secret-value/);
    assert.deepEqual(client.reads, []);
    assert.equal(process.env.APP_DB_HOST, undefined);
    assert.equal(process.env._, undefined);

});

test('accepts a mapped secret name of exactly 127 characters', async () => {

    const prefix = 'p'.repeat(123);
    const secretName = `${prefix}A0xB`;
    const client = fakeVault({ [secretName]: 'kept' });

    assert.equal(secretName.length, 127);

    const result = await init({ envKeys: { A_B: '' }, prefix, client });

    assert.deepEqual(client.reads, [secretName]);
    assert.equal(process.env.A_B, 'kept');
    assert.deepEqual(result, { loaded: ['A_B'], skipped: [] });

});
