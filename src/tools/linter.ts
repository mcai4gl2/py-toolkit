import * as vscode from 'vscode';
import * as path from 'path';
import { get } from '../config';
import { findVenvForFile, getVenvPython } from '../discovery/venv';
import { runInChannel, requireWorkspaceRoot, requireActivePythonFile, getOutputChannel } from './run';

interface LintToolConfig {
    name: string;
    settingKey: string;
    buildArgs: (target: string) => string[];
}

const LINT_TOOLS: LintToolConfig[] = [
    {
        name: 'ruff',
        settingKey: 'tools.lint.ruff',
        buildArgs: (target) => {
            const args = get<string[]>('tools.lint.ruff.args', ['check', '--select=E,F,W,I']);
            return ['ruff', ...args, target];
        },
    },
    {
        name: 'mypy',
        settingKey: 'tools.lint.mypy',
        buildArgs: (target) => {
            const args = get<string[]>('tools.lint.mypy.args', ['--strict', '--ignore-missing-imports']);
            return ['mypy', ...args, target];
        },
    },
    {
        name: 'black',
        settingKey: 'tools.lint.black',
        buildArgs: (target) => {
            const args = get<string[]>('tools.lint.black.args', ['--check', '--line-length=100']);
            return ['black', ...args, target];
        },
    },
];

/**
 * Command handler for `pyToolkit.lintFile`.
 *
 * Runs enabled lint tools (ruff, mypy, black) sequentially on the active file.
 * Each tool's enabled state and arguments come from VS Code settings.
 */
export async function lintFileCommand(): Promise<void> {
    const workspaceRoot = requireWorkspaceRoot();
    if (!workspaceRoot) return;
    const filePath = requireActivePythonFile();
    if (!filePath) return;

    const venvPath = findVenvForFile(filePath, workspaceRoot);
    const python = venvPath ? getVenvPython(venvPath) : 'python3';
    const cwd = path.dirname(filePath);

    const channel = getOutputChannel();
    channel.show(true);
    channel.appendLine(`\n${'='.repeat(60)}`);
    channel.appendLine(`Lint: ${path.relative(workspaceRoot, filePath)}`);
    channel.appendLine('='.repeat(60));

    let failures = 0;

    for (const tool of LINT_TOOLS) {
        const enabled = get<boolean>(`${tool.settingKey}.enabled`, true);
        if (!enabled) {
            channel.appendLine(`\n[${tool.name}] skipped (disabled in settings)`);
            continue;
        }

        // Build args — tool binaries are run via `python -m <tool>` to use venv
        const toolArgs = tool.buildArgs(filePath);
        // toolArgs[0] is the tool name, rest are args
        const moduleName = toolArgs[0];
        const moduleArgs = toolArgs.slice(1);

        const result = await runInChannel(
            python,
            ['-m', moduleName, ...moduleArgs],
            cwd,
            { label: `[${tool.name}]` },
        );

        if (result.exitCode !== 0) {
            failures++;
        }
    }

    if (failures === 0) {
        vscode.window.showInformationMessage('py-toolkit: All lint checks passed.');
    } else {
        vscode.window.showWarningMessage(`py-toolkit: ${failures} lint tool(s) reported issues.`);
    }
}
