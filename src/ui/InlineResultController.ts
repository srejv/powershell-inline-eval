import * as vscode from 'vscode';
import { RESULT_SUFFIX_MARGIN } from '../constants';

const SUCCESS_PREFIX = ' => ';
const ERROR_PREFIX = ' !! ';
const EMPTY_OUTPUT_LABEL = '(no output)';

export class InlineResultController implements vscode.Disposable {
  private readonly successDecorationType = vscode.window.createTextEditorDecorationType({
    after: {
      color: new vscode.ThemeColor('editorCodeLens.foreground'),
      margin: RESULT_SUFFIX_MARGIN
    },
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
  });

  private readonly errorDecorationType = vscode.window.createTextEditorDecorationType({
    after: {
      color: new vscode.ThemeColor('errorForeground'),
      margin: RESULT_SUFFIX_MARGIN
    },
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
  });

  private activeEditor: vscode.TextEditor | undefined;

  public show(
    editor: vscode.TextEditor,
    lineNumber: number,
    inlineText: string,
    fullOutput: string,
    isError: boolean
  ): void {
    const line = editor.document.lineAt(lineNumber);
    const decoration: vscode.DecorationOptions = {
      range: new vscode.Range(line.range.end, line.range.end),
      hoverMessage: createHoverMessage(fullOutput, isError),
      renderOptions: {
        after: {
          contentText: `${isError ? ERROR_PREFIX : SUCCESS_PREFIX}${inlineText}`
        }
      }
    };

    this.clear(editor);
    this.activeEditor = editor;

    if (isError) {
      editor.setDecorations(this.successDecorationType, []);
      editor.setDecorations(this.errorDecorationType, [decoration]);
      return;
    }

    editor.setDecorations(this.errorDecorationType, []);
    editor.setDecorations(this.successDecorationType, [decoration]);
  }

  public clear(editor = this.activeEditor): void {
    if (!editor) {
      return;
    }

    editor.setDecorations(this.successDecorationType, []);
    editor.setDecorations(this.errorDecorationType, []);

    if (editor === this.activeEditor) {
      this.activeEditor = undefined;
    }
  }

  public dispose(): void {
    this.clear();
    this.successDecorationType.dispose();
    this.errorDecorationType.dispose();
  }
}

function createHoverMessage(fullOutput: string, isError: boolean): vscode.MarkdownString {
  const output = fullOutput.length > 0 ? fullOutput : EMPTY_OUTPUT_LABEL;
  const markdown = new vscode.MarkdownString(undefined, true);
  markdown.appendMarkdown(isError ? '**PowerShell error**\n\n' : '**PowerShell output**\n\n');
  markdown.appendCodeblock(output, 'text');
  return markdown;
}
