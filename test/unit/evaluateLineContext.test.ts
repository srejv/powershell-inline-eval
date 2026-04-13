import * as assert from 'node:assert/strict';
import {
  formatOutputChannelEntry,
  getCurrentLineExecution,
  getDocumentExecution,
  getSelectionExecution,
  type EditorLike
} from '../../src/commands/evaluateLineContext';

interface EditorOptions {
  lineText?: string;
  selectionText?: string;
  documentText?: string;
  selectionStartLine?: number;
  selectionEndLine?: number;
  selectionIsEmpty?: boolean;
}

function createEditor(options: EditorOptions = {}): EditorLike {
  const lineText = options.lineText ?? 'Get-Date';
  const selectionText = options.selectionText ?? lineText;
  const documentText = options.documentText ?? lineText;
  const selectionStartLine = options.selectionStartLine ?? 3;
  const selectionEndLine = options.selectionEndLine ?? selectionStartLine;
  const selectionIsEmpty = options.selectionIsEmpty ?? true;

  return {
    document: {
      uri: {
        fsPath: 'C:/workspace/example.ps1'
      },
      getText: (range?: unknown) => {
        if (range) {
          return selectionText;
        }

        return documentText;
      },
      lineAt: (lineNumber: number) => ({
        text: lineText,
        lineNumber
      })
    },
    selection: {
      active: {
        line: selectionStartLine
      },
      start: {
        line: selectionStartLine
      },
      end: {
        line: selectionEndLine
      },
      isEmpty: selectionIsEmpty
    }
  };
}

describe('evaluateLineContext', () => {
  it('returns undefined for blank lines', () => {
    const execution = getCurrentLineExecution(createEditor({ lineText: '   ' }));

    assert.equal(execution, undefined);
  });

  it('returns the current line execution context', () => {
    const execution = getCurrentLineExecution(createEditor({ lineText: 'Get-Date' }));

    assert.deepEqual(execution, {
      code: 'Get-Date',
      documentPath: 'C:/workspace/example.ps1',
      lineNumber: 3,
      displayLineNumber: 4,
      targetKind: 'line',
      locationLabel: 'C:/workspace/example.ps1:4'
    });
  });

  it('returns the current selection execution context', () => {
    const execution = getSelectionExecution(
      createEditor({
        selectionText: "Get-Date\nWrite-Output 'done'",
        selectionStartLine: 4,
        selectionEndLine: 5,
        selectionIsEmpty: false
      })
    );

    assert.deepEqual(execution, {
      code: "Get-Date\nWrite-Output 'done'",
      documentPath: 'C:/workspace/example.ps1',
      lineNumber: 4,
      displayLineNumber: 5,
      targetKind: 'selection',
      locationLabel: 'C:/workspace/example.ps1:5-6'
    });
  });

  it('returns undefined when the selection is empty', () => {
    const execution = getSelectionExecution(createEditor({ selectionIsEmpty: true }));

    assert.equal(execution, undefined);
  });

  it('returns the current document execution context', () => {
    const execution = getDocumentExecution(createEditor({ documentText: "Get-Date\nGet-ChildItem" }));

    assert.deepEqual(execution, {
      code: "Get-Date\nGet-ChildItem",
      documentPath: 'C:/workspace/example.ps1',
      lineNumber: 0,
      displayLineNumber: 1,
      targetKind: 'file',
      locationLabel: 'C:/workspace/example.ps1'
    });
  });

  it('formats output channel content', () => {
    const execution = getCurrentLineExecution(createEditor({ lineText: 'Get-Date' }));

    assert.ok(execution);

    const entry = formatOutputChannelEntry(execution, {
      code: execution.code,
      output: 'Sunday',
      isError: false,
      durationMs: 12
    });

    assert.match(entry, /line C:\/workspace\/example.ps1:4/);
    assert.match(entry, /> Get-Date/);
    assert.match(entry, /Sunday/);
  });
});
