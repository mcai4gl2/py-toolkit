import * as fs from 'fs';
import * as path from 'path';
import { excludePatterns } from '../config';

export interface SubProject {
    /** Relative path from workspace root (e.g. "leetcode" or "mcp/weather") */
    name: string;
    /** Absolute path to the sub-project directory */
    absolutePath: string;
    /** What marker(s) identified this as a project */
    markers: ('requirements.txt' | 'pyproject.toml' | 'py-files')[];
}

const ALWAYS_SKIP = new Set([
    'tools', 'out', '__pycache__', 'node_modules', '.venv', 'venv',
    '.git', '.github', '.vscode', '.devcontainer',
]);

/**
 * Discover sub-projects under `workspaceRoot`.
 *
 * A directory is a sub-project if it directly contains:
 *   - requirements.txt, OR
 *   - pyproject.toml, OR
 *   - *.py files (excluding __pycache__ etc.)
 *
 * Scan is recursive so nested projects like mcp/weather are found.
 */
export function discoverSubprojects(workspaceRoot: string): SubProject[] {
    const results: SubProject[] = [];
    const patterns = excludePatterns();

    function shouldSkip(name: string): boolean {
        if (name.startsWith('.')) return true;
        if (ALWAYS_SKIP.has(name)) return true;
        return patterns.some(p => {
            const bare = p.replace(/\*/g, '');
            return name.includes(bare);
        });
    }

    function isProjectDir(dirPath: string): ('requirements.txt' | 'pyproject.toml' | 'py-files')[] {
        const markers: ('requirements.txt' | 'pyproject.toml' | 'py-files')[] = [];

        if (fs.existsSync(path.join(dirPath, 'requirements.txt'))) {
            markers.push('requirements.txt');
        }
        if (fs.existsSync(path.join(dirPath, 'pyproject.toml'))) {
            markers.push('pyproject.toml');
        }

        // Check for .py files directly in this directory
        if (markers.length === 0) {
            try {
                const entries = fs.readdirSync(dirPath, { withFileTypes: true });
                const hasPy = entries.some(e => e.isFile() && e.name.endsWith('.py'));
                if (hasPy) markers.push('py-files');
            } catch {
                // permission error — skip
            }
        }

        return markers;
    }

    function scan(basePath: string, relativePath: string): void {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(basePath, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            if (shouldSkip(entry.name)) continue;

            const fullPath = path.join(basePath, entry.name);
            const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

            const markers = isProjectDir(fullPath);
            if (markers.length > 0) {
                results.push({ name: relPath, absolutePath: fullPath, markers });
            } else {
                // Not a project itself — scan children for nested projects
                scan(fullPath, relPath);
            }
        }
    }

    scan(workspaceRoot, '');
    return results.sort((a, b) => a.name.localeCompare(b.name));
}
