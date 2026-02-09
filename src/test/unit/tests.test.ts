import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { findTestsForFile, hasTestDir } from '../../discovery/tests';

suite('discovery/tests', () => {
    let tmpDir: string;

    setup(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pytoolkit-test-'));
    });

    teardown(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // ── hasTestDir ────────────────────────────────────────────

    test('hasTestDir returns false when no tests/ directory', () => {
        assert.strictEqual(hasTestDir(tmpDir), false);
    });

    test('hasTestDir returns true when tests/ exists', () => {
        fs.mkdirSync(path.join(tmpDir, 'tests'));
        assert.strictEqual(hasTestDir(tmpDir), true);
    });

    // ── findTestsForFile ──────────────────────────────────────

    test('findTestsForFile returns empty when no tests/ directory', () => {
        fs.writeFileSync(path.join(tmpDir, 'app.py'), '');
        assert.deepStrictEqual(
            findTestsForFile(path.join(tmpDir, 'app.py'), tmpDir),
            [],
        );
    });

    test('findTestsForFile finds test_<stem>.py in subdirectory', () => {
        const src = path.join(tmpDir, 'src');
        fs.mkdirSync(src);
        fs.mkdirSync(path.join(tmpDir, 'tests'));
        fs.writeFileSync(path.join(tmpDir, 'tests', 'test_app.py'), '');
        fs.writeFileSync(path.join(src, 'app.py'), '');

        const found = findTestsForFile(path.join(src, 'app.py'), tmpDir);
        assert.ok(found.length >= 1);
        assert.ok(found.some(f => f.endsWith('test_app.py')));
    });

    test('findTestsForFile finds <stem>_test.py in subdirectory', () => {
        const src = path.join(tmpDir, 'src');
        fs.mkdirSync(src);
        fs.mkdirSync(path.join(tmpDir, 'tests'));
        fs.writeFileSync(path.join(tmpDir, 'tests', 'app_test.py'), '');
        fs.writeFileSync(path.join(src, 'app.py'), '');

        const found = findTestsForFile(path.join(src, 'app.py'), tmpDir);
        assert.ok(found.length >= 1);
        assert.ok(found.some(f => f.endsWith('app_test.py')));
    });

    test('findTestsForFile finds nested test file matching subdirectory', () => {
        // project/problems/solver.py → tests/problems/test_solver.py
        const problems = path.join(tmpDir, 'problems');
        const testsProblems = path.join(tmpDir, 'tests', 'problems');
        fs.mkdirSync(problems, { recursive: true });
        fs.mkdirSync(testsProblems, { recursive: true });
        fs.writeFileSync(path.join(problems, 'solver.py'), '');
        fs.writeFileSync(path.join(testsProblems, 'test_solver.py'), '');

        const found = findTestsForFile(path.join(problems, 'solver.py'), tmpDir);
        assert.ok(found.some(f => f.endsWith(path.join('tests', 'problems', 'test_solver.py'))));
    });

    test('findTestsForFile returns both flat and nested matches', () => {
        const sub = path.join(tmpDir, 'sub');
        fs.mkdirSync(sub, { recursive: true });
        fs.mkdirSync(path.join(tmpDir, 'tests', 'sub'), { recursive: true });

        fs.writeFileSync(path.join(sub, 'foo.py'), '');
        fs.writeFileSync(path.join(tmpDir, 'tests', 'test_foo.py'), '');
        fs.writeFileSync(path.join(tmpDir, 'tests', 'sub', 'test_foo.py'), '');

        const found = findTestsForFile(path.join(sub, 'foo.py'), tmpDir);
        assert.strictEqual(found.length, 2);
    });
});
