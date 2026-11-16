import type { TokenCredential } from '@azure/identity';
import type { SecretClient } from '@azure/keyvault-secrets';

/** Receives progress messages. `console` works, and so do most logging libraries. */
export interface Logger {
    debug?(message: string): void;
    info?(message: string): void;
}

/** The part of a secret client that `init` uses. */
export interface SecretReader {
    getSecret(name: string): Promise<{ value?: string }>;
}

/** The part of a secret client that `setup` uses. */
export interface SecretWriter {
    setSecret(name: string, value: string): Promise<unknown>;
}

export interface ClientOptions {
    /** Key vault URI. Defaults to the `KEY_VAULT_URI` environment variable. */
    vaultUri?: string;
    /** Azure credential. Defaults to `DefaultAzureCredential`. */
    credential?: TokenCredential;
}

export interface NamingOptions {
    /**
     * Replacement for `_` in secret names, since key vault does not allow underscores.
     * @default '0x'
     */
    underscoreReplacedBy?: string;
    /** Put in front of every secret name. Use the same value for `setup` and `init`. */
    prefix?: string;
}

export interface InitOptions extends ClientOptions, NamingOptions {
    /** Object whose keys are the environment variables to load. Values are ignored. */
    envKeys?: object;
    /**
     * Never call key vault: only check that every variable is already set.
     * @default false
     */
    useLocalEnv?: boolean;
    /** Ready-made secret client. Takes precedence over `vaultUri` and `credential`. */
    client?: SecretReader;
    /** Receives progress messages (never secret values). Silent when omitted. */
    logger?: Logger;
}

export interface InitResult {
    /** Variables read from key vault and written to `process.env`. */
    loaded: string[];
    /** Variables that already had a value and were left alone. */
    skipped: string[];
}

export interface SetupOptions extends ClientOptions, NamingOptions {
    /** Environment variable names mapped to the values to save. */
    envKeys?: Readonly<Record<string, string>>;
    /** Ready-made secret client. Takes precedence over `vaultUri` and `credential`. */
    client?: SecretWriter;
    /** Receives progress messages (never secret values). Silent when omitted. */
    logger?: Logger;
}

export interface SetupResult {
    /** Names of the secrets written, in order. */
    saved: string[];
}

/**
 * Load environment variables from key vault into `process.env`.
 *
 * Variables that already have a value are left alone. Rejects, without changing
 * `process.env`, if any variable could not be loaded; when key vault calls fail
 * the rejection is an `AggregateError` with one entry per failed variable.
 */
export function init(options?: InitOptions): Promise<InitResult>;

/** Save environment variables to key vault, one secret per variable. */
export function setup(options?: SetupOptions): Promise<SetupResult>;

/** Create a key vault `SecretClient`. Throws if no vault URI is available. */
export function createClient(options?: ClientOptions): SecretClient;

/**
 * The shared client for `KEY_VAULT_URI`, created the first time it is read.
 * From an ES module, read it off the default import: `keyVaultEnv.keyVault`.
 */
export const keyVault: SecretClient;
