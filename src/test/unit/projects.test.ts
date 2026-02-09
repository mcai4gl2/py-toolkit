import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { discoverSubprojects } from '../../discovery/projects';

suite('discovery/projects', () => {
    let tmpDir: string;

    setup(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pytoolkit-test-'));
    });

    teardown(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('returns empty array for empty workspace', () => {
        assert.deepStrictEqual(discoverSubprojects(tmpDir), []);
    });

    test('discovers project with requirements.txt', () => {
        const proj = path.join(tmpDir, 'myproject');
        fs.mkdirSync(proj);
        fs.writeFileSync(path.join(proj, 'requirements.txt'), 'flask\n');

        const results = discoverSubprojects(tmpDir);
        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0].name, 'myproject');
        assert.deepStrictEqual(results[0].markers, ['requirements.txt']);
    });

    test('discovers project with pyproject.toml', () => {
        const proj = path.join(tmpDir, 'mylib');
        fs.mkdirSync(proj);
        fs.writeFileSync(path.join(proj, 'pyproject.toml'), '[project]\n');

        const results = discoverSubprojects(tmpDir);
        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0].name, 'mylib');
        assert.deepStrictEqual(results[0].markers, ['pyproject.toml']);
    });

    test('discovers project with .py files only', () => {
        const proj = path.join(tmpDir, 'scripts');
        fs.mkdirSync(proj);
        fs.writeFileSync(path.join(proj, 'run.py'), 'print("hi")\n');

        const results = discoverSubprojects(tmpDir);
        assert.strictEqual(results.length, 1);
        assert.deepStrictEqual(results[0].markers, ['py-files']);
    });

    test('reports multiple markers', () => {
        const proj = path.join(tmpDir, 'dual');
        fs.mkdirSync(proj);
        fs.writeFileSync(path.join(proj, 'requirements.txt'), '');
        fs.writeFileSync(path.join(proj, 'pyproject.toml'), '');

        const results = discoverSubprojects(tmpDir);
        assert.strictEqual(results.length, 1);
        assert.deepStrictEqual(results[0].markers, ['requirements.txt', 'pyproject.toml']);
    });

    test('skips hidden directories', () => {
        const hidden = path.join(tmpDir, '.hidden');
        fs.mkdirSync(hidden);
        fs.writeFileSync(path.join(hidden, 'requirements.txt'), '');

        assert.deepStrictEqual(discoverSubprojects(tmpDir), []);
    });

    test('skips __pycache__ and node_modules', () => {
        for (const name of ['__pycache__', 'node_modules']) {
            const dir = path.join(tmpDir, name);
            fs.mkdirSync(dir);
            fs.writeFileSync(path.join(dir, 'requirements.txt'), '');
        }
        assert.deepStrictEqual(discoverSubprojects(tmpDir), []);
    });

    test('discovers nested projects', () => {
        // mcp/weather/ should be discovered as "mcp/weather"
        const nested = path.join(tmpDir, 'mcp', 'weather');
        fs.mkdirSync(nested, { recursive: true });
        fs.writeFileSync(path.join(nested, 'requirements.txt'), '');

        const results = discoverSubprojects(tmpDir);
        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0].name, 'mcp/weather');
    });

    test('results are sorted by name', () => {
        for (const name of ['zebra', 'alpha', 'mid']) {
            const dir = path.join(tmpDir, name);
            fs.mkdirSync(dir);
            fs.writeFileSync(path.join(dir, 'requirements.txt'), '');
        }

        const results = discoverSubprojects(tmpDir);
        assert.deepStrictEqual(
            results.map(r => r.name),
            ['alpha', 'mid', 'zebra'],
        );
    });
});
