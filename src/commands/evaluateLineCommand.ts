import * as vscode from 'vscode';
import type { PowerShellSession } from '../powershell/PowerShellSession';
import { formatInlineOutput } from '../ui/inlineOutputFormatter';
import type { InlineResultController } from '../ui/InlineResultController';
import {
  formatOutputChannelEntry,
  getCurrentLineExecution,
  getDocumentExecution,
  getSelectionExecution,
  type LineExecutionContext
} from './evaluateLineContext';

interface EvaluateLineDependencies {
  session: PowerShellSession;
  inlineResults: InlineResultController;
  outputChannel: vscode.OutputChannel;
}

export function createEvaluateLineCommand(
  dependencies: EvaluateLineDependencies
): () => Promise<void> {
  return createEvaluateCommand(
    dependencies,
    getCurrentLineExecution,
    'Open a PowerShell document to evaluate a line.',
    'The current line is empty.'
  );
}

export function createEvaluateSelectionCommand(
  dependencies: EvaluateLineDependencies
): () => Promise<void> {
  return createEvaluateCommand(
    dependencies,
    getSelectionExecution,
    'Open a PowerShell document to evaluate a selection.',
    'Select some PowerShell code before running selection evaluation.'
  );
}

export function createEvaluateFileCommand(
  dependencies: EvaluateLineDependencies
): () => Promise<void> {
  return createEvaluateCommand(
    dependencies,
    getDocumentExecution,
    'Open a PowerShell document to evaluate the file.',
    'The current PowerShell document is empty.'
  );
}

function createEvaluateCommand(
  dependencies: EvaluateLineDependencies,
  getExecution: (editor: vscode.TextEditor) => LineExecutionContext | undefined,
  missingEditorMessage: string,
  missingCodeMessage: string
): () => Promise<void> {
  return async (): Promise<void> => {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      await vscode.window.showInformationMessage(missingEditorMessage);
      return;
    }

    if (editor.document.languageId !== 'powershell') {
      await vscode.window.showInformationMessage('PowerShell evaluation is only enabled for PowerShell documents.');
      return;
    }

    const execution = getExecution(editor);

    if (!execution) {
      await vscode.window.showInformationMessage(missingCodeMessage);
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
