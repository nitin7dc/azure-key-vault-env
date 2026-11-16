// A complete round trip: save two made-up variables to Key Vault, then load
// them back into process.env.
//
//     cp sample.env .env        (then fill in the four values)
//     node --env-file=.env sample.js
//
// The two secrets it saves, SAMPLE0xDB0xHOST and SAMPLE0xDB0xPASS, stay in
// your vault afterwards.

// Inside this repository the package name resolves to the code next to this
// file. Copied into your own project, it resolves to the installed package.
const { setup, init } = require('azure-key-vault-env');

async function main () {

    console.log('Saving two sample variables to Key Vault');

    await setup({
        envKeys: {
            SAMPLE_DB_HOST: 'db.example.com',
            SAMPLE_DB_PASS: 'a-long-password'
        },
        logger: console
    });

    console.log('Loading them into process.env');

    await init({
        envKeys: {
            SAMPLE_DB_HOST: '',
            SAMPLE_DB_PASS: ''
        },
        logger: console
    });

    console.log(`SAMPLE_DB_HOST = ${process.env.SAMPLE_DB_HOST}`);
    console.log(`SAMPLE_DB_PASS = ${process.env.SAMPLE_DB_PASS}`);

}

main().catch(error => {

    console.error(error.message);
    process.exitCode = 1;

});
