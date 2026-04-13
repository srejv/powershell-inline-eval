import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { clearSessionFactoryForTests, setSessionFactoryForTests } from '../../../src/extensionTestHooks';
import { getExtensionDebugState } from '../../../src/extension';

describe('Extension activation', () => {
  before(async () => {
    setSessionFactoryForTests(() => {
      const listeners = new Set<(state: { activeExecutable: string | undefined; preferredExecutable: 'auto'; hasActiveProcess: boolean }) => void>();

      return {
        async execute(code: string) {
          return {
            code,
            output: 'hello from extension test',
            isError: false,
            durationMs: 1,
            metadata: {
              kind: 'scalar',
              preview: 'hello from extension test',
              itemCount: 1
            }
          };
        },
        getState() {
          return {
            activeExecutable: 'powershell',
            preferredExecutable: 'auto' as const,
            hasActiveProcess: true
          };
        },
        onDidChangeState(listener: (state: { activeExecutable: string | undefined; preferredExecutable: 'auto'; hasActiveProcess: boolean }) => void) {
          listeners.add(listener);
          return {
            dispose: () => {
              listeners.delete(listener);
            }
          };
        },
        restart() {
          for (const listener of listeners) {
            listener({
              activeExecutable: 'powershell',
              preferredExecutable: 'auto',
              hasActiveProcess: true
            });
          }
        },
        dispose() {
          listeners.clear();
        }
      };
    });
  });

  after(() => {
    clearSessionFactoryForTests();
  });

  it('registers the evaluation commands', async () => {
    const extension = vscode.extensions.getExtension('srejv.powershell-context');

    assert.ok(extension);
    await extension.activate();

    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('powershellContext.evaluateLine'));
    assert.ok(commands.includes('powershellContext.evaluateSelection'));
    assert.ok(commands.includes('powershellContext.evaluateFile'));
    assert.ok(commands.includes('powershellContext.restartSession'));
    assert.ok(commands.includes('powershellContext.showSessionInfo'));
    assert.ok(commands.includes('powershellContext.showLastResultPreview'));
    assert.ok(commands.includes('powershellContext.clearInlineResult'));
  });

  it('executes a PowerShell line end to end', async function () {
    this.timeout(15000);

    const extension = vscode.extensions.getExtension('srejv.powershell-context');

    assert.ok(extension);
    await extension.activate();

    await vscode.workspace.getConfiguration('powershellContext').update('outputChannel.autoOpen', 'never', vscode.ConfigurationTarget.Global);
    await vscode.workspace.getConfiguration('powershellContext').update('previewPanel.autoOpen', 'never', vscode.ConfigurationTarget.Global);

    const document = await vscode.workspace.openTextDocument({
      language: 'powershell',
      content: "Write-Output 'hello from extension test'"
    });
    const editor = await vscode.window.showTextDocument(document);

    editor.selection = new vscode.Selection(0, 0, 0, 0);
    await vscode.commands.executeCommand('powershellContext.evaluateLine');

    const debugState = getExtensionDebugState();

    assert.ok(debugState.lastEvaluation);
    assert.equal(debugState.lastEvaluation.execution.code, "Write-Output 'hello from extension test'");
    assert.equal(debugState.lastEvaluation.result.isError, false);
    assert.match(debugState.lastEvaluation.result.output, /hello from extension test/);
  });
});
