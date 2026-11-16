/**
 * Build the key-vault secret name for an environment variable.
 *
 * Key vault secret names only allow letters, digits and dashes, so every
 * underscore is swapped for `underscoreReplacedBy`. `init` and `setup` both
 * go through here, which keeps the names they read and write identical.
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

module.exports = toSecretName;
