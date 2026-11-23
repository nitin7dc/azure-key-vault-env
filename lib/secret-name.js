/**
 * Build the key-vault secret name for an environment variable.
 *
 * Key vault secret names only allow letters, digits and dashes, so every
 * underscore is swapped for `underscoreReplacedBy`. `mapSecretNames` goes
 * through here, and `init` and `setup` both call that, which keeps the names
 * they read and write identical.
 *
 * @param {string} name environment variable name, e.g. `DB_HOST`
 * @param {object} [options]
 * @param {string} [options.underscoreReplacedBy]
 * @param {string} [options.prefix]
 * @returns {string}
 */
function toSecretName (name, { underscoreReplacedBy = '0x', prefix = '' } = {}) {

    return `${prefix}${name.split('_').join(underscoreReplacedBy)}`;

}

// Letters, digits and dashes, 1 to 127 characters. Key vault rejects anything else.
const SECRET_NAME_PATTERN = /^[0-9a-zA-Z-]{1,127}$/;

/**
 * Map every environment variable to its secret name.
 *
 * Throws, before any vault call, when a name would be rejected or when two
 * variables would share a secret. Sharing happens in two ways. Underscore
 * replacement can make different names identical (`A_B` and `A0xB` both
 * become `A0xB` with the default replacement). Key vault also compares
 * secret names without regard to case, so `db_host` and `DB_HOST` are one
 * secret. The error names the variables and the secret names, never values.
 *
 * @param {string[]} names environment variable names, in the caller's order
 * @param {object} [options]
 * @param {string} [options.underscoreReplacedBy]
 * @param {string} [options.prefix]
 * @returns {Map<string, string>} variable name to secret name
 */
function mapSecretNames (names, options) {

    const mapped = names.map(name => ({ name, secretName: toSecretName(name, options) }));
    const invalid = mapped.filter(entry => !SECRET_NAME_PATTERN.test(entry.secretName));

    if (invalid.length) {

        throw new Error([
            `Invalid key vault secret names. Names must match ${SECRET_NAME_PATTERN}:`,
            ...invalid.map(entry => `  - ${entry.name} maps to "${entry.secretName}"`)
        ].join('\n'));

    }

    const groups = new Map();

    for (const entry of mapped) {

        // Valid names are ASCII, so this is a plain case fold, which is how
        // key vault decides that two secret names are the same secret.
        const key = entry.secretName.toLowerCase();
        const group = groups.get(key);

        if (group) {

            group.push(entry);

        } else {

            groups.set(key, [entry]);

        }

    }

    const collisions = [...groups.values()].filter(group => group.length > 1);

    if (collisions.length) {

        throw new Error([
            'These environment variables map to the same key vault secret:',
            ...collisions.map(group => `  - ${describeCollision(group)}`)
        ].join('\n'));

    }

    return new Map(mapped.map(entry => [entry.name, entry.secretName]));

}

/**
 * One collision group, as a sentence fragment. Identical secret-name strings
 * collided through replacement. Strings that differ only by case collided
 * because key vault treats those as one secret.
 *
 * @param {{name: string, secretName: string}[]} group
 * @returns {string}
 */
function describeCollision (group) {

    const secretNames = [...new Set(group.map(entry => entry.secretName))];

    if (secretNames.length === 1) {

        const verb = group.length === 2 ? 'both map' : 'all map';

        return `${formatList(group.map(entry => entry.name))} ${verb} to "${secretNames[0]}"`;

    }

    const labeled = group.map(entry => `${entry.name} ("${entry.secretName}")`);

    return `${formatList(labeled)} are the same secret, because secret names are case-insensitive`;

}

/**
 * @param {string[]} items
 * @returns {string}
 */
function formatList (items) {

    if (items.length < 2) {

        return items.join('');

    }

    if (items.length === 2) {

        return `${items[0]} and ${items[1]}`;

    }

    return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

}

module.exports = { toSecretName, mapSecretNames };
