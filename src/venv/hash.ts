import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const HASH_FILENAME = '.requirements-hash';

/**
 * Compute the MD5 hex digest of a file's contents.
 */
export function hashFile(filePath: string): string {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Read the stored requirements hash from inside a venv.
 * Returns `undefined` if the hash file does not exist.
 */
export function readStoredHash(venvPath: string): string | undefined {
    const hashFile = path.join(venvPath, HASH_FILENAME);
    if (!fs.existsSync(hashFile)) return undefined;
    return fs.readFileSync(hashFile, 'utf-8').trim();
}

/**
 * Write a requirements hash into the venv directory.
 */
export function writeHash(venvPath: string, hash: string): void {
    fs.writeFileSync(path.join(venvPath, HASH_FILENAME), hash + '\n', 'utf-8');
}

/**
 * Check whether a venv is stale relative to a requirements file.
 *
 * Returns `true` when:
 *   - The venv has no stored hash (first install or manual venv)
 *   - The stored hash differs from the current requirements hash
 */
export function isVenvStale(venvPath: string, requirementsPath: string): boolean {
    const stored = readStoredHash(venvPath);
    if (stored === undefined) return true;
    const current = hashFile(requirementsPath);
    return stored !== current;
}

/**
 * Find the primary requirements file for a project directory.
 * Returns the first match from a priority list, or `undefined`.
 */
export function findRequirementsFile(projectPath: string): string | undefined {
    const candidates = [
        'requirements.txt',
        'requirements-dev.txt',
        'requirements-cpu.txt',
    ];

    for (const name of candidates) {
        const full = path.join(projectPath, name);
        if (fs.existsSync(full)) return full;
    }

    return undefined;
}

/**
 * Find all requirements*.txt files in a project directory.
 */
export function findAllRequirementsFiles(projectPath: string): string[] {
    try {
        return fs.readdirSync(projectPath)
            .filter(f => /^requirements.*\.txt$/.test(f))
            .map(f => path.join(projectPath, f))
            .sort();
    } catch {
        return [];
    }
}
