import * as fs from 'fs';
import * as path from 'path';

/**
 * Find test files for a given source file.
 *
 * Given `project/problems/p001_two_sum.py`, searches for:
 *   - project/tests/test_p001_two_sum.py
 *   - project/tests/p001_two_sum_test.py
 *   - project/tests/problems/test_p001_two_sum.py
 *   - project/tests/problems/p001_two_sum_test.py
 */
export function findTestsForFile(
    filePath: string,
    projectRoot: string,
): string[] {
    const testDir = path.join(projectRoot, 'tests');
    if (!fs.existsSync(testDir)) return [];

    const rel = path.relative(projectRoot, filePath);
    const stem = path.basename(filePath, '.py');
    const relDir = path.dirname(rel);

    const candidates = [
        path.join(testDir, `test_${stem}.py`),
        path.join(testDir, `${stem}_test.py`),
        path.join(testDir, relDir, `test_${stem}.py`),
        path.join(testDir, relDir, `${stem}_test.py`),
    ];

    return candidates.filter(p => fs.existsSync(p));
}

/**
 * Check whether a project has a tests/ directory.
 */
export function hasTestDir(projectRoot: string): boolean {
    return fs.existsSync(path.join(projectRoot, 'tests'));
}
