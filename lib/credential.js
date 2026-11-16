const summarize = require('./summarize');

const DEFAULT_AUTHORITY_HOST = 'https://login.microsoftonline.com';
const REQUEST_TIMEOUT_MS = 30_000;
const REQUIRED = ['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET'];

/**
 * Sign in to Azure as a service principal (OAuth 2.0 client-credentials flow),
 * configured through AZURE_TENANT_ID, AZURE_CLIENT_ID and AZURE_CLIENT_SECRET.
 * AZURE_AUTHORITY_HOST may point at a sovereign cloud.
 *
 * Returns the `{ getToken }` object the Azure SDK expects from a credential.
 * It keeps no state: the secret client caches the token and asks again
 * shortly before it expires.
 *
 * @returns {{getToken: function(string|string[]): Promise<{token: string, expiresOnTimestamp: number}>}}
 */
function createCredential () {

    const missing = REQUIRED.filter(name => !process.env[name]);

    if (missing.length) {

        throw new Error(`Azure sign-in is not configured: set ${missing.join(', ')}, or pass \`credential\`.`);

    }

    const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET } = process.env;
    const authorityHost = process.env.AZURE_AUTHORITY_HOST || DEFAULT_AUTHORITY_HOST;
    const tokenUrl = new URL(`/${encodeURIComponent(AZURE_TENANT_ID)}/oauth2/v2.0/token`, authorityHost);

    // The client secret is sent to this host, so it must not travel in the clear.
    if (tokenUrl.protocol !== 'https:') {

        throw new Error('AZURE_AUTHORITY_HOST must be an https URL.');

    }

    async function getToken (scopes) {

        let response;
        let body;

        try {

            response = await fetch(tokenUrl, {
                method: 'POST',
                body: new URLSearchParams({
                    grant_type: 'client_credentials',
                    client_id: AZURE_CLIENT_ID,
                    client_secret: AZURE_CLIENT_SECRET,
                    scope: [scopes].flat().join(' ')
                }),
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
            });
            body = await response.json();

        } catch (error) {

            throw new Error(`Azure sign-in failed: no usable response from ${tokenUrl.host} (${summarize(error)})`, { cause: error });

        }

        // Without a real lifetime the secret client could never tell that the
        // token has expired, so a response lacking one is rejected as well.
        const lifetimeSeconds = Number(body?.expires_in);

        if (!response.ok || typeof body?.access_token !== 'string' || !(lifetimeSeconds > 0)) {

            const reason = body?.error_description ? summarize({ message: body.error_description }) : 'no usable token in the response';

            throw new Error(`Azure sign-in failed (HTTP ${response.status}): ${reason}`);

        }

        return {
            token: body.access_token,
            expiresOnTimestamp: Date.now() + lifetimeSeconds * 1000
        };

    }

    return { getToken };

}

module.exports = createCredential;
