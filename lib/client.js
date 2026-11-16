const createCredential = require('./credential');

let defaultClient;
let defaultClientUri;

/**
 * Create a key-vault secret client.
 *
 * @param {object} [options]
 * @param {string} [options.vaultUri] defaults to `process.env.KEY_VAULT_URI`
 * @param {object} [options.credential] defaults to signing in with the `AZURE_*` variables
 * @returns {object} a `SecretClient` from `@azure/keyvault-secrets`
 */
function createClient ({ vaultUri = process.env.KEY_VAULT_URI, credential } = {}) {

    if (!vaultUri) {

        throw new Error(
            'Key vault URI is missing: set the KEY_VAULT_URI environment variable or pass `vaultUri`.'
        );

    }

    credential ??= createCredential();

    // Required here rather than at the top of the file, so an app that never
    // reaches the vault (e.g. `useLocalEnv`) does not pay for loading the Azure SDK.
    const { SecretClient } = require('@azure/keyvault-secrets');

    return new SecretClient(vaultUri, credential);

}

/**
 * The shared client built from `KEY_VAULT_URI`, created on first use and
 * reused afterwards so its token cache survives between calls.
 *
 * @returns {object} a `SecretClient` from `@azure/keyvault-secrets`
 */
function getDefaultClient () {

    const vaultUri = process.env.KEY_VAULT_URI;

    if (!defaultClient || defaultClientUri !== vaultUri) {

        defaultClient = createClient({ vaultUri });
        defaultClientUri = vaultUri;

    }

    return defaultClient;

}

/**
 * Pick the client for an `init` / `setup` call: an explicit `client` wins,
 * then a client built from `vaultUri` / `credential`, then the shared default.
 */
function resolveClient ({ client, vaultUri, credential } = {}) {

    if (client) {

        return client;

    }

    if (vaultUri || credential) {

        return createClient({ vaultUri, credential });

    }

    return getDefaultClient();

}

module.exports = { createClient, getDefaultClient, resolveClient };
