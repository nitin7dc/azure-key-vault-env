const { resolveClient } = require('./client');
const summarize = require('./summarize');
const toSecretName = require('./secret-name');

/**
 * Save environment variables to key-vault, one secret per variable.
 *
 * @param {object} [options]
 * @param {object} [options.envKeys] variable names mapped to the values to save
 * @param {string} [options.underscoreReplacedBy]
 * @param {string} [options.prefix] secret name prefix; pass the same one to `init`
 * @param {object} [options.client] ready-made secret client
 * @param {string} [options.vaultUri] defaults to `process.env.KEY_VAULT_URI`
 * @param {object} [options.credential] defaults to signing in with the `AZURE_*` variables
 * @param {object} [options.logger] e.g. `console`; silent when omitted
 * @returns {Promise<{saved: string[]}>} names of the secrets written
 */
async function setup ({
    envKeys = {},
    underscoreReplacedBy = '0x',
    prefix = '',
    client,
    vaultUri,
    credential,
    logger
} = {}) {

    const entries = Object.entries(envKeys);
    const saved = [];

    if (!entries.length) {

        return { saved };

    }

    const secretClient = resolveClient({ client, vaultUri, credential });

    for (const [name, value] of entries) {

        const secretName = toSecretName(name, { underscoreReplacedBy, prefix });

        try {

            await secretClient.setSecret(secretName, value);

        } catch (error) {

            throw new Error(
                `Failed to save ${name} as secret "${secretName}" ` +
                `(${saved.length} of ${entries.length} saved): ${summarize(error)}`,
                { cause: error }
            );

        }

        saved.push(secretName);
        logger?.info?.(`${secretName} saved`);

    }

    return { saved };

}

module.exports = setup;
