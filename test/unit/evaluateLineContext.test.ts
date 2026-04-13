import * as assert from 'node:assert/strict';
import {
  formatOutputChannelEntry,
  getCurrentLineExecution,
  type EditorLike
} from '../../src/commands/evaluateLineContext';

function createEditor(lineText: string): EditorLike {
  return {
    document: {
      uri: {
        fsPath: 'C:/workspace/example.ps1'
      },
      lineAt: (lineNumber: number) => ({
        text: lineText,
        lineNumber
      })
    },
    selection: {
      active: {
        line: 3
      }
    }
  };
}

describe('evaluateLineContext', () => {
  it('returns undefined for blank lines', () => {
    const execution = getCurrentLineExecution(createEditor('   '));

    assert.equal(execution, undefined);
  });

  it('returns the current line execution context', () => {
    const execution = getCurrentLineExecution(createEditor('Get-Date'));

    assert.deepEqual(execution, {
      code: 'Get-Date',
      documentPath: 'C:/workspace/example.ps1',
      lineNumber: 3,
      displayLineNumber: 4
    });
  });

  it('formats output channel content', () => {
    const execution = getCurrentLineExecution(createEditor('Get-Date'));

    assert.ok(execution);

    const entry = formatOutputChannelEntry(execution, {
      code: execution.code,
      output: 'Sunday',
      isError: false,
      durationMs: 12
    });

    assert.match(entry, /example.ps1:4/);
    assert.match(entry, /> Get-Date/);
    assert.match(entry, /Sunday/);
  });
});
