const neostandard = require('neostandard');

module.exports = [
    ...neostandard({
        semi: true,
        env: ['mocha'],
        globals: ['logger']
    }),
    {
        rules: {
            '@stylistic/indent': ['error', 4],
            '@stylistic/padded-blocks': ['error', { blocks: 'always' }],
            camelcase: 'off'
        }
    }
];
