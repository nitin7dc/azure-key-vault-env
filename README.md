# azure-key-vault-env

[![npm version](https://img.shields.io/npm/v/azure-key-vault-env.svg)](https://www.npmjs.com/package/azure-key-vault-env)
[![node](https://img.shields.io/node/v/azure-key-vault-env.svg)](https://nodejs.org)
[![license](https://img.shields.io/npm/l/azure-key-vault-env.svg)](#license)

Keep your app's environment variables in [Azure Key Vault](https://azure.microsoft.com/products/key-vault) and load
them into `process.env` when the app starts.

- **No more passing `.env` files around.** The values live in Key Vault. A teammate or a server needs four variables
  to get all the others.
- **One place for every environment.** Local, demo, staging and production can share a vault or have one each.
- **Nothing changes in your code.** Values arrive in `process.env`, where your app already reads them.
- **Small.** A single dependency: the official `@azure/keyvault-secrets` client.

**Contents:** [Quick start](#quick-start) · [Run the sample](#run-the-sample) · [How it works](#how-it-works) ·
[API](#api) · [Secret names](#secret-names) · [Recipes](#recipes) · [Errors](#errors) ·
[Azure setup](#azure-setup) · [ES modules](#es-modules) · [Upgrading from 2.x](#upgrading-from-2x)

## Quick start

### 1. Install

```
npm install azure-key-vault-env
```

Requires Node.js 22 or later. Works with both `require` and `import`; the steps below show each.

### 2. Point it at your key vault

The package needs four variables: where the vault is, and a service principal to sign in with. For local work, put
them in a `.env` file that you do not commit.

```
KEY_VAULT_URI=https://my-vault.vault.azure.net/
AZURE_TENANT_ID=...
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...
```

No vault or service principal yet? [Azure setup](#azure-setup) creates both and shows where each value comes from.

### 3. List the variables your app needs

```javascript
// env-keys.js
module.exports = {

    // Database
    DB_HOST: '',
    DB_NAME: '',
    DB_USER: '',
    DB_PASS: ''

    // Any other variables
};
```

In an ES module, start the file with `export default {` instead of `module.exports = {`.

### 4. Save the values to Key Vault

Do this once per environment, and again whenever a value changes.

With `require`:

```javascript
// save-env.js
const { setup } = require('azure-key-vault-env');

setup({
    envKeys: {
        DB_HOST: 'db.example.com',
        DB_NAME: 'app',
        DB_USER: 'app',
        DB_PASS: 'a-long-password'
    },
    logger: console
});
```

With `import`:

```javascript
// save-env.js
import { setup } from 'azure-key-vault-env';

await setup({
    envKeys: {
        DB_HOST: 'db.example.com',
        DB_NAME: 'app',
        DB_USER: 'app',
        DB_PASS: 'a-long-password'
    },
    logger: console
});
```

Either way:

```
$ node --env-file=.env save-env.js
DB0xHOST saved
DB0xNAME saved
DB0xUSER saved
DB0xPASS saved
```

Keep real values out of source control. If they are already in a `.env` file, you can
[upload them from there](#upload-an-existing-env-file) instead of typing them in.

### 5. Load them when your app starts

With `require`:

```javascript
// index.js
const { init } = require('azure-key-vault-env');
const envKeys = require('./env-keys');

init({ envKeys })
    .then(() => {

        // process.env.DB_HOST, process.env.DB_NAME, ... are set from here on
        require('./app');

    })
    .catch(error => {

        console.error(error.message);
        process.exit(1);

    });
```

With `import`:

```javascript
// index.js
import { init } from 'azure-key-vault-env';
import envKeys from './env-keys.js';

try {

    await init({ envKeys });

} catch (error) {

    console.error(error.message);
    process.exit(1);

}

// process.env.DB_HOST, process.env.DB_NAME, ... are set from here on
await import('./app.js');
```

Either way:

```
node --env-file=.env index.js
```

Load your app only after `init` has finished, so that every module sees the variables. In an ES module that means
`await import()` as above: a static `import` at the top of the file would run before `init`.

## Run the sample

To see a full round trip before you touch your own app, run [`sample.js`](sample.js) from this repository. It saves
two made-up variables to your vault and loads them back into `process.env`.

```
git clone https://github.com/nitin7dc/azure-key-vault-env.git
cd azure-key-vault-env
npm install
cp sample.env .env
```

Fill in the four values in `.env` ([Azure setup](#azure-setup) shows where they come from), then:

```
$ node --env-file=.env sample.js
Saving two sample variables to Key Vault
SAMPLE0xDB0xHOST saved
SAMPLE0xDB0xPASS saved
Loading them into process.env
loaded 2 environment variables from key-vault, 0 already set
SAMPLE_DB_HOST = db.example.com
SAMPLE_DB_PASS = a-long-password
```

`npm run sample` runs the same command.

The two secrets, `SAMPLE0xDB0xHOST` and `SAMPLE0xDB0xPASS`, stay in your vault. Running the sample again adds a new
version of each. To remove them:

```
az keyvault secret delete --vault-name my-vault --name SAMPLE0xDB0xHOST
az keyvault secret delete --vault-name my-vault --name SAMPLE0xDB0xPASS
```

A vault with soft delete keeps deleted secrets for a while, and the sample cannot save them again until they are
purged or recovered.

## How it works

```
             setup                                  init
DB_HOST  ───────────▶  secret "DB0xHOST"  ───────────────────▶  process.env.DB_HOST
your value             in Key Vault                             in your running app
```

- Each variable is stored as one secret. Secret names cannot contain underscores, so they are
  [replaced](#secret-names).
- `init` only fetches variables that have no value yet. Anything already set, by your shell, a `.env` file or your
  hosting platform, is left alone.
- `init` fetches all missing variables in parallel, with a single sign-in.
- `init` is all or nothing. If any variable cannot be loaded, it rejects and `process.env` stays as it was.
- `init` and `setup` refuse a mapping that would share a secret, or a secret name Key Vault would reject,
  before they read or write anything.

## API

### `init(options)`

Loads the variables named in `envKeys` into `process.env`. Resolves with `{ loaded, skipped }`: the variables it
fetched from Key Vault, and the ones that already had a value.

### `setup(options)`

Saves the variables in `envKeys` to Key Vault, one after another. Resolves with `{ saved }`, the names of the secrets
it wrote. Saving a variable again adds a new version of its secret, so `setup` is safe to re-run.

### Options

`init` and `setup` take the same options, except where noted. All of them are optional.

| Option | Default | Description |
| --- | --- | --- |
| `envKeys` | `{}` | `init`: an object whose keys are the variables to load (values are ignored). `setup`: variable names mapped to the values to save. |
| `prefix` | `''` | Put in front of every secret name, so [several environments can share one vault](#several-environments-in-one-vault). |
| `underscoreReplacedBy` | `'0x'` | What `_` becomes in [secret names](#secret-names). |
| `useLocalEnv` | `false` | `init` only. Never contact Key Vault. Every variable must be set, and secret names must still be valid. See [Local development](#local-development). |
| `logger` | none | Receives progress messages, e.g. `console`. Nothing is logged without it. Secret values are never logged. |
| `vaultUri` | `KEY_VAULT_URI` | The vault to use. |
| `credential` | the `AZURE_*` variables | A credential object, to [sign in another way](#sign-in-another-way). |
| `client` | | A ready-made `SecretClient`. Takes precedence over `vaultUri` and `credential`. |

### `createClient(options)` and `keyVault`

For anything else you want to do with your secrets, these give you the underlying
[`SecretClient`](https://www.npmjs.com/package/@azure/keyvault-secrets):

- `createClient({ vaultUri, credential })` creates a new client. Both options are optional.
- `keyVault` is the shared client for `KEY_VAULT_URI`, created the first time you use it.

```javascript
const { keyVault } = require('azure-key-vault-env');

const secret = await keyVault.getSecret('DB0xHOST');
```

## Secret names

Key Vault secret names can only contain letters, digits and dashes. Underscores are replaced with `0x`, or with
whatever you pass as `underscoreReplacedBy`, and `prefix` goes in front:

| Variable | Options | Secret name |
| --- | --- | --- |
| `DB_HOST` | | `DB0xHOST` |
| `DB_HOST` | `prefix: 'staging-'` | `staging-DB0xHOST` |
| `DB_HOST` | `underscoreReplacedBy: '-'` | `DB-HOST` |

Pass the same `prefix` and `underscoreReplacedBy` to `setup` and `init`.

`init` and `setup` check the name before they talk to Key Vault. It has to match `^[0-9a-zA-Z-]{1,127}$`:
letters, digits and dashes, 1 to 127 characters, and `prefix` counts. A `prefix` of `my_` is rejected because
of the underscore, and so is a name that comes out longer than 127 characters.

Two variables must not land on one secret. Key Vault ignores case, so `db_host` and `DB_HOST` are the same
secret (`db0xhost` and `DB0xHOST`). Replacing underscores can collide as well: with the default `0x`, `A_B` and
`A0xB` both become `A0xB`. The error names the variables and the secret. It never includes the value.

## Recipes

The recipes use `require`. They work the same with `import`; see [ES modules](#es-modules).

### Several environments in one vault

Give each environment its own `prefix`:

```javascript
await setup({ envKeys: stagingValues, prefix: 'staging-' });
await setup({ envKeys: productionValues, prefix: 'production-' });

// in the app
await init({ envKeys, prefix: `${process.env.APP_ENV}-` });
```

For stricter separation, use one vault per environment and change only `KEY_VAULT_URI`.

### Local development

A variable that already has a value is never fetched, so you can override single values in your local `.env`:

```
KEY_VAULT_URI=https://my-vault.vault.azure.net/
AZURE_TENANT_ID=...
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...

# used instead of the value in Key Vault
DB_HOST=localhost
```

To work without Key Vault at all, pass `useLocalEnv`. `init` then checks that every variable is set, and needs
none of the four vault variables. It still rejects a colliding or invalid secret name, so a bad `prefix` shows
up without a vault:

```javascript
await init({ envKeys, useLocalEnv: process.env.NODE_ENV === 'development' });
```

### Upload an existing `.env` file

Take the values from the environment instead of writing them into a script:

```javascript
// save-env.js
const { setup } = require('azure-key-vault-env');
const envKeys = require('./env-keys');

const values = Object.fromEntries(Object.keys(envKeys).map(name => [name, process.env[name]]));

setup({ envKeys: values, logger: console });
```

```
node --env-file=.env save-env.js
```

Afterwards, remove those values from `.env`. As long as they are set locally, `init` will not fetch them.

### Sign in another way

The built-in sign-in covers a service principal with a client secret. For anything else, such as a managed identity
or your `az login` session, pass a credential from
[`@azure/identity`](https://www.npmjs.com/package/@azure/identity):

```javascript
// npm install @azure/identity
const { DefaultAzureCredential } = require('@azure/identity');

await init({ envKeys, credential: new DefaultAzureCredential() });
```

Outside the public Azure cloud, the built-in sign-in also needs `AZURE_AUTHORITY_HOST`, e.g.
`https://login.microsoftonline.us`.

### Express

```javascript
// index.js
const { init } = require('azure-key-vault-env');
const envKeys = require('./env-keys');

init({ envKeys, logger: console })
    .then(() => {

        // set up your database connection or other operations

        const express = require('express');
        const app = express();
        const port = process.env.PORT || 3000;

        app.listen(port, () => {

            console.info(`Express app live @PORT: ${port}.`);

        });

    })
    .catch(error => {

        console.error(error.message);
        process.exit(1);

    });
```

## Errors

`init` and `setup` reject when something goes wrong. They never exit the process, so that decision stays with you.

`init` tries every variable before it fails, and the message lists all the ones it could not load:

```
Failed to load 2 of 9 environment variables from key-vault:
  - DB_PASS (secret "DB0xPASS"): A secret with (name/id) DB0xPASS was not found in this key vault.
  - API_KEY (secret "API0xKEY"): A secret with (name/id) API0xKEY was not found in this key vault.
```

`error.errors` holds one error per variable, each with the original Azure error as its `cause`.

| The message says | What to check |
| --- | --- |
| `Key vault URI is missing` | `KEY_VAULT_URI` is not set. Often the `.env` file was not loaded, or was loaded after `init` ran. |
| `Azure sign-in is not configured: set ...` | The `AZURE_*` variables it names are missing. |
| `Azure sign-in failed (HTTP ...): AADSTS...` | Microsoft Entra refused the sign-in. The `AADSTS` text gives the reason, for example a wrong or expired client secret. |
| `was not found in this key vault` | The secret does not exist. Run `setup`, and check that `init` uses the same `prefix` and `underscoreReplacedBy`. |
| `Forbidden`, or not authorized | The service principal lacks permission on the vault. See [Azure setup](#azure-setup). |
| `Missing environment variables: ...` | `useLocalEnv` is on and those variables are not set locally. |
| `map to the same key vault secret` | Two variables would share a secret. Their names differ only by case, or underscore replacement made them identical. Rename one, or pick another `underscoreReplacedBy`. |
| `Invalid key vault secret names` | The mapped name is empty, longer than 127 characters, or contains something other than letters, digits and dashes. A `prefix` or `underscoreReplacedBy` of `_` (or similar) is a common cause. |

## Azure setup

With the [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli), after `az login`:

```
# 1. Create a key vault (skip this if you have one)
az keyvault create --name my-vault --resource-group my-resource-group --location westeurope

# 2. Create a service principal that can read and write the vault's secrets
az ad sp create-for-rbac --name my-app \
    --role "Key Vault Secrets Officer" \
    --scopes $(az keyvault show --name my-vault --query id --output tsv)
```

The second command prints the sign-in values. Copy them now, the secret is not shown again.

| In the output | Variable |
| --- | --- |
| `tenant` | `AZURE_TENANT_ID` |
| `appId` | `AZURE_CLIENT_ID` |
| `password` | `AZURE_CLIENT_SECRET` |

`KEY_VAULT_URI` is `https://my-vault.vault.azure.net/`, with your vault's name.

- `Key Vault Secrets Officer` can read and write secrets, which `setup` needs. An app that only calls `init` needs
  just `Key Vault Secrets User`.
- If your vault uses access policies instead of role-based access, grant the permissions this way:
  `az keyvault set-policy --name my-vault --spn <appId> --secret-permissions get set`

## ES modules

Everything works from an ES module, that is a `.mjs` file, or a `.js` file in a project whose `package.json` has
`"type": "module"`:

```javascript
import { init, setup, createClient } from 'azure-key-vault-env';
```

Two things differ from `require`:

- **Load your app with `await import()` after `init`.** Static `import` statements run before the rest of the file,
  so a module imported at the top would read `process.env` before `init` has filled it. Step 5 of the
  [quick start](#quick-start) shows the pattern.
- **`keyVault` is on the default import,** not a named one:

```javascript
import keyVaultEnv from 'azure-key-vault-env';

const secret = await keyVaultEnv.keyVault.getSecret('DB0xHOST');
```

## Upgrading from 2.x

Version 3 changes a few things you may rely on:

- **Node.js 22 or later** is required.
- **`.env` is no longer loaded for you.** Start your app with `node --env-file=.env`, or call `process.loadEnvFile()`
  or [dotenv](https://www.npmjs.com/package/dotenv) before `init`.
- **Sign-in uses the three `AZURE_*` variables only.** `@azure/identity` is no longer included. If you relied on a
  managed identity, `az login` or anything else `DefaultAzureCredential` did for you, see
  [Sign in another way](#sign-in-another-way).
- **`init` rejects instead of exiting.** It used to print the error and call `process.exit(1)`. Add a `catch` and
  exit there if that is what you want.
- **Nothing is logged by default,** and the progress bar is gone. Pass `logger: console` to see what is happening.
- **`init` is all or nothing.** If one variable fails to load, the others are no longer set.
- **Only the package root can be imported.** Paths like `azure-key-vault-env/lib/init` no longer resolve.

New in version 3:

- `init` accepts `prefix`. Before, it could not read secrets that `setup` had saved with one.
- The `vaultUri`, `credential`, `client` and `logger` options, and `createClient`.
- `init` and `setup` resolve with a summary of what they did.

## License

ISC
