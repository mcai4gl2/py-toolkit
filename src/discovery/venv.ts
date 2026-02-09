import * as fs from 'fs';
import * as path from 'path';

/**
 * Walk up from `filePath` towards `workspaceRoot`, returning the first
 * `.venv/` directory found. Returns `undefined` if none exists.
 */
export function findVenvForFile(filePath: string, workspaceRoot: string): string | undefined {
    let current = fs.statSync(filePath).isDirectory() ? filePath : path.dirname(filePath);
    const root = path.resolve(workspaceRoot);

    while (current.startsWith(root)) {
        const candidate = path.join(current, '.venv');
        if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
            return candidate;
        }
        if (current === root) break;
        current = path.dirname(current);
    }

    return undefined;
}

/**
 * Get the platform-appropriate Python executable inside a venv.
 */
export function getVenvPython(venvPath: string): string {
    if (process.platform === 'win32') {
        return path.join(venvPath, 'Scripts', 'python.exe');
    }
    return path.join(venvPath, 'bin', 'python');
}

/**
 * Get the platform-appropriate pip executable inside a venv.
 */
export function getVenvPip(venvPath: string): string {
    if (process.platform === 'win32') {
        return path.join(venvPath, 'Scripts', 'pip.exe');
    }
    return path.join(venvPath, 'bin', 'pip');
}

/**
 * Check whether a venv directory exists and contains a usable Python binary.
 */
export function isVenvValid(venvPath: string): boolean {
    const python = getVenvPython(venvPath);
    return fs.existsSync(python);
}

/**
 * Determine which sub-project (relative path) a file belongs to, given a
 * list of known sub-project relative paths.
 */
export function getProjectForFile(
    filePath: string,
    workspaceRoot: string,
    subprojectNames: string[],
): string | undefined {
    const rel = path.relative(workspaceRoot, filePath);
    // Sort longest-first so nested projects match before parents
    const sorted = [...subprojectNames].sort((a, b) => b.length - a.length);
    for (const sp of sorted) {
        if (rel.startsWith(sp + path.sep) || rel.startsWith(sp + '/')) {
            return sp;
        }
    }
    return undefined;
}
