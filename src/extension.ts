import * as vscode from 'vscode';
import { discoverSubprojects } from './discovery/projects';
import { createVenvCommand } from './venv/manager';
import { createStatusBar, updateStatusBar, disposeStatusBar, showActionsCommand } from './views/statusBar';
import { startRequirementsWatcher } from './watchers/requirementsWatcher';
import { runTestsCommand } from './tools/testRunner';
import { lintFileCommand } from './tools/linter';
import { profileFileCommand } from './tools/profiler';
import { debugFileCommand } from './tools/debugger';
import { validateWorkspaceCommand } from './tools/validator';
import { PyToolkitTaskProvider } from './tasks/provider';
import { ProjectTreeDataProvider } from './views/projectTreeView';
import { createVenvForProject, deleteVenv, openTerminalInVenv, installPackage } from './views/treeCommands';

export function activate(context: vscode.ExtensionContext): void {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    // --- Commands (Phase 1) ---
    context.subscriptions.push(
        vscode.commands.registerCommand('pyToolkit.createVenv', createVenvCommand),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('pyToolkit.discoverProjects', () => {
            if (!workspaceRoot) {
                vscode.window.showErrorMessage('py-toolkit: No workspace folder open.');
                return;
            }
            const projects = discoverSubprojects(workspaceRoot);
            if (projects.length === 0) {
                vscode.window.showInformationMessage('py-toolkit: No sub-projects found.');
                return;
            }
            const items = projects.map(p => `${p.name}  (${p.markers.join(', ')})`);
            vscode.window.showQuickPick(items, {
                placeHolder: `Found ${projects.length} sub-project(s)`,
            });
        }),
    );

    // --- Commands (Phase 2: Tool Integration) ---
    context.subscriptions.push(
        vscode.commands.registerCommand('pyToolkit.runTests', runTestsCommand),
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('pyToolkit.lintFile', lintFileCommand),
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('pyToolkit.profileFile', profileFileCommand),
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('pyToolkit.debugFile', debugFileCommand),
    );

    // --- Commands (Phase 3: Tree View & UX) ---
    context.subscriptions.push(
        vscode.commands.registerCommand('pyToolkit.validateWorkspace', validateWorkspaceCommand),
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('pyToolkit.showActions', showActionsCommand),
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('pyToolkit.createVenvForProject', createVenvForProject),
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('pyToolkit.deleteVenv', deleteVenv),
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('pyToolkit.openTerminalInVenv', openTerminalInVenv),
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('pyToolkit.installPackage', installPackage),
    );

    // --- Task Provider (Phase 2) ---
    if (workspaceRoot) {
        context.subscriptions.push(
            vscode.tasks.registerTaskProvider('py-toolkit', new PyToolkitTaskProvider(workspaceRoot)),
        );
    }

    // --- Tree View (Phase 3) ---
    if (workspaceRoot) {
        const treeProvider = new ProjectTreeDataProvider(workspaceRoot);
        context.subscriptions.push(
            vscode.window.registerTreeDataProvider('pyToolkit.projectsView', treeProvider),
        );
        context.subscriptions.push(
            vscode.commands.registerCommand('pyToolkit.refreshTree', () => treeProvider.refresh()),
        );

        // Auto-refresh tree when requirements files change
        const treeWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(workspaceRoot, '**/{requirements*.txt,pyproject.toml,.venv}'),
        );
        treeWatcher.onDidChange(() => treeProvider.refresh());
        treeWatcher.onDidCreate(() => treeProvider.refresh());
        treeWatcher.onDidDelete(() => treeProvider.refresh());
        context.subscriptions.push(treeWatcher);
    }

    // --- Status Bar (Phase 1) ---
    const bar = createStatusBar();
    context.subscriptions.push(bar);
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(() => updateStatusBar()),
    );

    // --- File Watcher (Phase 1) ---
    startRequirementsWatcher(context);
}

export function deactivate(): void {
    disposeStatusBar();
}
