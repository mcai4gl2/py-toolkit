import * as vscode from 'vscode';
import * as path from 'path';
import { findVenvForFile, isVenvValid, getProjectForFile } from '../discovery/venv';
import { discoverSubprojects } from '../discovery/projects';
import { resolvePackageManager } from '../venv/packageManager';
import { isVenvStale, findRequirementsFile } from '../venv/hash';

let statusBarItem: vscode.StatusBarItem;

export function createStatusBar(): vscode.StatusBarItem {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
    statusBarItem.command = 'pyToolkit.showActions';
    statusBarItem.tooltip = 'py-toolkit: Click for actions';
    updateStatusBar();
    return statusBarItem;
}

export function updateStatusBar(): void {
    if (!statusBarItem) return;

    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'python') {
        statusBarItem.hide();
        return;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        statusBarItem.hide();
        return;
    }

    const filePath = editor.document.uri.fsPath;
    const subprojects = discoverSubprojects(workspaceRoot);
    const projectName = getProjectForFile(filePath, workspaceRoot, subprojects.map(s => s.name));

    if (!projectName) {
        statusBarItem.text = '$(python) py-toolkit: no project';
        statusBarItem.backgroundColor = undefined;
        statusBarItem.show();
        return;
    }

    const venvPath = findVenvForFile(filePath, workspaceRoot);

    if (!venvPath || !isVenvValid(venvPath)) {
        statusBarItem.text = `$(python) ${projectName} $(circle-slash) no venv`;
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        statusBarItem.show();
        return;
    }

    // Determine staleness
    const projectPath = path.join(workspaceRoot, projectName);
    const reqFile = findRequirementsFile(projectPath);
    const stale = reqFile ? isVenvStale(venvPath, reqFile) : false;
    const manager = resolvePackageManager(projectPath);

    if (stale) {
        statusBarItem.text = `$(python) ${projectName} $(warning) stale | ${manager}`;
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
        statusBarItem.text = `$(python) ${projectName} $(check) | ${manager}`;
        statusBarItem.backgroundColor = undefined;
    }

    statusBarItem.show();
}

/**
 * Quick-pick with common actions for the current project.
 */
export async function showActionsCommand(): Promise<void> {
    const actions: { label: string; description: string; command: string }[] = [
        { label: '$(add)  Create/Update Venv', description: 'Install or update dependencies', command: 'pyToolkit.createVenv' },
        { label: '$(beaker)  Run Tests', description: 'pytest for active file', command: 'pyToolkit.runTests' },
        { label: '$(checklist)  Lint File', description: 'ruff + mypy + black', command: 'pyToolkit.lintFile' },
        { label: '$(dashboard)  Profile File', description: 'cProfile the active file', command: 'pyToolkit.profileFile' },
        { label: '$(bug)  Debug File', description: 'Run with crash capture', command: 'pyToolkit.debugFile' },
        { label: '$(search)  Discover Projects', description: 'Scan workspace for sub-projects', command: 'pyToolkit.discoverProjects' },
        { label: '$(shield)  Validate Workspace', description: 'Check Python, venvs, structure', command: 'pyToolkit.validateWorkspace' },
    ];

    const picked = await vscode.window.showQuickPick(actions, {
        placeHolder: 'py-toolkit: Choose an action',
    });

    if (picked) {
        vscode.commands.executeCommand(picked.command);
    }
}

export function disposeStatusBar(): void {
    statusBarItem?.dispose();
}
