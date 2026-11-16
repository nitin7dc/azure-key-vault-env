// Preload with `node --require` to run a script without Azure: the secret
// client it would create is replaced by one in-memory fake vault.
const fakeVault = require('./fake-vault');

const id = require.resolve('@azure/keyvault-secrets');
const vault = fakeVault();

class SecretClient {

    constructor () {

        return vault;

    }

}

require.cache[id] = { id, filename: id, loaded: true, exports: { SecretClient } };
