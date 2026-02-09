import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    hashFile,
    readStoredHash,
    writeHash,
    isVenvStale,
    findRequirementsFile,
    findAllRequirementsFiles,
} from '../../venv/hash';

suite('venv/hash', () => {
    let tmpDir: string;

    setup(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pytoolkit-test-'));
    });

    teardown(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // ── hashFile ──────────────────────────────────────────────

    test('hashFile returns consistent MD5 hex digest', () => {
        const file = path.join(tmpDir, 'reqs.txt');
        fs.writeFileSync(file, 'flask==2.0\n');
        const h1 = hashFile(file);
        const h2 = hashFile(file);
        assert.strictEqual(h1, h2);
        assert.match(h1, /^[0-9a-f]{32}$/);
    });

    test('hashFile returns different digest for different content', () => {
        const a = path.join(tmpDir, 'a.txt');
        const b = path.join(tmpDir, 'b.txt');
        fs.writeFileSync(a, 'flask==2.0\n');
        fs.writeFileSync(b, 'flask==3.0\n');
        assert.notStrictEqual(hashFile(a), hashFile(b));
    });

    // ── readStoredHash / writeHash ────────────────────────────

    test('readStoredHash returns undefined when no hash file exists', () => {
        assert.strictEqual(readStoredHash(tmpDir), undefined);
    });

    test('writeHash + readStoredHash round-trip', () => {
        writeHash(tmpDir, 'abc123');
        assert.strictEqual(readStoredHash(tmpDir), 'abc123');
    });

    // ── isVenvStale ───────────────────────────────────────────

    test('isVenvStale returns true when no stored hash', () => {
        const reqs = path.join(tmpDir, 'requirements.txt');
        fs.writeFileSync(reqs, 'flask\n');
        assert.strictEqual(isVenvStale(tmpDir, reqs), true);
    });

    test('isVenvStale returns false when hash matches', () => {
        const reqs = path.join(tmpDir, 'requirements.txt');
        fs.writeFileSync(reqs, 'flask\n');
        writeHash(tmpDir, hashFile(reqs));
        assert.strictEqual(isVenvStale(tmpDir, reqs), false);
    });

    test('isVenvStale returns true when requirements changed', () => {
        const reqs = path.join(tmpDir, 'requirements.txt');
        fs.writeFileSync(reqs, 'flask\n');
        writeHash(tmpDir, hashFile(reqs));
        fs.writeFileSync(reqs, 'flask\nrequests\n');
        assert.strictEqual(isVenvStale(tmpDir, reqs), true);
    });

    // ── findRequirementsFile ──────────────────────────────────

    test('findRequirementsFile returns undefined when nothing present', () => {
        assert.strictEqual(findRequirementsFile(tmpDir), undefined);
    });

    test('findRequirementsFile picks requirements.txt first', () => {
        fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), '');
        fs.writeFileSync(path.join(tmpDir, 'requirements-dev.txt'), '');
        assert.strictEqual(
            findRequirementsFile(tmpDir),
            path.join(tmpDir, 'requirements.txt'),
        );
    });

    test('findRequirementsFile falls back to requirements-dev.txt', () => {
        fs.writeFileSync(path.join(tmpDir, 'requirements-dev.txt'), '');
        assert.strictEqual(
            findRequirementsFile(tmpDir),
            path.join(tmpDir, 'requirements-dev.txt'),
        );
    });

    // ── findAllRequirementsFiles ──────────────────────────────

    test('findAllRequirementsFiles returns empty for no matches', () => {
        assert.deepStrictEqual(findAllRequirementsFiles(tmpDir), []);
    });

    test('findAllRequirementsFiles finds all requirements*.txt sorted', () => {
        fs.writeFileSync(path.join(tmpDir, 'requirements-dev.txt'), '');
        fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), '');
        fs.writeFileSync(path.join(tmpDir, 'requirements-cpu.txt'), '');
        fs.writeFileSync(path.join(tmpDir, 'README.md'), ''); // should not match

        const found = findAllRequirementsFiles(tmpDir);
        assert.strictEqual(found.length, 3);
        assert.ok(found[0].endsWith('requirements-cpu.txt'));
        assert.ok(found[1].endsWith('requirements-dev.txt'));
        assert.ok(found[2].endsWith('requirements.txt'));
    });
});
