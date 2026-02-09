import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import { preferredManagers } from '../config';

export type PackageManager = 'uv' | 'venv+pip';

/**
 * Detect the package manager for a project directory.
 *
 * Detection order:
 *   1. `uv.lock` exists → uv
 *   2. `pyproject.toml` contains `[tool.uv]` → uv
 *   3. `pyproject.toml` contains PEP 621 `[project]` + `dependencies` → uv
 *   4. `requirements.txt` exists → venv+pip
 *   5. Fall back to first entry in preferredManagers setting
 */
export function detectPackageManager(projectPath: string): PackageManager {
    // 1. uv.lock is a definitive uv marker
    if (fs.existsSync(path.join(projectPath, 'uv.lock'))) {
        return 'uv';
    }

    // 2-3. Check pyproject.toml for uv or PEP 621 markers
    const pyproject = path.join(projectPath, 'pyproject.toml');
    if (fs.existsSync(pyproject)) {
        const content = fs.readFileSync(pyproject, 'utf-8');
        if (content.includes('[tool.uv]')) return 'uv';
        if (content.includes('[project]') && content.includes('dependencies = [')) return 'uv';
    }

    // 4. Traditional requirements.txt → venv+pip
    if (fs.existsSync(path.join(projectPath, 'requirements.txt'))) {
        return 'venv+pip';
    }

    // 5. Setting-based fallback
    const prefs = preferredManagers();
    return (prefs[0] as PackageManager) ?? 'venv+pip';
}

/**
 * Check whether the `uv` CLI is available on PATH.
 */
export function isUvAvailable(): boolean {
    try {
        cp.execFileSync('uv', ['--version'], { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

/**
 * If the project wants uv but uv is not installed, fall back to venv+pip.
 */
export function resolvePackageManager(projectPath: string): PackageManager {
    const detected = detectPackageManager(projectPath);
    if (detected === 'uv' && !isUvAvailable()) {
        return 'venv+pip';
    }
    return detected;
}
