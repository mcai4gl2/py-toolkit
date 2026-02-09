/**
 * Mocha setup file for unit tests.
 *
 * Registers a lightweight mock for the `vscode` module so that source files
 * which transitively depend on it (e.g. config.ts) can be loaded outside a
 * real VS Code host.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import Module from 'module';

const vscodeStub: any = {
    workspace: {
        getConfiguration(_section?: string) {
            return {
                get<T>(_key: string, defaultValue: T): T {
                    return defaultValue;
                },
            };
        },
    },
    window: {
        createOutputChannel() {
            return { appendLine() {}, show() {}, dispose() {} };
        },
        showInformationMessage() { return Promise.resolve(undefined); },
        showWarningMessage() { return Promise.resolve(undefined); },
        showErrorMessage() { return Promise.resolve(undefined); },
    },
    Uri: { file(p: string) { return { fsPath: p }; } },
    TreeItem: class {},
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    ThemeIcon: class { constructor(public id: string) {} },
    EventEmitter: class { event = () => {}; fire() {} dispose() {} },
};

// Intercept require('vscode') so it returns our stub
const originalResolve = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (
    request: string,
    parent: any,
    isMain: boolean,
    options: any,
) {
    if (request === 'vscode') {
        // Return a path that we can hook into via the require cache
        return 'vscode';
    }
    return originalResolve.call(this, request, parent, isMain, options);
};

require.cache['vscode'] = {
    id: 'vscode',
    filename: 'vscode',
    loaded: true,
    exports: vscodeStub,
} as any;
