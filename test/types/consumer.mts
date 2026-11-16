// Type-checked by `npm run typecheck`; never executed.
import keyVaultEnv, { init, setup, createClient } from 'azure-key-vault-env';
import type { InitOptions, InitResult, SetupResult } from 'azure-key-vault-env';

const options: InitOptions = { envKeys: { DB_HOST: '' }, prefix: 'staging-' };

export const loaded: InitResult = await init(options);
export const saved: SetupResult = await setup({ envKeys: { DB_HOST: 'db.internal' } });
export const value: string | undefined = (await createClient().getSecret('DB0xHOST')).value;
export const sharedValue: string | undefined = (await keyVaultEnv.keyVault.getSecret('DB0xHOST')).value;
export const sameFunction: typeof init = keyVaultEnv.init;

// @ts-expect-error init resolves with a summary, not a string
export const notAString: string = await init(options);
