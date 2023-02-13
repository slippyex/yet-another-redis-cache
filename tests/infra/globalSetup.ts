import { runShellCommand } from './lib/runShellCommand';

const REDIS_TEST_PORT = 56379;
export default async function globalSetup() {
    process.env.ENVIRONMENT = 'test';

    process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';
    process.env.DEBUG = process.env.DEBUG || 'rad:*';

    process.env.REDIS_URL = `redis://localhost:${REDIS_TEST_PORT}/2`;

    if (process.env.TEST_FAST !== 'true') {
        /* ---------------------------------- prep ---------------------------------- */

        console.log('\ndropping existing containers...');
        await Promise.all([runShellCommand(`docker rm shared-test-redis --force || true`, { ignoreError: true })]);

        /* -------------------------------- database -------------------------------- */

        console.log('spinning up redis instance container');
        await runShellCommand(`docker run --name shared-test-redis -p ${REDIS_TEST_PORT}:6379 -d redis`);
    }

    /* ---------------------------------- done ---------------------------------- */
    console.log(`\nglobal setup completed! ${process.env.TEST_FAST === 'true' ? `(fast mode)` : ''}`);

    await new Promise(res => setTimeout(res, 1000));
}

if (module === require.main) {
    globalSetup();
}
