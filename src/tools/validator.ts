import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import { discoverSubprojects } from '../discovery/projects';
import { isVenvValid } from '../discovery/venv';
import { isVenvStale, findRequirementsFile } from '../venv/hash';
import { resolvePackageManager } from '../venv/packageManager';
import { minPythonVersion, get } from '../config';
import { getOutputChannel } from './run';

interface CheckResult {
    passed: boolean;
    message: string;
}

function checkPythonVersion(): CheckResult {
    const required = minPythonVersion();
    try {
        const out = cp.execFileSync('python3', ['--version'], { encoding: 'utf-8', timeout: 5000 });
        const match = out.match(/(\d+)\.(\d+)/);
        if (!match) return { passed: false, message: 'Could not determine Python version' };

        const [, major, minor] = match;
        const [reqMaj, reqMin] = required.split('.').map(Number);
        const ok = Number(major) > reqMaj || (Number(major) === reqMaj && Number(minor) >= reqMin);
        return {
            passed: ok,
            message: ok
                ? `Python ${major}.${minor} (requires ${required}+)`
                : `Python ${major}.${minor} is too old (requires ${required}+)`,
        };
    } catch {
        return { passed: false, message: 'python3 not found on PATH' };
    }
}

function checkOutputDirs(workspaceRoot: string): CheckResult {
    const dirs = [
        get<string>('output.baseDir', 'out'),
        get<string>('output.profileDir', 'out/profiles'),
        get<string>('output.testReports', 'out/test-reports'),
        get<string>('output.coverageDir', 'out/coverage'),
    ];
    try {
        for (const d of dirs) {
            fs.mkdirSync(path.join(workspaceRoot, d), { recursive: true });
        }
        return { passed: true, message: 'Output directories are accessible' };
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { passed: false, message: `Failed to create output dirs: ${msg}` };
    }
}

interface ProjectCheckResult {
    project: string;
    passed: boolean;
    message: string;
}

function checkSubprojects(workspaceRoot: string): ProjectCheckResult[] {
    const results: ProjectCheckResult[] = [];
    const subprojects = discoverSubprojects(workspaceRoot);

    for (const sp of subprojects) {
        const venvPath = path.join(sp.absolutePath, '.venv');
        if (!isVenvValid(venvPath)) {
            results.push({ project: sp.name, passed: false, message: 'No virtual environment' });
            continue;
        }

        const reqFile = findRequirementsFile(sp.absolutePath);
        if (reqFile && isVenvStale(venvPath, reqFile)) {
            results.push({ project: sp.name, passed: false, message: 'venv is stale — dependencies changed' });
            continue;
        }

        const mgr = resolvePackageManager(sp.absolutePath);
        results.push({ project: sp.name, passed: true, message: `OK (${mgr})` });
    }

    return results;
}

/**
 * Command handler for `pyToolkit.validateWorkspace`.
 *
 * Runs diagnostic checks and prints a report to the output channel.
 */
export function validateWorkspaceCommand(): void {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        vscode.window.showErrorMessage('py-toolkit: No workspace folder open.');
        return;
    }

    const channel = getOutputChannel();
    channel.show(true);
    channel.appendLine(`\n${'='.repeat(60)}`);
    channel.appendLine('py-toolkit: Workspace Validation');
    channel.appendLine('='.repeat(60));

    let allPassed = true;

    // 1. Python version
    const pyCheck = checkPythonVersion();
    channel.appendLine(`${pyCheck.passed ? '\u2713' : '\u2717'} ${pyCheck.message}`);
    allPassed = allPassed && pyCheck.passed;

    // 2. Output directories
    const outCheck = checkOutputDirs(workspaceRoot);
    channel.appendLine(`${outCheck.passed ? '\u2713' : '\u2717'} ${outCheck.message}`);
    allPassed = allPassed && outCheck.passed;

    // 3. Sub-projects
    channel.appendLine('\nSub-projects:');
    const spResults = checkSubprojects(workspaceRoot);
    if (spResults.length === 0) {
        channel.appendLine('  (none discovered)');
    }
    let anyProjectFailed = false;
    for (const r of spResults) {
        channel.appendLine(`  ${r.passed ? '\u2713' : '\u2717'} ${r.project}: ${r.message}`);
        if (!r.passed) anyProjectFailed = true;
    }

    // Summary
    channel.appendLine(`\n${'='.repeat(60)}`);
    if (allPassed && !anyProjectFailed) {
        channel.appendLine('\u2713 All checks passed');
        vscode.window.showInformationMessage('py-toolkit: Workspace validation passed.');
    } else if (allPassed && anyProjectFailed) {
        channel.appendLine('\u2713 Core checks passed, but some sub-projects need setup');
        vscode.window.showWarningMessage('py-toolkit: Some sub-projects need venv setup — see output.');
    } else {
        channel.appendLine('\u2717 Some checks failed — see above');
        vscode.window.showErrorMessage('py-toolkit: Validation failed — see output.');
    }
}
