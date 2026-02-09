import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { get } from '../config';
import { findVenvForFile, getVenvPython } from '../discovery/venv';
import { runInChannel, requireWorkspaceRoot, requireActivePythonFile } from './run';

/**
 * Inline Python script that runs a target file with exception capture.
 *
 * On uncaught exception it writes a crash dump directory containing:
 *   - exception.txt   (type + message)
 *   - traceback.txt    (full traceback)
 *   - metadata.json    (timestamp, file, python version)
 *   - analysis.md      (human-readable report)
 */
function buildDebugScript(targetFile: string, crashDir: string): string {
    const esc = (s: string) => s.replace(/\\/g, '\\\\');
    return [
        'import sys, os, json, traceback, io',
        'from datetime import datetime',
        `target = r"${esc(targetFile)}"`,
        `crash_base = r"${esc(crashDir)}"`,
        'script_globals = {"__name__": "__main__", "__file__": target}',
        'with open(target) as f: code = compile(f.read(), target, "exec")',
        'try:',
        '    exec(code, script_globals)',
        'except SystemExit:',
        '    pass',
        'except Exception:',
        '    et, ev, tb = sys.exc_info()',
        '    ts = datetime.now().strftime("%Y%m%d_%H%M%S")',
        '    cdir = os.path.join(crash_base, f"crash_{ts}")',
        '    os.makedirs(cdir, exist_ok=True)',
        '    with open(os.path.join(cdir, "exception.txt"), "w") as f:',
        '        f.write(f"Exception Type: {et.__name__}\\n")',
        '        f.write(f"Exception Message: {ev}\\n")',
        '    with open(os.path.join(cdir, "traceback.txt"), "w") as f:',
        '        traceback.print_exception(et, ev, tb, file=f)',
        '    meta = {"timestamp": ts, "target_file": target,',
        '            "python_version": sys.version,',
        '            "exception_type": et.__name__,',
        '            "exception_message": str(ev)}',
        '    with open(os.path.join(cdir, "metadata.json"), "w") as f:',
        '        json.dump(meta, f, indent=2)',
        '    with open(os.path.join(cdir, "analysis.md"), "w") as f:',
        '        f.write(f"# Crash Analysis\\n\\n")',
        '        f.write(f"**File:** `{target}`\\n")',
        '        f.write(f"**Time:** {datetime.now():%Y-%m-%d %H:%M:%S}\\n")',
        '        f.write(f"**Exception:** `{et.__name__}: {ev}`\\n\\n")',
        '        f.write("## Traceback\\n\\n```\\n")',
        '        traceback.print_exception(et, ev, tb, file=f)',
        '        f.write("```\\n")',
        '    buf = io.StringIO()',
        '    traceback.print_exception(et, ev, tb, file=buf)',
        '    print(buf.getvalue(), file=sys.stderr)',
        '    print(f"\\nCrash dump saved to: {cdir}", file=sys.stderr)',
        '    sys.exit(1)',
    ].join('\n');
}

/**
 * Command handler for `pyToolkit.debugFile`.
 *
 * Runs the active Python file with exception capture.
 * On crash, saves a detailed dump to out/crashes/ and offers to open it.
 */
export async function debugFileCommand(): Promise<void> {
    const workspaceRoot = requireWorkspaceRoot();
    if (!workspaceRoot) return;
    const filePath = requireActivePythonFile();
    if (!filePath) return;

    const venvPath = findVenvForFile(filePath, workspaceRoot);
    const python = venvPath ? getVenvPython(venvPath) : 'python3';

    const crashDir = path.join(workspaceRoot, get<string>('output.baseDir', 'out'), 'crashes');
    fs.mkdirSync(crashDir, { recursive: true });

    const script = buildDebugScript(filePath, crashDir);

    const result = await runInChannel(
        python,
        ['-c', script],
        path.dirname(filePath),
        { label: `Debug: ${path.relative(workspaceRoot, filePath)}` },
    );

    if (result.exitCode === 0) {
        vscode.window.showInformationMessage('py-toolkit: Script completed without errors.');
    } else {
        // Try to extract crash directory from stderr
        const match = result.stderr.match(/Crash dump saved to: (.+)/);
        if (match) {
            const dumpPath = match[1].trim();
            const analysisFile = path.join(dumpPath, 'analysis.md');
            vscode.window.showWarningMessage(
                `py-toolkit: Script crashed. Dump saved.`,
                'Open Analysis',
            ).then(choice => {
                if (choice === 'Open Analysis' && fs.existsSync(analysisFile)) {
                    vscode.workspace.openTextDocument(analysisFile).then(doc =>
                        vscode.window.showTextDocument(doc),
                    );
                }
            });
        } else {
            vscode.window.showWarningMessage(`py-toolkit: Script failed (exit code ${result.exitCode}).`);
        }
    }
}
