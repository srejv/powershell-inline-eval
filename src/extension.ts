import * as vscode from 'vscode';
import {
  CLEAR_INLINE_RESULT_COMMAND,
  EVALUATE_LINE_COMMAND,
  OUTPUT_CHANNEL_NAME
} from './constants';
import { createEvaluateLineCommand } from './commands/evaluateLineCommand';
import { PowerShellSession } from './powershell/PowerShellSession';
import { InlineResultController } from './ui/InlineResultController';

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  const session = new PowerShellSession(outputChannel);
  const inlineResults = new InlineResultController();

  context.subscriptions.push(outputChannel, session, inlineResults);
  context.subscriptions.push(
    vscode.commands.registerCommand(
      EVALUATE_LINE_COMMAND,
      createEvaluateLineCommand({
        session,
        inlineResults,
        outputChannel
      })
    )
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
