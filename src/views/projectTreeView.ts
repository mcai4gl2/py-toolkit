import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';
import { discoverSubprojects, type SubProject } from '../discovery/projects';
import { isVenvValid, getVenvPython } from '../discovery/venv';
import { resolvePackageManager } from '../venv/packageManager';
import { isVenvStale, findRequirementsFile } from '../venv/hash';

// ── Tree item types ────────────────────────────────────────────────

export type TreeItemKind = 'project' | 'detail';

export class ProjectTreeItem extends vscode.TreeItem {
    constructor(
        public readonly kind: TreeItemKind,
        label: string,
        public readonly projectName?: string,
        public readonly projectPath?: string,
        collapsible?: vscode.TreeItemCollapsibleState,
    ) {
        super(label, collapsible ?? vscode.TreeItemCollapsibleState.None);
    }
}

// ── Venv status helper ─────────────────────────────────────────────

type VenvStatus = 'ok' | 'stale' | 'missing';

interface ProjectInfo {
    project: SubProject;
    venvStatus: VenvStatus;
    manager: string;
    pythonVersion: string | undefined;
}

function getPythonVersion(venvPath: string): string | undefined {
    const python = getVenvPython(venvPath);
    try {
        const out = cp.execFileSync(python, ['--version'], {
            encoding: 'utf-8',
            timeout: 5000,
        });
        // "Python 3.11.5\n" → "3.11.5"
        const match = out.match(/(\d+\.\d+\.\d+)/);
        return match?.[1];
    } catch {
        return undefined;
    }
}

function gatherProjectInfo(sp: SubProject): ProjectInfo {
    const venvPath = path.join(sp.absolutePath, '.venv');
    const valid = isVenvValid(venvPath);

    let venvStatus: VenvStatus = 'missing';
    let pythonVersion: string | undefined;

    if (valid) {
        const reqFile = findRequirementsFile(sp.absolutePath);
        venvStatus = reqFile && isVenvStale(venvPath, reqFile) ? 'stale' : 'ok';
        pythonVersion = getPythonVersion(venvPath);
    }

    const manager = resolvePackageManager(sp.absolutePath);
    return { project: sp, venvStatus, manager, pythonVersion };
}

// ── Tree data provider ─────────────────────────────────────────────

export class ProjectTreeDataProvider implements vscode.TreeDataProvider<ProjectTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<ProjectTreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private workspaceRoot: string) {}

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: ProjectTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ProjectTreeItem): ProjectTreeItem[] {
        if (!element) {
            return this.getRootItems();
        }
        if (element.kind === 'project' && element.projectPath) {
            return this.getProjectDetails(element.projectPath, element.projectName!);
        }
        return [];
    }

    // ── Root level: one node per sub-project ───────────────────────

    private getRootItems(): ProjectTreeItem[] {
        const subprojects = discoverSubprojects(this.workspaceRoot);
        return subprojects.map(sp => {
            const info = gatherProjectInfo(sp);
            const icon = info.venvStatus === 'ok'
                ? new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'))
                : info.venvStatus === 'stale'
                    ? new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'))
                    : new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('list.errorForeground'));

            const statusLabel = info.venvStatus === 'ok' ? 'up to date'
                : info.venvStatus === 'stale' ? 'stale' : 'no venv';

            const item = new ProjectTreeItem(
                'project',
                sp.name,
                sp.name,
                sp.absolutePath,
                vscode.TreeItemCollapsibleState.Collapsed,
            );
            item.description = statusLabel;
            item.iconPath = icon;
            item.contextValue = `pyToolkit.project.${info.venvStatus}`;
            item.tooltip = `${sp.name} — ${statusLabel} (${info.manager})`;
            return item;
        });
    }

    // ── Detail level: info rows under a project ────────────────────

    private getProjectDetails(projectPath: string, projectName: string): ProjectTreeItem[] {
        const info = gatherProjectInfo(
            { name: projectName, absolutePath: projectPath, markers: [] } as SubProject,
        );
        const items: ProjectTreeItem[] = [];

        // .venv status
        const venvLabel = info.venvStatus === 'missing'
            ? '.venv  — not created'
            : `.venv  — ${info.venvStatus}`;
        const venvItem = new ProjectTreeItem('detail', venvLabel);
        venvItem.iconPath = new vscode.ThemeIcon('folder');
        items.push(venvItem);

        // Python version
        if (info.pythonVersion) {
            const pyItem = new ProjectTreeItem('detail', `Python ${info.pythonVersion}`);
            pyItem.iconPath = new vscode.ThemeIcon('symbol-misc');
            items.push(pyItem);
        }

        // Package manager
        const mgrItem = new ProjectTreeItem('detail', `Manager: ${info.manager}`);
        mgrItem.iconPath = new vscode.ThemeIcon('package');
        items.push(mgrItem);

        // Markers
        const markers = discoverSubprojects(this.workspaceRoot)
            .find(s => s.name === projectName)?.markers ?? [];
        if (markers.length > 0) {
            const mkItem = new ProjectTreeItem('detail', markers.join(', '));
            mkItem.iconPath = new vscode.ThemeIcon('file-text');
            items.push(mkItem);
        }

        return items;
    }
}
