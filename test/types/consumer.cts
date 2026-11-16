// Type-checked by `npm run typecheck`; never executed.
import keyVaultEnv = require('azure-key-vault-env');
import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';

const envKeys = { DB_HOST: '', DB_PASS: '' };
const credential = new DefaultAzureCredential();

export async function usage () {

    const client: SecretClient = keyVaultEnv.createClient({ vaultUri: 'https://example.vault.azure.net', credential });
    const shared: SecretClient = keyVaultEnv.keyVault;

    const { loaded, skipped } = await keyVaultEnv.init({
        envKeys,
        prefix: 'staging-',
        underscoreReplacedBy: '-',
        useLocalEnv: false,
        client,
        logger: console
    });
    const names: string[] = [...loaded, ...skipped];

    const { saved } = await keyVaultEnv.setup({ envKeys, vaultUri: 'https://example.vault.azure.net', credential });
    const secretNames: string[] = saved;

    // The real client and a hand-written fake are both accepted.
    await keyVaultEnv.setup({ envKeys, client: shared });
    await keyVaultEnv.init({ envKeys, client: { getSecret: async () => ({ value: 'from a fake' }) } });
    await keyVaultEnv.init();

    // @ts-expect-error setup saves strings
    await keyVaultEnv.setup({ envKeys: { DB_PORT: 5432 } });
    // @ts-expect-error unknown option
    await keyVaultEnv.init({ envKey: envKeys });
    // @ts-expect-error a client must be able to read secrets
    await keyVaultEnv.init({ envKeys, client: {} });
    // @ts-expect-error createClient returns a SecretClient
    const notANumber: number = keyVaultEnv.createClient();
    // @ts-expect-error keyVault is a SecretClient
    const notAString: string = keyVaultEnv.keyVault;
    // @ts-expect-error there is no such export
    keyVaultEnv.load();

    return [names, secretNames, notANumber, notAString];

}
