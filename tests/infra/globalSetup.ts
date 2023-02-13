import emoji from 'node-emoji';
import { runShellCommand } from './lib/runShellCommand';

export default async function globalSetup() {
    process.env.ENVIRONMENT = 'test';

    process.env.NPM_DEBUG_LOGGER = 'true';
    process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';
    process.env.DEBUG = process.env.DEBUG || 'rad:*';

    process.env.REDIS_URL = 'redis://localhost:56379/2';

    if (process.env.TEST_FAST !== 'true') {
        /* ---------------------------------- prep ---------------------------------- */

        console.log('\ndropping existing containers...');
        await Promise.all([runShellCommand(`docker rm shared-test-redis --force || true`, { ignoreError: true })]);

        /* -------------------------------- database -------------------------------- */

        console.log('spinning up containers');
        await runShellCommand(`docker run --name shared-test-redis -p 56379:6379 -d redis`);
    }

    /* ---------------------------------- done ---------------------------------- */
    console.log(
        `\nglobal setup completed! ${emoji.get('partying_face')} ${
            process.env.TEST_FAST === 'true' ? `(fast mode ${emoji.get('racing_car')}  )` : ''
        }`
    );

    await new Promise(res => setTimeout(res, 1000));
}

if (module === require.main) {
    globalSetup();
}
