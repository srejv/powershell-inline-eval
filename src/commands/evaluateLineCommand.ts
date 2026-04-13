import * as vscode from 'vscode';
import type { PowerShellSession } from '../powershell/PowerShellSession';
import { formatInlineOutput } from '../ui/inlineOutputFormatter';
import type { InlineResultController } from '../ui/InlineResultController';
import { formatOutputChannelEntry, getCurrentLineExecution } from './evaluateLineContext';

interface EvaluateLineDependencies {
  session: PowerShellSession;
  inlineResults: InlineResultController;
  outputChannel: vscode.OutputChannel;
}

export function createEvaluateLineCommand(
  dependencies: EvaluateLineDependencies
): () => Promise<void> {
  return async (): Promise<void> => {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      await vscode.window.showInformationMessage('Open a PowerShell document to evaluate a line.');
      return;
    }

    if (editor.document.languageId !== 'powershell') {
      await vscode.window.showInformationMessage('Line evaluation is only enabled for PowerShell documents.');
      return;
    }

    const execution = getCurrentLineExecution(editor);

    if (!execution) {
      await vscode.window.showInformationMessage('The current line is empty.');
      return;
    }

    try {
      const result = await dependencies.session.execute(execution.code);
      const inlinePresentation = formatInlineOutput(result.output);
      dependencies.outputChannel.append(formatOutputChannelEntry(execution, result));
      dependencies.inlineResults.show(editor, execution.lineNumber, inlinePresentation.text, result.output, result.isError);

      if (inlinePresentation.revealOutputChannel || result.isError) {
        dependencies.outputChannel.show(true);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      dependencies.inlineResults.show(editor, execution.lineNumber, message, message, true);
      dependencies.outputChannel.appendLine(message);
      dependencies.outputChannel.show(true);
    }
  };
}
