// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html

module.exports = {
    testEnvironment: 'node',
    preset: 'ts-jest',
    testMatch: ['**/tests/**/*.test.ts'],
    globalSetup: './tests/infra/globalSetup.ts',
    testTimeout: 20000,
    forceExit: true
};
