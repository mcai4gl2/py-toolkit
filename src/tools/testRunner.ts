import * as vscode from 'vscode';
import * as path from 'path';
import { get } from '../config';
import { discoverSubprojects } from '../discovery/projects';
import { findVenvForFile, getVenvPython, getProjectForFile } from '../discovery/venv';
import { findTestsForFile, hasTestDir } from '../discovery/tests';
import { runInChannel, requireWorkspaceRoot, requireActivePythonFile } from './run';

/**
 * Command handler for `pyToolkit.runTests`.
 *
 * Modes:
 *   1. Active file is a test file → run it directly with pytest.
 *   2. Active file is a source file → discover related test files, run them.
 *   3. No related tests found → offer to run all project tests.
 */
export async function runTestsCommand(): Promise<void> {
    const workspaceRoot = requireWorkspaceRoot();
    if (!workspaceRoot) return;
    const filePath = requireActivePythonFile();
    if (!filePath) return;

    const subprojects = discoverSubprojects(workspaceRoot);
    const projectName = getProjectForFile(filePath, workspaceRoot, subprojects.map(s => s.name));
    const projectRoot = projectName ? path.join(workspaceRoot, projectName) : workspaceRoot;

    // Resolve Python from venv
    const venvPath = findVenvForFile(filePath, workspaceRoot);
    const python = venvPath ? getVenvPython(venvPath) : 'python3';

    // Default pytest args from settings
    const defaultArgs = get<string[]>('tools.test.defaultArgs', ['-v', '--tb=short']);

    // Determine test target
    const basename = path.basename(filePath);
    const isTestFile = basename.startsWith('test_') || basename.endsWith('_test.py');
    let testTargets: string[];

    if (isTestFile) {
        testTargets = [filePath];
    } else {
        const found = findTestsForFile(filePath, projectRoot);
        if (found.length > 0) {
            testTargets = found;
        } else if (hasTestDir(projectRoot)) {
            const choice = await vscode.window.showWarningMessage(
                `py-toolkit: No tests found for ${basename}. Run all project tests?`,
                'Run All',
                'Cancel',
            );
            if (choice !== 'Run All') return;
            testTargets = [path.join(projectRoot, 'tests')];
        } else {
            vscode.window.showWarningMessage(`py-toolkit: No tests directory in ${projectName ?? 'workspace'}.`);
            return;
        }
    }

    const args = ['-m', 'pytest', ...defaultArgs, ...testTargets];
    const result = await runInChannel(python, args, projectRoot, {
        label: `Test: ${testTargets.map(t => path.relative(workspaceRoot, t)).join(', ')}`,
    });

    if (result.exitCode === 0) {
        vscode.window.showInformationMessage('py-toolkit: Tests passed.');
    } else {
        vscode.window.showWarningMessage(`py-toolkit: Tests failed (exit code ${result.exitCode}).`);
    }
}
