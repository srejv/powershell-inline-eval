import * as os from 'node:os';
import type { SessionExecutionResult } from '../types';

type ExecutionTargetKind = 'line' | 'selection' | 'file';

export interface EditorLike {
  document: {
    uri: {
      fsPath: string;
    };
    getText(range?: unknown): string;
    lineAt(lineNumber: number): {
      text: string;
      lineNumber: number;
    };
  };
  selection: {
    active: {
      line: number;
    };
    start: {
      line: number;
    };
    end: {
      line: number;
    };
    isEmpty: boolean;
  };
}

export interface LineExecutionContext {
  code: string;
  documentPath: string;
  lineNumber: number;
  displayLineNumber: number;
  targetKind: ExecutionTargetKind;
  locationLabel: string;
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
    displayLineNumber: line.lineNumber + 1,
    targetKind: 'line',
    locationLabel: `${editor.document.uri.fsPath}:${line.lineNumber + 1}`
  };
}

export function getSelectionExecution(editor: EditorLike): LineExecutionContext | undefined {
  if (editor.selection.isEmpty) {
    return undefined;
  }

  const selectedText = editor.document.getText(editor.selection);

  if (selectedText.trim().length === 0) {
    return undefined;
  }

  const startLine = editor.selection.start.line;
  const endLine = normalizeSelectionEndLine(editor.selection.start.line, editor.selection.end.line, selectedText);

  return {
    code: selectedText,
    documentPath: editor.document.uri.fsPath,
    lineNumber: startLine,
    displayLineNumber: startLine + 1,
    targetKind: 'selection',
    locationLabel: `${editor.document.uri.fsPath}:${formatLineRange(startLine, endLine)}`
  };
}

export function getDocumentExecution(editor: EditorLike): LineExecutionContext | undefined {
  const documentText = editor.document.getText();

  if (documentText.trim().length === 0) {
    return undefined;
  }

  return {
    code: documentText,
    documentPath: editor.document.uri.fsPath,
    lineNumber: 0,
    displayLineNumber: 1,
    targetKind: 'file',
    locationLabel: editor.document.uri.fsPath
  };
}

export function formatOutputChannelEntry(
  execution: LineExecutionContext,
  result: SessionExecutionResult
): string {
  const statusLabel = result.isError ? 'error' : 'ok';
  const outputText = result.output.length > 0 ? result.output : NO_OUTPUT_LABEL;

  return [
    `[${statusLabel}] ${execution.targetKind} ${execution.locationLabel} (${result.durationMs}ms)`,
    prefixCodeBlock(execution.code),
    outputText,
    ''
  ].join(os.EOL);
}

function formatLineRange(startLine: number, endLine: number): string {
  if (startLine === endLine) {
    return String(startLine + 1);
  }

  return `${startLine + 1}-${endLine + 1}`;
}

function normalizeSelectionEndLine(startLine: number, endLine: number, selectedText: string): number {
  if (!selectedText.endsWith('\n') && !selectedText.endsWith('\r')) {
    return endLine;
  }

  return Math.max(startLine, endLine - 1);
}

function prefixCodeBlock(code: string): string {
  return code
    .split(/\r?\n/)
    .map(line => `> ${line}`)
    .join(os.EOL);
}
