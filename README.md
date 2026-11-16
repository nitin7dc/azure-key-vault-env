# azure-key-vault-env
Manage your environment variables using azure key vault.

### Problem
- When your application has many environment variables, they become difficult to manage.
- Securely sharing env file with team members is time-consuming.
- Managing multiple environments (local, demo, staging, production,...) again introduces some more challenges.

### Solution
If you are already using azure, manage your environment variables using key vault. It's a good service with many
benefits. [(learn more)](https://azure.microsoft.com/en-us/services/key-vault/)
- create a azure key vault.
- give your app (a service principal or a managed identity) access to the key vault.
- use this package to set up and load env.

### Installation

```
npm install azure-key-vault-env
```

Requires Node.js 22 or later. Upgrading from 2.x? See [Upgrading from 2.x](#upgrading-from-2x).

***
### Configuration

The package finds your key vault through `KEY_VAULT_URI` and signs in with
[`DefaultAzureCredential`](https://learn.microsoft.com/javascript/api/@azure/identity/defaultazurecredential).

| Variable | Description |
| --- | --- |
| `KEY_VAULT_URI` | The key vault URI, e.g. `https://my-vault.vault.azure.net/` |
| `AZURE_TENANT_ID` | The tenant ID in Microsoft Entra ID |
| `AZURE_CLIENT_ID` | The application (client) ID registered in the tenant |
| `AZURE_CLIENT_SECRET` | The client secret for the registered application |

The three `AZURE_*` variables are only needed to sign in as a service principal. With a managed identity on Azure, or
after `az login` on your machine, `KEY_VAULT_URI` is enough.

The identity needs permission to read secrets (the `Key Vault Secrets User` role), and to write them if it runs
`setup` (the `Key Vault Secrets Officer` role).

These variables have to be in the environment before you call `init` or `setup`. The package does not read `.env`
files itself; see [Loading a .env file](#loading-a-env-file).

***
### Usage

1. Prepare an envKeys file with all environment variables.

```javascript
// env-keys.js
module.exports = {

    // Database
    DB_HOST: '',
    DB_NAME: '',
    DB_USER: '',
    DB_PASS: '',

    // Any other variables
};
```

2. Run setup once, with the values filled in, to send them to key vault.

```javascript
const { setup } = require('azure-key-vault-env');

const { saved } = await setup({
    envKeys: {
        DB_HOST: 'db.example.com',
        DB_NAME: 'app',
        DB_USER: 'app',
        DB_PASS: '...'
    }
});

// saved: ['DB0xHOST', 'DB0xNAME', 'DB0xUSER', 'DB0xPASS']
```

3. Load the variables when your app starts. Only the keys matter here, the values are ignored.

```javascript
const { init } = require('azure-key-vault-env');
const envKeys = require('./env-keys');

const { loaded, skipped } = await init({ envKeys });

// process.env.DB_HOST, process.env.DB_NAME, ... are now set
```

A variable that already has a value in `process.env` is left alone (it is listed in `skipped`), so anything you set
locally wins over key vault.

***
### Options

`init(options)` and `setup(options)` take the same options, except where noted.

| Option | Default | Description |
| --- | --- | --- |
| `envKeys` | `{}` | `init`: object whose keys are the variables to load. `setup`: variable names mapped to the values to save. |
| `prefix` | `''` | Put in front of every secret name, so several environments can share one key vault. |
| `underscoreReplacedBy` | `'0x'` | Replaces `_` in secret names. |
| `useLocalEnv` | `false` | `init` only. Never call key vault, just check that every variable is already set. |
| `vaultUri` | `KEY_VAULT_URI` | The key vault to use. |
| `credential` | `DefaultAzureCredential` | Any credential from `@azure/identity`. |
| `client` | | A ready-made `SecretClient`. Takes precedence over `vaultUri` and `credential`. |
| `logger` | | Receives progress messages, e.g. `console`. Nothing is logged without it, and secret values are never logged. |

`init` resolves with `{ loaded, skipped }` and `setup` with `{ saved }`.

Two more exports give you the underlying `SecretClient` from `@azure/keyvault-secrets`:

- `createClient({ vaultUri, credential })` creates a new client.
- `keyVault` is the shared client for `KEY_VAULT_URI`, created the first time you use it.

### Secret names

Key vault secret names can only contain letters, digits and dashes, so underscores are replaced: `DB_HOST` is saved
as `DB0xHOST`. With `prefix: 'staging-'` it becomes `staging-DB0xHOST`.

Pass the same `prefix` and `underscoreReplacedBy` to `setup` and `init`.

### Errors

`init` and `setup` reject when something goes wrong; they never exit the process.

```javascript
try {

    await init({ envKeys });

} catch (error) {

    console.error(error.message);
    process.exit(1);

}
```

`init` tries every variable before it fails, so the message lists all of them:

```
Failed to load 2 of 9 environment variables from key-vault:
  - DB_PASS (secret "DB0xPASS"): A secret with (name/id) DB0xPASS was not found in this key vault.
  - API_KEY (secret "API0xKEY"): A secret with (name/id) API0xKEY was not found in this key vault.
```

`error.errors` holds one error per variable, each with the original Azure error as its `cause`. When `init` fails,
`process.env` is left as it was.

### Loading a .env file

Load it before calling `init`, with whatever you prefer:

```
node --env-file=.env index.js
```

or `process.loadEnvFile()`, or [dotenv](https://www.npmjs.com/package/dotenv), at the top of your entry file.

### Example with express.js

```javascript
/**
 * Entry File. Start with: node --env-file=.env index.js
 */

const { init } = require('azure-key-vault-env');
const envKeys = require('INSERT___PATH_TO_YOUR_ENV_KEYS_FILE');

/****************************************************************************************************
 *  Load environment variables from key-vault.
 *  Target environment variables are defined in envKeys.
 ****************************************************************************************************/

module.exports = init({ envKeys, logger: console })
    .then(() => {

        // setup your database connection or other operations

        const express = require('express');
        const app = express();
        const port = 3000;

        app.listen(port, () => {

            console.info(`Express app live @PORT: ${port}.`);

        });

        return app;

    }).catch(error => {

        console.error(error);
        process.exit(1);

    });

```

### ES modules

The package is CommonJS, and can be imported from an ES module too:

```javascript
import { init, setup, createClient } from 'azure-key-vault-env';
```

`keyVault` is only available on the default import: `import keyVaultEnv from 'azure-key-vault-env'`.

***
### Upgrading from 2.x

- Node.js 22 or later is required.
- `.env` is no longer loaded for you. [Load it yourself](#loading-a-env-file) before calling `init`.
- `init` rejects instead of printing the error and exiting. Add a `catch` and exit there if that is what you want.
- Nothing is logged by default and the progress bar is gone. Pass `logger: console` to see what is happening.
- If one variable fails to load, `init` no longer sets the others.
- Only the package root can be imported; paths like `azure-key-vault-env/lib/init` no longer resolve.

New in 3.0: `init` accepts `prefix` (it could not read secrets that `setup` had saved with one), the `vaultUri`,
`credential`, `client` and `logger` options, `createClient`, and results from `init` and `setup`.
