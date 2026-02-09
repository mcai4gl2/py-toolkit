import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('ligeng.py-toolkit'));
    });

    test('Commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('pyToolkit.createVenv'));
        assert.ok(commands.includes('pyToolkit.discoverProjects'));
        assert.ok(commands.includes('pyToolkit.runTests'));
        assert.ok(commands.includes('pyToolkit.lintFile'));
        assert.ok(commands.includes('pyToolkit.profileFile'));
        assert.ok(commands.includes('pyToolkit.debugFile'));
        assert.ok(commands.includes('pyToolkit.validateWorkspace'));
        assert.ok(commands.includes('pyToolkit.showActions'));
    });
});
