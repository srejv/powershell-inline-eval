import * as os from 'node:os';
import type { SessionExecutionResult } from '../types';

export interface EditorLike {
  document: {
    uri: {
      fsPath: string;
    };
    lineAt(lineNumber: number): {
      text: string;
      lineNumber: number;
    };
  };
  selection: {
    active: {
      line: number;
    };
  };
}

export interface LineExecutionContext {
  code: string;
  documentPath: string;
  lineNumber: number;
  displayLineNumber: number;
}

const NO_OUTPUT_LABEL = '(no output)';

export function getCurrentLineExecution(editor: EditorLike): LineExecutionContext | undefined {
  const line = editor.document.lineAt(editor.selection.active.line);

  if (line.text.trim().length === 0) {
    return undefined;
  }

  return {
    code: line.text,
    documentPath: editor.document.uri.fsPath,
    lineNumber: line.lineNumber,
    displayLineNumber: line.lineNumber + 1
  };
}

export function formatOutputChannelEntry(
  execution: LineExecutionContext,
  result: SessionExecutionResult
): string {
  const statusLabel = result.isError ? 'error' : 'ok';
  const outputText = result.output.length > 0 ? result.output : NO_OUTPUT_LABEL;

  return [
    `[${statusLabel}] ${execution.documentPath}:${execution.displayLineNumber} (${result.durationMs}ms)`,
    `> ${execution.code}`,
    outputText,
    ''
  ].join(os.EOL);
}
