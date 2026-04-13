import * as vscode from 'vscode';
import type {
  OutputChannelAutoOpenMode,
  PowerShellContextSettings,
  PreviewPanelAutoOpenMode
} from '../configuration';
import { setLastEvaluationSnapshot } from '../extensionDebugState';
import type { PowerShellSessionLike } from '../powershell/PowerShellSession';
import { formatInlineOutput } from '../ui/inlineOutputFormatter';
import type { InlineResultController } from '../ui/InlineResultController';
import type { ResultPreviewPanel } from '../ui/ResultPreviewPanel';
import {
  formatOutputChannelEntry,
  getCurrentLineExecution,
  getDocumentExecution,
  getSelectionExecution,
  type LineExecutionContext
} from './evaluateLineContext';

interface EvaluateLineDependencies {
  session: PowerShellSessionLike;
  inlineResults: InlineResultController;
  previewPanel: ResultPreviewPanel;
  outputChannel: vscode.OutputChannel;
  getSettings: () => PowerShellContextSettings;
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
      const settings = dependencies.getSettings();
      const inlinePresentation = formatInlineOutput(result.output, result.metadata, settings.inlineOutputMaxLength);
      setLastEvaluationSnapshot({ execution, result });
      dependencies.outputChannel.append(formatOutputChannelEntry(execution, result));
      dependencies.previewPanel.update(execution, result);
      dependencies.inlineResults.show(editor, execution.lineNumber, inlinePresentation.text, result.output, result.isError);

      if (shouldOpenPreviewPanel(result, inlinePresentation.revealOutputChannel, settings.previewPanelAutoOpen)) {
        dependencies.previewPanel.show(execution, result, true);
      }

      if (shouldOpenOutputChannel(result.isError, inlinePresentation.revealOutputChannel, settings.outputChannelAutoOpen)) {
        dependencies.outputChannel.show(true);
      }
    } catch (error) {
      const settings = dependencies.getSettings();
      const message = error instanceof Error ? error.message : String(error);
      setLastEvaluationSnapshot({
        execution,
        result: {
          code: execution.code,
          output: message,
          isError: true,
          durationMs: 0
        }
      });
      dependencies.inlineResults.show(editor, execution.lineNumber, message, message, true);
      dependencies.outputChannel.appendLine(message);

      if (shouldOpenOutputChannel(true, true, settings.outputChannelAutoOpen)) {
        dependencies.outputChannel.show(true);
      }
    }
  };
}

function shouldOpenPreviewPanel(
  result: Awaited<ReturnType<PowerShellSessionLike['execute']>>,
  hasExpandedInlineOutput: boolean,
  autoOpenMode: PreviewPanelAutoOpenMode
): boolean {
  if (autoOpenMode === 'never') {
    return false;
  }

  if (autoOpenMode === 'always') {
    return true;
  }

  if (autoOpenMode === 'expandedOutput') {
    return hasExpandedInlineOutput;
  }

  return result.metadata?.kind === 'object' || result.metadata?.kind === 'dictionary' || result.metadata?.kind === 'collection';
}

function shouldOpenOutputChannel(
  isError: boolean,
  hasExpandedInlineOutput: boolean,
  autoOpenMode: OutputChannelAutoOpenMode
): boolean {
  if (autoOpenMode === 'never') {
    return false;
  }

  if (autoOpenMode === 'always') {
    return true;
  }

  if (autoOpenMode === 'expandedOutput') {
    return isError || hasExpandedInlineOutput;
  }

  return isError;
}
