import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { get } from '../config';
import { findVenvForFile, getVenvPython } from '../discovery/venv';
import { runInChannel, requireWorkspaceRoot, requireActivePythonFile } from './run';

/**
 * Inline Python script that wraps cProfile execution.
 *
 * This runs *inside the venv Python*, profiles the target script, then
 * writes a .stats file and prints the top 20 functions to stdout.
 */
function buildProfileScript(targetFile: string, statsFile: string, txtReport: string): string {
    // Escape backslashes for Windows paths embedded in Python strings
    const esc = (s: string) => s.replace(/\\/g, '\\\\');
    return [
        'import cProfile, pstats, io, sys',
        `target = r"${esc(targetFile)}"`,
        `stats_file = r"${esc(statsFile)}"`,
        `txt_file = r"${esc(txtReport)}"`,
        'profiler = cProfile.Profile()',
        'script_globals = {"__name__": "__main__", "__file__": target}',
        'with open(target) as f: code = compile(f.read(), target, "exec")',
        'try:',
        '    profiler.enable()',
        '    exec(code, script_globals)',
        '    profiler.disable()',
        'except SystemExit: pass',
        'profiler.dump_stats(stats_file)',
        'stream = io.StringIO()',
        'ps = pstats.Stats(profiler, stream=stream)',
        'ps.sort_stats("cumulative")',
        'ps.print_stats(20)',
        'print(stream.getvalue())',
        'with open(txt_file, "w") as f:',
        '    ps2 = pstats.Stats(stats_file, stream=f)',
        '    ps2.sort_stats("cumulative")',
        '    ps2.print_stats()',
    ].join('\n');
}

/**
 * Command handler for `pyToolkit.profileFile`.
 *
 * Profiles the active Python file with cProfile, saving .stats and .txt
 * reports to the configured profile output directory.
 */
export async function profileFileCommand(): Promise<void> {
    const workspaceRoot = requireWorkspaceRoot();
    if (!workspaceRoot) return;
    const filePath = requireActivePythonFile();
    if (!filePath) return;

    const venvPath = findVenvForFile(filePath, workspaceRoot);
    const python = venvPath ? getVenvPython(venvPath) : 'python3';

    // Prepare output directory
    const profileDir = path.join(workspaceRoot, get<string>('output.profileDir', 'out/profiles'));
    fs.mkdirSync(profileDir, { recursive: true });

    const stem = path.basename(filePath, '.py');
    const statsFile = path.join(profileDir, `${stem}_profile.stats`);
    const txtReport = path.join(profileDir, `${stem}_profile.txt`);

    const script = buildProfileScript(filePath, statsFile, txtReport);

    const result = await runInChannel(
        python,
        ['-c', script],
        path.dirname(filePath),
        { label: `Profile: ${path.relative(workspaceRoot, filePath)}` },
    );

    if (result.exitCode === 0) {
        vscode.window.showInformationMessage(
            `py-toolkit: Profile saved to ${path.relative(workspaceRoot, statsFile)}`,
            'Open Report',
        ).then(choice => {
            if (choice === 'Open Report') {
                vscode.workspace.openTextDocument(txtReport).then(doc =>
                    vscode.window.showTextDocument(doc),
                );
            }
        });
    } else {
        vscode.window.showWarningMessage('py-toolkit: Profiling failed — see output for details.');
    }
}
