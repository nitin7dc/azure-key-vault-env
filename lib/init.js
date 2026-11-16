const { resolveClient } = require('./client');
const summarize = require('./summarize');
const toSecretName = require('./secret-name');

/**
 * Load environment variables from key-vault into `process.env`.
 *
 * Variables that already have a value are left alone. Nothing is written to
 * `process.env` unless every missing variable could be loaded.
 *
 * @param {object} [options]
 * @param {object} [options.envKeys] object whose keys are the variable names
 * @param {string} [options.underscoreReplacedBy]
 * @param {string} [options.prefix] secret name prefix, as given to `setup`
 * @param {boolean} [options.useLocalEnv] never call key-vault; fail if a variable is missing
 * @param {object} [options.client] ready-made secret client
 * @param {string} [options.vaultUri] defaults to `process.env.KEY_VAULT_URI`
 * @param {object} [options.credential] defaults to signing in with the `AZURE_*` variables
 * @param {object} [options.logger] e.g. `console`; silent when omitted
 * @returns {Promise<{loaded: string[], skipped: string[]}>}
 */
async function init ({
    envKeys = {},
    underscoreReplacedBy = '0x',
    prefix = '',
    useLocalEnv = false,
    client,
    vaultUri,
    credential,
    logger
} = {}) {

    const skipped = [];
    const missing = [];

    for (const name of Object.keys(envKeys)) {

        if (process.env[name]) {

            skipped.push(name);
            logger?.debug?.(`${name} is already set, skipping`);

        } else {

            missing.push(name);

        }

    }

    if (useLocalEnv) {

        if (missing.length) {

            throw new Error(`Missing environment variables: ${missing.join(', ')}`);

        }

        return { loaded: [], skipped };

    }

    if (!missing.length) {

        return { loaded: [], skipped };

    }

    const secretClient = resolveClient({ client, vaultUri, credential });

    const results = await Promise.allSettled(missing.map(async name => {

        const secretName = toSecretName(name, { underscoreReplacedBy, prefix });

        try {

            const secret = await secretClient.getSecret(secretName);

            if (typeof secret?.value !== 'string') {

                throw new Error('secret has no value');

            }

            return secret.value;

        } catch (error) {

            throw new Error(`${name} (secret "${secretName}"): ${summarize(error)}`, { cause: error });

        }

    }));

    const failures = results.filter(result => result.status === 'rejected').map(result => result.reason);

    if (failures.length) {

        throw new AggregateError(failures, [
            `Failed to load ${failures.length} of ${missing.length} environment variables from key-vault:`,
            ...failures.map(failure => `  - ${failure.message}`)
        ].join('\n'));

    }

    missing.forEach((name, index) => {

        process.env[name] = results[index].value;

    });

    logger?.info?.(`loaded ${missing.length} environment variables from key-vault, ${skipped.length} already set`);

    return { loaded: missing, skipped };

}

module.exports = init;
