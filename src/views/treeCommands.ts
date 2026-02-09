import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ProjectTreeItem } from './projectTreeView';
import { createOrUpdateVenv } from '../venv/manager';
import { getVenvPython } from '../discovery/venv';

/**
 * Context-menu command: Create/Update venv for the selected project.
 */
export async function createVenvForProject(item: ProjectTreeItem): Promise<void> {
    if (!item.projectPath || !item.projectName) return;

    try {
        const result = await createOrUpdateVenv(item.projectPath, { force: false });
        if (result.created) {
            vscode.window.showInformationMessage(`py-toolkit: Created venv for ${item.projectName}`);
        } else if (result.updated) {
            vscode.window.showInformationMessage(`py-toolkit: Updated venv for ${item.projectName}`);
        } else {
            vscode.window.showInformationMessage(`py-toolkit: ${item.projectName} venv is already up to date`);
        }
        vscode.commands.executeCommand('pyToolkit.refreshTree');
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`py-toolkit: ${msg}`);
    }
}

/**
 * Context-menu command: Delete venv for the selected project.
 */
export async function deleteVenv(item: ProjectTreeItem): Promise<void> {
    if (!item.projectPath || !item.projectName) return;

    const venvPath = path.join(item.projectPath, '.venv');
    if (!fs.existsSync(venvPath)) {
        vscode.window.showInformationMessage(`py-toolkit: No venv to delete for ${item.projectName}`);
        return;
    }

    const confirm = await vscode.window.showWarningMessage(
        `Delete .venv for ${item.projectName}? This cannot be undone.`,
        { modal: true },
        'Delete',
    );
    if (confirm !== 'Delete') return;

    try {
        fs.rmSync(venvPath, { recursive: true, force: true });
        vscode.window.showInformationMessage(`py-toolkit: Deleted venv for ${item.projectName}`);
        vscode.commands.executeCommand('pyToolkit.refreshTree');
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`py-toolkit: Failed to delete venv — ${msg}`);
    }
}

/**
 * Context-menu command: Open a terminal activated inside the project's venv.
 */
export function openTerminalInVenv(item: ProjectTreeItem): void {
    if (!item.projectPath || !item.projectName) return;

    const venvPath = path.join(item.projectPath, '.venv');
    const python = getVenvPython(venvPath);

    // Determine the activate script path
    let activateCmd: string;
    if (process.platform === 'win32') {
        activateCmd = path.join(venvPath, 'Scripts', 'activate.bat');
    } else {
        activateCmd = `source ${path.join(venvPath, 'bin', 'activate')}`;
    }

    const terminal = vscode.window.createTerminal({
        name: `py-toolkit: ${item.projectName}`,
        cwd: item.projectPath,
        env: { VIRTUAL_ENV: venvPath },
    });

    // Send activate command so the prompt shows (venv)
    if (fs.existsSync(python)) {
        terminal.sendText(activateCmd);
    }
    terminal.show();
}

/**
 * Context-menu command: Install a package into the project's venv.
 */
export async function installPackage(item: ProjectTreeItem): Promise<void> {
    if (!item.projectPath || !item.projectName) return;

    const venvPath = path.join(item.projectPath, '.venv');
    const python = getVenvPython(venvPath);
    if (!fs.existsSync(python)) {
        vscode.window.showErrorMessage(`py-toolkit: No venv found for ${item.projectName}. Create one first.`);
        return;
    }

    const pkg = await vscode.window.showInputBox({
        prompt: `Install package into ${item.projectName}/.venv`,
        placeHolder: 'e.g. requests, numpy==1.26.0',
    });
    if (!pkg) return;

    const terminal = vscode.window.createTerminal({
        name: `pip install: ${item.projectName}`,
        cwd: item.projectPath,
    });
    const pip = process.platform === 'win32'
        ? path.join(venvPath, 'Scripts', 'pip.exe')
        : path.join(venvPath, 'bin', 'pip');
    terminal.sendText(`${pip} install ${pkg}`);
    terminal.show();
}
