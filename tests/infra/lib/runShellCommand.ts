import { spawn } from 'child_process';
import chalk from 'chalk';

export function last(array: string[]) {
    return array[array.length - 1];
}
export async function runShellCommand(
    cmd: string,
    options: { ignoreError?: boolean; noEcho?: boolean; parseAsJSON?: boolean } = {}
) {
    let spitOut = false;

    return new Promise<unknown>((resolve, reject) => {
        console.log('\t' + chalk.dim(cmd));
        const spawned = spawn(cmd, [], { shell: true }); // .split(' ')[0], cmd.split(' ').slice(1));
        let stdout = '';
        let stderr = '';

        const spitOutTimer = setTimeout(() => {
            console.log(chalk.dim(stdout));
            console.log(chalk.dim(stderr));

            spitOut = true;
        }, 5000);

        spawned.stdout.on('data', data => {
            if (spitOut) console.log(chalk.dim(data.toString().replace('\n', '')));
            stdout += data;
        });

        spawned.stderr.on('data', data => {
            if (spitOut) console.log(chalk.dim(data.toString().replace('\n', '')));
            stderr += data;
        });

        spawned.on('close', code => {
            clearTimeout(spitOutTimer);
            if (code !== 0) {
                if (!spitOut) {
                    console.log(chalk.red(stdout), chalk.red(stderr));
                }
                reject(`process exited with non-zero exit code (${code})`);
            }

            const lines = stdout.split('\n').filter(line => line.length > 0);

            // if (!options.noEcho) lines.forEach(line => console.log('\t' + chalk.dim(line)));

            resolve(options.parseAsJSON ? JSON.parse(stdout) : last(lines));

            // might want to use this at some point instead:

            // if (code === 0) {
            //     resolve();
            // } else {
            //     reject(`process exited with non-zero exit code (${code})`)
            // }
        });
    });
}
