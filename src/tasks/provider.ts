import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { discoverSubprojects } from '../discovery/projects';
import { getVenvPython } from '../discovery/venv';
import { get } from '../config';

const TASK_TYPE = 'py-toolkit';

/**
 * Check whether a Python file has a `if __name__` block, making it executable.
 */
function hasMainBlock(filePath: string): boolean {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return /if\s+__name__\s*==\s*['"]__main__['"]/.test(content);
    } catch {
        return false;
    }
}

/**
 * Recursively discover executable Python files in a project.
 */
function discoverExecutableFiles(projectPath: string, excludePatterns: string[]): string[] {
    const results: string[] = [];

    function scan(dir: string): void {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name.startsWith('.') || entry.name === '__pycache__' ||
                    entry.name === 'node_modules' || entry.name === '.venv') {
                    continue;
                }
                const skip = excludePatterns.some(p => entry.name.includes(p.replace(/\*/g, '')));
                if (!skip) scan(full);
            } else if (entry.name.endsWith('.py') && hasMainBlock(full)) {
                results.push(full);
            }
        }
    }

    scan(projectPath);
    return results.sort();
}

/**
 * Dynamic TaskProvider that generates Run / Test / Profile / Lint / Debug
 * tasks for all discovered executable Python files.
 */
export class PyToolkitTaskProvider implements vscode.TaskProvider {
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    provideTasks(): vscode.Task[] {
        const tasks: vscode.Task[] = [];
        const subprojects = discoverSubprojects(this.workspaceRoot);
        const excludePatterns = get<string[]>('projects.excludePatterns', []);
        const testArgs = get<string[]>('tools.test.defaultArgs', ['-v', '--tb=short']);

        // Also look for task variants
        const taskVariants = get<Record<string, { name: string; args: string[]; description?: string }[]>>(
            'taskVariants', {},
        );

        for (const sp of subprojects) {
            const files = discoverExecutableFiles(sp.absolutePath, excludePatterns);
            const venvPath = path.join(sp.absolutePath, '.venv');
            const python = fs.existsSync(getVenvPython(venvPath))
                ? getVenvPython(venvPath)
                : 'python3';

            for (const file of files) {
                const rel = path.relative(this.workspaceRoot, file);

                // --- Run task ---
                tasks.push(this.makeShellTask(
                    `Run: ${rel}`,
                    python, [file],
                    sp.absolutePath,
                ));

                // --- Run with variants ---
                const variants = taskVariants[rel];
                if (variants) {
                    for (const v of variants) {
                        tasks.push(this.makeShellTask(
                            `Run (${v.name}): ${rel}`,
                            python, [file, ...v.args],
                            sp.absolutePath,
                        ));
                    }
                }

                // --- Test task ---
                tasks.push(this.makeShellTask(
                    `Test: ${rel}`,
                    python, ['-m', 'pytest', ...testArgs, path.join(sp.absolutePath, 'tests')],
                    sp.absolutePath,
                    'test',
                ));

                // --- Profile task ---
                tasks.push(this.makeShellTask(
                    `Profile: ${rel}`,
                    python, ['-m', 'cProfile', '-s', 'cumulative', file],
                    sp.absolutePath,
                ));

                // --- Lint task ---
                tasks.push(this.makeShellTask(
                    `Lint: ${rel}`,
                    python, ['-m', 'ruff', 'check', file],
                    sp.absolutePath,
                ));
            }

            // --- Project-level test task ---
            const testDir = path.join(sp.absolutePath, 'tests');
            if (fs.existsSync(testDir)) {
                tasks.push(this.makeShellTask(
                    `Test All: ${sp.name}`,
                    python, ['-m', 'pytest', ...testArgs, testDir],
                    sp.absolutePath,
                    'test',
                ));
            }
        }

        return tasks;
    }

    resolveTask(_task: vscode.Task): vscode.Task | undefined {
        // Tasks are fully resolved in provideTasks
        return undefined;
    }

    private makeShellTask(
        label: string,
        command: string,
        args: string[],
        cwd: string,
        group?: 'test' | 'build',
    ): vscode.Task {
        const definition: vscode.TaskDefinition = { type: TASK_TYPE, task: label };
        const execution = new vscode.ShellExecution(command, args, { cwd });
        const task = new vscode.Task(
            definition,
            vscode.TaskScope.Workspace,
            label,
            'py-toolkit',
            execution,
        );
        if (group === 'test') {
            task.group = vscode.TaskGroup.Test;
        } else if (group === 'build') {
            task.group = vscode.TaskGroup.Build;
        }
        task.presentationOptions = { reveal: vscode.TaskRevealKind.Always };
        return task;
    }
}
