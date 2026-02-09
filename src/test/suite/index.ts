import * as path from 'path';
import Mocha from 'mocha';
import { globSync } from 'glob';

export function run(): Promise<void> {
    const mocha = new Mocha({ ui: 'bdd', color: true, timeout: 10000 });
    const testsRoot = path.resolve(__dirname);

    return new Promise((resolve, reject) => {
        const files = globSync('**/*.test.js', { cwd: testsRoot });
        files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

        mocha.run(failures => {
            if (failures > 0) {
                reject(new Error(`${failures} test(s) failed.`));
            } else {
                resolve();
            }
        });
    });
}
