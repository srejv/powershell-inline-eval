import * as vscode from 'vscode';
import { getPowerShellContextSettings } from './configuration';
import {
  CLEAR_INLINE_RESULT_COMMAND,
  EVALUATE_FILE_COMMAND,
  EVALUATE_LINE_COMMAND,
  EVALUATE_SELECTION_COMMAND,
  OUTPUT_CHANNEL_NAME,
  SHOW_LAST_RESULT_PREVIEW_COMMAND
} from './constants';
import {
  createEvaluateFileCommand,
  createEvaluateLineCommand,
  createEvaluateSelectionCommand
} from './commands/evaluateLineCommand';
import { PowerShellSession } from './powershell/PowerShellSession';
import { InlineResultController } from './ui/InlineResultController';
import { ResultPreviewPanel } from './ui/ResultPreviewPanel';

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  const session = new PowerShellSession(outputChannel, getPowerShellContextSettings);
  const inlineResults = new InlineResultController();
  const previewPanel = new ResultPreviewPanel();

  context.subscriptions.push(outputChannel, session, inlineResults, previewPanel);
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
    vscode.commands.registerCommand(SHOW_LAST_RESULT_PREVIEW_COMMAND, () => {
      previewPanel.showLatest();
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(CLEAR_INLINE_RESULT_COMMAND, () => {
      inlineResults.clear(vscode.window.activeTextEditor);
    })
  );
}

export function deactivate(): void {
  // VS Code disposes subscriptions registered during activation.
}
