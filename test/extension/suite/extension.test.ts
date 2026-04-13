import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';

describe('Extension activation', () => {
  it('registers the evaluation commands', async () => {
    const extension = vscode.extensions.getExtension('srejv.powershell-context');

    assert.ok(extension);
    await extension.activate();

    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('powershellContext.evaluateLine'));
    assert.ok(commands.includes('powershellContext.evaluateSelection'));
    assert.ok(commands.includes('powershellContext.evaluateFile'));
    assert.ok(commands.includes('powershellContext.clearInlineResult'));
  });
});
