import * as vscode from 'vscode';

const SECTION = 'pyToolkit';

export function get<T>(key: string, fallback: T): T {
    return vscode.workspace.getConfiguration(SECTION).get<T>(key, fallback);
}

export function minPythonVersion(): string {
    return get<string>('python.minVersion', '3.10');
}

export function preferredManagers(): string[] {
    return get<string[]>('python.preferredManagers', ['uv', 'venv+pip']);
}

export function pypiMirror(): string {
    return get<string>('python.pypiMirror', 'auto');
}

export function excludePatterns(): string[] {
    return get<string[]>('projects.excludePatterns', [
        '*.venv', '__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache', 'node_modules',
    ]);
}

export function outputBaseDir(): string {
    return get<string>('output.baseDir', 'out');
}
