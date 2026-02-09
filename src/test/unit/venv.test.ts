import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    getVenvPython,
    getVenvPip,
    isVenvValid,
    findVenvForFile,
    getProjectForFile,
} from '../../discovery/venv';

suite('discovery/venv', () => {
    let tmpDir: string;

    setup(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pytoolkit-test-'));
    });

    teardown(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // ── getVenvPython / getVenvPip ────────────────────────────

    test('getVenvPython returns bin/python on non-windows', function () {
        if (process.platform === 'win32') this.skip();
        assert.strictEqual(getVenvPython('/proj/.venv'), '/proj/.venv/bin/python');
    });

    test('getVenvPip returns bin/pip on non-windows', function () {
        if (process.platform === 'win32') this.skip();
        assert.strictEqual(getVenvPip('/proj/.venv'), '/proj/.venv/bin/pip');
    });

    // ── isVenvValid ───────────────────────────────────────────

    test('isVenvValid returns false for missing venv', () => {
        assert.strictEqual(isVenvValid(path.join(tmpDir, '.venv')), false);
    });

    test('isVenvValid returns true when python binary exists', function () {
        if (process.platform === 'win32') this.skip();
        const venv = path.join(tmpDir, '.venv');
        fs.mkdirSync(path.join(venv, 'bin'), { recursive: true });
        fs.writeFileSync(path.join(venv, 'bin', 'python'), '');
        assert.strictEqual(isVenvValid(venv), true);
    });

    // ── findVenvForFile ───────────────────────────────────────

    test('findVenvForFile returns undefined when no .venv exists', () => {
        const sub = path.join(tmpDir, 'proj');
        fs.mkdirSync(sub);
        fs.writeFileSync(path.join(sub, 'app.py'), '');
        assert.strictEqual(
            findVenvForFile(path.join(sub, 'app.py'), tmpDir),
            undefined,
        );
    });

    test('findVenvForFile walks up to find .venv', () => {
        // workspace/proj/.venv/  +  workspace/proj/src/app.py
        const proj = path.join(tmpDir, 'proj');
        const venv = path.join(proj, '.venv');
        const src = path.join(proj, 'src');
        fs.mkdirSync(venv, { recursive: true });
        fs.mkdirSync(src, { recursive: true });
        fs.writeFileSync(path.join(src, 'app.py'), '');

        assert.strictEqual(findVenvForFile(path.join(src, 'app.py'), tmpDir), venv);
    });

    test('findVenvForFile finds venv at workspace root', () => {
        const venv = path.join(tmpDir, '.venv');
        fs.mkdirSync(venv);
        fs.writeFileSync(path.join(tmpDir, 'app.py'), '');

        assert.strictEqual(findVenvForFile(path.join(tmpDir, 'app.py'), tmpDir), venv);
    });

    // ── getProjectForFile ─────────────────────────────────────

    test('getProjectForFile matches longest prefix', () => {
        const file = path.join(tmpDir, 'mcp', 'weather', 'main.py');
        const result = getProjectForFile(file, tmpDir, ['mcp', 'mcp/weather']);
        assert.strictEqual(result, 'mcp/weather');
    });

    test('getProjectForFile returns undefined for unmatched file', () => {
        const file = path.join(tmpDir, 'standalone.py');
        const result = getProjectForFile(file, tmpDir, ['proj']);
        assert.strictEqual(result, undefined);
    });
});
