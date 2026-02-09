import * as vscode from 'vscode';
import * as cp from 'child_process';

/**
 * Shared output channel for all py-toolkit tool runs.
 * Lazily created on first use.
 */
let _channel: vscode.OutputChannel | undefined;

export function getOutputChannel(): vscode.OutputChannel {
    if (!_channel) {
        _channel = vscode.window.createOutputChannel('py-toolkit');
    }
    return _channel;
}

export interface RunResult {
    exitCode: number;
    stdout: string;
    stderr: string;
}

/**
 * Spawn a command, streaming output to the py-toolkit output channel.
 * Returns a promise that resolves with exit code and captured output.
 */
export function runInChannel(
    command: string,
    args: string[],
    cwd: string,
    options?: { label?: string },
): Promise<RunResult> {
    const channel = getOutputChannel();
    channel.show(true);

    if (options?.label) {
        channel.appendLine(`\n${'='.repeat(60)}`);
        channel.appendLine(options.label);
        channel.appendLine('='.repeat(60));
    }
    channel.appendLine(`> ${command} ${args.join(' ')}`);
    channel.appendLine(`  cwd: ${cwd}\n`);

    return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';

        const proc = cp.spawn(command, args, {
            cwd,
            shell: process.platform === 'win32',
        });

        proc.stdout?.on('data', (data: Buffer) => {
            const text = data.toString();
            stdout += text;
            channel.append(text);
        });

        proc.stderr?.on('data', (data: Buffer) => {
            const text = data.toString();
            stderr += text;
            channel.append(text);
        });

        proc.on('close', code => {
            const exitCode = code ?? 1;
            channel.appendLine(`\nExited with code ${exitCode}`);
            resolve({ exitCode, stdout, stderr });
        });

        proc.on('error', err => {
            channel.appendLine(`\nProcess error: ${err.message}`);
            reject(err);
        });
    });
}

/**
 * Get the workspace root or show an error and return undefined.
 */
export function requireWorkspaceRoot(): string | undefined {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) {
        vscode.window.showErrorMessage('py-toolkit: No workspace folder open.');
    }
    return root;
}

/**
 * Get the active Python file or show an error and return undefined.
 */
export function requireActivePythonFile(): string | undefined {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'python') {
        vscode.window.showErrorMessage('py-toolkit: Open a Python file first.');
        return undefined;
    }
    return editor.document.uri.fsPath;
}
