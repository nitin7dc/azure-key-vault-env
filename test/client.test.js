const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { SecretClient } = require('@azure/keyvault-secrets');

const keyVaultEnv = require('..');
const { resolveClient } = require('../lib/client');
const fakeVault = require('./helpers/fake-vault');
const isolateEnv = require('./helpers/isolate-env');

const { createClient } = keyVaultEnv;

isolateEnv('KEY_VAULT_URI', 'AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET', 'AZURE_AUTHORITY_HOST');

beforeEach(() => {

    process.env.AZURE_TENANT_ID = 'tenant-id';
    process.env.AZURE_CLIENT_ID = 'client-id';
    process.env.AZURE_CLIENT_SECRET = 'client-secret';

});

test('createClient fails with a clear message when there is no vault URI', () => {

    assert.throws(() => createClient(), /KEY_VAULT_URI environment variable or pass `vaultUri`/);

});

test('createClient fails with a clear message when sign-in is not configured', () => {

    process.env.KEY_VAULT_URI = 'https://from-env.vault.azure.net/';
    delete process.env.AZURE_TENANT_ID;
    delete process.env.AZURE_CLIENT_SECRET;

    assert.throws(() => createClient(), {
        message: 'Azure sign-in is not configured: set AZURE_TENANT_ID, AZURE_CLIENT_SECRET, or pass `credential`.'
    });

});

test('createClient needs no AZURE_* variables when a credential is passed', () => {

    delete process.env.AZURE_TENANT_ID;
    delete process.env.AZURE_CLIENT_ID;
    delete process.env.AZURE_CLIENT_SECRET;
    const credential = { getToken: async () => ({ token: 'token', expiresOnTimestamp: Date.now() + 60_000 }) };

    const client = createClient({ vaultUri: 'https://explicit.vault.azure.net/', credential });

    assert.ok(client instanceof SecretClient);

});

test('createClient uses KEY_VAULT_URI by default', () => {

    process.env.KEY_VAULT_URI = 'https://from-env.vault.azure.net/';

    const client = createClient();

    assert.ok(client instanceof SecretClient);
    assert.equal(client.vaultUrl, 'https://from-env.vault.azure.net/');

});

test('createClient prefers an explicit vaultUri', () => {

    process.env.KEY_VAULT_URI = 'https://from-env.vault.azure.net/';

    assert.equal(createClient({ vaultUri: 'https://explicit.vault.azure.net/' }).vaultUrl, 'https://explicit.vault.azure.net/');

});

test('keyVault is created on first access and then reused', () => {

    assert.throws(() => keyVaultEnv.keyVault, /KEY_VAULT_URI/);

    process.env.KEY_VAULT_URI = 'https://from-env.vault.azure.net/';
    const client = keyVaultEnv.keyVault;

    assert.ok(client instanceof SecretClient);
    assert.equal(keyVaultEnv.keyVault, client);

});

test('keyVault follows a changed KEY_VAULT_URI', () => {

    process.env.KEY_VAULT_URI = 'https://first.vault.azure.net/';
    const first = keyVaultEnv.keyVault;

    process.env.KEY_VAULT_URI = 'https://second.vault.azure.net/';

    assert.notEqual(keyVaultEnv.keyVault, first);
    assert.equal(keyVaultEnv.keyVault.vaultUrl, 'https://second.vault.azure.net/');

});

test('an explicit client wins over vaultUri and the default', () => {

    process.env.KEY_VAULT_URI = 'https://from-env.vault.azure.net/';
    const client = fakeVault();

    assert.equal(resolveClient({ client, vaultUri: 'https://explicit.vault.azure.net/' }), client);

});

test('vaultUri or credential builds a dedicated client', () => {

    process.env.KEY_VAULT_URI = 'https://from-env.vault.azure.net/';
    const credential = { getToken: async () => ({ token: 'token', expiresOnTimestamp: Date.now() + 60_000 }) };

    const byUri = resolveClient({ vaultUri: 'https://explicit.vault.azure.net/' });
    const byCredential = resolveClient({ credential });

    assert.equal(byUri.vaultUrl, 'https://explicit.vault.azure.net/');
    assert.equal(byCredential.vaultUrl, 'https://from-env.vault.azure.net/');
    assert.notEqual(byCredential, keyVaultEnv.keyVault);

});

test('without options the shared default client is used', () => {

    process.env.KEY_VAULT_URI = 'https://from-env.vault.azure.net/';

    assert.equal(resolveClient(), keyVaultEnv.keyVault);

});
