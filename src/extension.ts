import * as vscode from 'vscode';
import { getPowerShellContextSettings } from './configuration';
import {
  CLEAR_INLINE_RESULT_COMMAND,
  EVALUATE_FILE_COMMAND,
  EVALUATE_LINE_COMMAND,
  EVALUATE_SELECTION_COMMAND,
  OUTPUT_CHANNEL_NAME,
  RESTART_SESSION_COMMAND,
  SETTINGS_SECTION,
  SHOW_SESSION_INFO_COMMAND,
  SHOW_LAST_RESULT_PREVIEW_COMMAND
} from './constants';
import {
  createEvaluateFileCommand,
  createEvaluateLineCommand,
  createEvaluateSelectionCommand
} from './commands/evaluateLineCommand';
import { PowerShellSession } from './powershell/PowerShellSession';
import { formatSessionInfo } from './sessionInfo';
import { InlineResultController } from './ui/InlineResultController';
import { ResultPreviewPanel } from './ui/ResultPreviewPanel';
import { SessionStatusBar } from './ui/SessionStatusBar';

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  const session = new PowerShellSession(outputChannel, getPowerShellContextSettings);
  const inlineResults = new InlineResultController();
  const previewPanel = new ResultPreviewPanel();
  const sessionStatusBar = new SessionStatusBar(session);

  context.subscriptions.push(outputChannel, session, inlineResults, previewPanel, sessionStatusBar);
  context.subscriptions.push(
    vscode.commands.registerCommand(
      EVALUATE_LINE_COMMAND,
      createEvaluateLineCommand({
        session,
        inlineResults,
        previewPanel,
        outputChannel,
        getSettings: getPowerShellContextSettings
      })
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      EVALUATE_SELECTION_COMMAND,
      createEvaluateSelectionCommand({
        session,
        inlineResults,
        previewPanel,
        outputChannel,
        getSettings: getPowerShellContextSettings
      })
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      EVALUATE_FILE_COMMAND,
      createEvaluateFileCommand({
        session,
        inlineResults,
        previewPanel,
        outputChannel,
        getSettings: getPowerShellContextSettings
      })
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(RESTART_SESSION_COMMAND, async () => {
      session.restart();
      sessionStatusBar.refresh();
      await vscode.window.showInformationMessage('PowerShell session restarted.');
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(SHOW_SESSION_INFO_COMMAND, async () => {
      const settings = getPowerShellContextSettings();
      const info = formatSessionInfo(session.getState(), settings);

      outputChannel.appendLine(info);
      outputChannel.show(true);
      await vscode.window.showInformationMessage('PowerShell session info was written to the output channel.');
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(SHOW_LAST_RESULT_PREVIEW_COMMAND, () => {
      previewPanel.showLatest();
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(CLEAR_INLINE_RESULT_COMMAND, () => {
      inlineResults.clear(vscode.window.activeTextEditor);
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(event => {
      if (!event.affectsConfiguration(SETTINGS_SECTION)) {
        return;
      }

      sessionStatusBar.refresh();

      if (event.affectsConfiguration(`${SETTINGS_SECTION}.powerShellExecutable`)) {
        session.restart('PowerShell session restarted after the engine setting changed.');
      }
    })
  );
}

export function deactivate(): void {
  // VS Code disposes subscriptions registered during activation.
}
