const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const fakeVault = require('./helpers/fake-vault');
const isolateEnv = require('./helpers/isolate-env');

const packageRoot = path.resolve(__dirname, '..');
const azureSdkLoaded = () => Object.keys(require.cache).some(file => file.includes(`${path.sep}@azure${path.sep}`));

isolateEnv('KEY_VAULT_URI', 'APP_DB_HOST');

// Keep this the only test file that checks `require.cache`: each test file
// runs in its own process, and nothing here may load the Azure SDK.
test('the Azure SDK is not loaded until a real client is needed', async () => {

    const { init, setup } = require('..');
    const client = fakeVault();

    await setup({ envKeys: { APP_DB_HOST: 'db.internal' }, client });
    await init({ envKeys: { APP_DB_HOST: '' }, client });
    await init({ envKeys: { APP_DB_HOST: '' }, useLocalEnv: true });

    assert.equal(process.env.APP_DB_HOST, 'db.internal');
    assert.equal(azureSdkLoaded(), false);

});

test('requiring the package needs no configuration and does not read .env', t => {

    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'azure-key-vault-env-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    fs.writeFileSync(path.join(directory, '.env'), 'FROM_DOTENV_FILE=yes\n');

    const env = { ...process.env };
    delete env.KEY_VAULT_URI;
    delete env.FROM_DOTENV_FILE;

    const script = `require(${JSON.stringify(packageRoot)}); process.stdout.write(String(process.env.FROM_DOTENV_FILE));`;
    const child = spawnSync(process.execPath, ['-e', script], { cwd: directory, env, encoding: 'utf8' });

    assert.equal(child.stderr, '');
    assert.equal(child.status, 0);
    assert.equal(child.stdout, 'undefined');

});
