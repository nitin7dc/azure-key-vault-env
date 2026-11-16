const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const createCredential = require('../lib/credential');
const isolateEnv = require('./helpers/isolate-env');

const SCOPE = 'https://vault.azure.net/.default';

isolateEnv('AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET', 'AZURE_AUTHORITY_HOST');

beforeEach(() => {

    process.env.AZURE_TENANT_ID = 'tenant-id';
    process.env.AZURE_CLIENT_ID = 'client-id';
    process.env.AZURE_CLIENT_SECRET = 'client-s3cret';

});

/** Replace `fetch` for one test; the handler gets the URL and request options. */
function stubFetch (t, handler) {

    return t.mock.method(globalThis, 'fetch', async (url, options) => handler(String(url), options));

}

const jsonResponse = (status, body) => new Response(JSON.stringify(body), { status });

test('asks the tenant for a token with the client id and secret', async t => {

    const fetch = stubFetch(t, () => jsonResponse(200, { token_type: 'Bearer', expires_in: 3599, access_token: 'the-token' }));
    const before = Date.now();

    const token = await createCredential().getToken(SCOPE);

    const [url, options] = fetch.mock.calls[0].arguments;
    assert.equal(fetch.mock.callCount(), 1);
    assert.equal(String(url), 'https://login.microsoftonline.com/tenant-id/oauth2/v2.0/token');
    assert.equal(options.method, 'POST');
    assert.deepEqual(Object.fromEntries(options.body), {
        grant_type: 'client_credentials',
        client_id: 'client-id',
        client_secret: 'client-s3cret',
        scope: SCOPE
    });
    assert.equal(token.token, 'the-token');
    assert.ok(token.expiresOnTimestamp >= before + 3_599_000);
    assert.ok(token.expiresOnTimestamp <= Date.now() + 3_599_000);

});

test('accepts the scopes as an array', async t => {

    const fetch = stubFetch(t, () => jsonResponse(200, { expires_in: 3599, access_token: 'the-token' }));

    await createCredential().getToken([SCOPE]);

    assert.equal(fetch.mock.calls[0].arguments[1].body.get('scope'), SCOPE);

});

test('lists the variables that are missing', () => {

    delete process.env.AZURE_CLIENT_ID;
    process.env.AZURE_CLIENT_SECRET = '';

    assert.throws(() => createCredential(), {
        message: 'Azure sign-in is not configured: set AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, or pass `credential`.'
    });

});

test('AZURE_AUTHORITY_HOST selects another cloud', async t => {

    process.env.AZURE_AUTHORITY_HOST = 'https://login.microsoftonline.us/';
    const fetch = stubFetch(t, () => jsonResponse(200, { expires_in: 3599, access_token: 'the-token' }));

    await createCredential().getToken(SCOPE);

    assert.equal(String(fetch.mock.calls[0].arguments[0]), 'https://login.microsoftonline.us/tenant-id/oauth2/v2.0/token');

});

test('refuses to send the secret over plain http', () => {

    process.env.AZURE_AUTHORITY_HOST = 'http://login.example.com';

    assert.throws(() => createCredential(), { message: 'AZURE_AUTHORITY_HOST must be an https URL.' });

});

test('reports why Azure refused, without the secret', async t => {

    stubFetch(t, () => jsonResponse(401, {
        error: 'invalid_client',
        error_description: 'AADSTS7000215: Invalid client secret provided.\r\nTrace ID: 1234\r\nCorrelation ID: 5678'
    }));

    await assert.rejects(createCredential().getToken(SCOPE), error => {

        assert.equal(error.message, 'Azure sign-in failed (HTTP 401): AADSTS7000215: Invalid client secret provided.');
        assert.ok(!JSON.stringify([error.message, error.stack]).includes('client-s3cret'));

        return true;

    });

});

test('fails when the response has no token', async t => {

    stubFetch(t, () => jsonResponse(200, { token_type: 'Bearer', expires_in: 3599 }));

    await assert.rejects(createCredential().getToken(SCOPE), {
        message: 'Azure sign-in failed (HTTP 200): no usable token in the response'
    });

});

test('fails when the token has no lifetime, rather than returning one that never expires', async t => {

    for (const body of [{ access_token: 'the-token' }, { access_token: 'the-token', expires_in: 'soon' }, { access_token: 'the-token', expires_in: 0 }]) {

        stubFetch(t, () => jsonResponse(200, body));

        await assert.rejects(createCredential().getToken(SCOPE), {
            message: 'Azure sign-in failed (HTTP 200): no usable token in the response'
        });

    }

});

test('accepts a lifetime sent as a string', async t => {

    stubFetch(t, () => jsonResponse(200, { access_token: 'the-token', expires_in: '3599' }));
    const before = Date.now();

    const token = await createCredential().getToken(SCOPE);

    assert.ok(token.expiresOnTimestamp >= before + 3_599_000);

});

test('wraps network failures and keeps the cause', async t => {

    const failure = new TypeError('fetch failed');
    stubFetch(t, () => {

        throw failure;

    });

    await assert.rejects(createCredential().getToken(SCOPE), error => {

        assert.equal(error.message, 'Azure sign-in failed: no usable response from login.microsoftonline.com (fetch failed)');
        assert.equal(error.cause, failure);

        return true;

    });

});
