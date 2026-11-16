const init = require('./lib/init');
const setup = require('./lib/setup');
const { createClient, getDefaultClient } = require('./lib/client');

module.exports = { init, setup, createClient };

// `keyVault` is the shared default client. It is a getter so that requiring
// this package never touches Azure or needs KEY_VAULT_URI; the client is
// only built when something actually asks for it.
Object.defineProperty(module.exports, 'keyVault', { get: getDefaultClient });
