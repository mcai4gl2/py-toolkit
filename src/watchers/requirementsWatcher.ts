import * as vscode from 'vscode';
import * as path from 'path';
import { isVenvStale, findRequirementsFile } from '../venv/hash';
import { isVenvValid } from '../discovery/venv';

let watcher: vscode.FileSystemWatcher | undefined;

/**
 * Start watching for changes to requirements.txt and pyproject.toml.
 *
 * When a dependency file changes:
 *   1. Find the nearest .venv relative to that file.
 *   2. If the venv exists and the hash differs, show a notification with
 *      a one-click "Update" action.
 */
export function startRequirementsWatcher(context: vscode.ExtensionContext): void {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return;

    // Watch requirements*.txt and pyproject.toml across the entire workspace
    watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(workspaceRoot, '**/{requirements*.txt,pyproject.toml}'),
    );

    const handleChange = (uri: vscode.Uri) => {
        const filePath = uri.fsPath;
        const projectDir = path.dirname(filePath);
        const venvPath = path.join(projectDir, '.venv');

        // Only notify if a venv already exists for this project
        if (!isVenvValid(venvPath)) return;

        // Only notify for requirements.txt changes (pyproject.toml staleness
        // is harder to hash — we check the associated requirements file)
        const reqFile = findRequirementsFile(projectDir);
        if (!reqFile) return;

        if (isVenvStale(venvPath, reqFile)) {
            const projectName = path.relative(workspaceRoot, projectDir) || path.basename(projectDir);
            vscode.window
                .showWarningMessage(
                    `py-toolkit: Dependencies changed in ${projectName}. Update venv?`,
                    'Update',
                    'Dismiss',
                )
                .then(choice => {
                    if (choice === 'Update') {
                        vscode.commands.executeCommand('pyToolkit.createVenv');
                    }
                });
        }
    };

    watcher.onDidChange(handleChange);
    watcher.onDidCreate(handleChange);

    context.subscriptions.push(watcher);
}

export function stopRequirementsWatcher(): void {
    watcher?.dispose();
    watcher = undefined;
}
