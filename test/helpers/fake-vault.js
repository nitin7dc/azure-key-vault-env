/**
 * In-memory stand-in for the two `SecretClient` methods the library uses.
 * A missing secret fails the way key-vault does: a multi-line 404 error.
 */
function fakeVault (initial = {}) {

    const secrets = new Map(Object.entries(initial));
    const reads = [];
    const writes = [];

    return {
        secrets,
        reads,
        writes,

        async getSecret (name) {

            reads.push(name);

            if (!secrets.has(name)) {

                throw Object.assign(
                    new Error(
                        `A secret with (name/id) ${name} was not found in this key vault.\n` +
                        'For help resolving this issue, please see https://go.microsoft.com/fwlink/?linkid=2125182'
                    ),
                    { code: 'SecretNotFound', statusCode: 404 }
                );

            }

            return { name, value: secrets.get(name) };

        },

        async setSecret (name, value) {

            writes.push(name);
            secrets.set(name, value);

            return { name, value };

        }
    };

}

module.exports = fakeVault;
