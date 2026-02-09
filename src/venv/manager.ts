import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';
import * as fs from 'fs';
import { resolvePackageManager, type PackageManager } from './packageManager';
import { hashFile, writeHash, isVenvStale, findRequirementsFile, findAllRequirementsFiles } from './hash';
import { getVenvPython, isVenvValid } from '../discovery/venv';
import { discoverSubprojects, type SubProject } from '../discovery/projects';

export interface CreateVenvResult {
    venvPath: string;
    manager: PackageManager;
    created: boolean;
    updated: boolean;
}

/**
 * Create or update a virtual environment for a project.
 *
 * - If the venv does not exist, create it and install dependencies.
 * - If the venv exists but is stale (requirements hash changed), reinstall.
 * - If the venv is up to date, skip.
 */
export async function createOrUpdateVenv(
    projectPath: string,
    options?: { force?: boolean; requirementsFile?: string },
): Promise<CreateVenvResult> {
    const manager = resolvePackageManager(projectPath);
    const venvPath = path.join(projectPath, '.venv');
    const reqFile = options?.requirementsFile ?? findRequirementsFile(projectPath);
    const force = options?.force ?? false;

    const exists = isVenvValid(venvPath);

    // Determine if we need to act
    if (exists && !force && reqFile && !isVenvStale(venvPath, reqFile)) {
        return { venvPath, manager, created: false, updated: false };
    }

    const channel = vscode.window.createOutputChannel('py-toolkit');
    channel.show(true);

    // Create venv if it doesn't exist
    if (!exists) {
        channel.appendLine(`Creating venv at ${venvPath} using ${manager}...`);
        if (manager === 'uv') {
            await runCommand('uv', ['venv', venvPath], projectPath, channel);
        } else {
            await runCommand('python3', ['-m', 'venv', venvPath], projectPath, channel);
        }
    }

    // Install dependencies
    if (reqFile) {
        channel.appendLine(`Installing dependencies from ${path.basename(reqFile)}...`);
        if (manager === 'uv') {
            await runCommand('uv', ['pip', 'install', '-r', reqFile, '--python', getVenvPython(venvPath)], projectPath, channel);
        } else {
            const pip = process.platform === 'win32'
                ? path.join(venvPath, 'Scripts', 'pip.exe')
                : path.join(venvPath, 'bin', 'pip');
            await runCommand(pip, ['install', '-r', reqFile], projectPath, channel);
        }

        // Write hash
        const hash = hashFile(reqFile);
        writeHash(venvPath, hash);
        channel.appendLine(`Saved requirements hash: ${hash}`);
    } else if (manager === 'uv' && fs.existsSync(path.join(projectPath, 'pyproject.toml'))) {
        // uv projects with pyproject.toml use `uv sync`
        channel.appendLine('Running uv sync...');
        await runCommand('uv', ['sync'], projectPath, channel);
    }

    channel.appendLine('Done.');
    return { venvPath, manager, created: !exists, updated: exists };
}

/**
 * Run a shell command, streaming output to the given channel.
 */
function runCommand(
    command: string,
    args: string[],
    cwd: string,
    channel: vscode.OutputChannel,
): Promise<void> {
    return new Promise((resolve, reject) => {
        channel.appendLine(`> ${command} ${args.join(' ')}`);
        const proc = cp.spawn(command, args, { cwd, shell: process.platform === 'win32' });

        proc.stdout?.on('data', (data: Buffer) => channel.append(data.toString()));
        proc.stderr?.on('data', (data: Buffer) => channel.append(data.toString()));

        proc.on('close', code => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command exited with code ${code}`));
            }
        });
        proc.on('error', reject);
    });
}

/**
 * VS Code command handler for `pyToolkit.createVenv`.
 *
 * If a Python file is open, creates/updates the venv for its project.
 * Otherwise shows a quick-pick of discovered sub-projects.
 */
export async function createVenvCommand(): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        vscode.window.showErrorMessage('py-toolkit: No workspace folder open.');
        return;
    }

    const subprojects = discoverSubprojects(workspaceRoot);
    if (subprojects.length === 0) {
        vscode.window.showInformationMessage('py-toolkit: No sub-projects found.');
        return;
    }

    // Pick a project
    let target: SubProject;
    if (subprojects.length === 1) {
        target = subprojects[0];
    } else {
        const items = subprojects.map(sp => ({
            label: sp.name,
            description: sp.markers.join(', '),
            project: sp,
        }));
        const picked = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select sub-project to create/update venv for',
        });
        if (!picked) return;
        target = picked.project;
    }

    // If multiple requirements files, let user choose
    const allReqs = findAllRequirementsFiles(target.absolutePath);
    let reqFile: string | undefined;
    if (allReqs.length > 1) {
        const pick = await vscode.window.showQuickPick(
            allReqs.map(f => ({ label: path.basename(f), description: f, file: f })),
            { placeHolder: 'Multiple requirements files found — choose one' },
        );
        if (!pick) return;
        reqFile = pick.file;
    } else if (allReqs.length === 1) {
        reqFile = allReqs[0];
    }

    try {
        const result = await createOrUpdateVenv(target.absolutePath, { requirementsFile: reqFile });
        if (result.created) {
            vscode.window.showInformationMessage(`py-toolkit: Created venv for ${target.name} (${result.manager})`);
        } else if (result.updated) {
            vscode.window.showInformationMessage(`py-toolkit: Updated venv for ${target.name}`);
        } else {
            vscode.window.showInformationMessage(`py-toolkit: venv for ${target.name} is already up to date`);
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`py-toolkit: Failed to create venv — ${message}`);
    }
}
