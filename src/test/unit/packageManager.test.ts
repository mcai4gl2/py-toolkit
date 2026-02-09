import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { detectPackageManager } from '../../venv/packageManager';

suite('venv/packageManager', () => {
    let tmpDir: string;

    setup(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pytoolkit-test-'));
    });

    teardown(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // ── detectPackageManager ──────────────────────────────────

    test('detects uv from uv.lock', () => {
        fs.writeFileSync(path.join(tmpDir, 'uv.lock'), '');
        assert.strictEqual(detectPackageManager(tmpDir), 'uv');
    });

    test('detects uv from [tool.uv] in pyproject.toml', () => {
        fs.writeFileSync(
            path.join(tmpDir, 'pyproject.toml'),
            '[tool.uv]\ndev-dependencies = []\n',
        );
        assert.strictEqual(detectPackageManager(tmpDir), 'uv');
    });

    test('detects uv from PEP 621 [project] with dependencies', () => {
        fs.writeFileSync(
            path.join(tmpDir, 'pyproject.toml'),
            '[project]\nname = "foo"\ndependencies = [\n  "flask",\n]\n',
        );
        assert.strictEqual(detectPackageManager(tmpDir), 'uv');
    });

    test('detects venv+pip from requirements.txt', () => {
        fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), 'flask\n');
        assert.strictEqual(detectPackageManager(tmpDir), 'venv+pip');
    });

    test('falls back to first preferred manager when no markers', () => {
        // The vscode mock returns the default setting ['uv', 'venv+pip']
        // so first preference is 'uv'
        const result = detectPackageManager(tmpDir);
        assert.strictEqual(result, 'uv');
    });

    test('uv.lock takes priority over requirements.txt', () => {
        fs.writeFileSync(path.join(tmpDir, 'uv.lock'), '');
        fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), 'flask\n');
        assert.strictEqual(detectPackageManager(tmpDir), 'uv');
    });

    test('pyproject.toml without uv markers + requirements.txt → venv+pip', () => {
        fs.writeFileSync(
            path.join(tmpDir, 'pyproject.toml'),
            '[tool.black]\nline-length = 100\n',
        );
        fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), 'flask\n');
        assert.strictEqual(detectPackageManager(tmpDir), 'venv+pip');
    });
});
