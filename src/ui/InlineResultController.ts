import * as vscode from 'vscode';
import { RESULT_SUFFIX_MARGIN } from '../constants';

const SUCCESS_PREFIX = ' => ';
const ERROR_PREFIX = ' !! ';
const EMPTY_OUTPUT_LABEL = '(no output)';

interface EditorDecorationState {
  successDecorations: Map<number, vscode.DecorationOptions>;
  errorDecorations: Map<number, vscode.DecorationOptions>;
}

export class InlineResultController implements vscode.Disposable {
  private readonly successDecorationType = vscode.window.createTextEditorDecorationType({
    after: {
      color: new vscode.ThemeColor('editorCodeLens.foreground'),
      margin: RESULT_SUFFIX_MARGIN
    },
    rangeBehavior: vscode.DecorationRangeBehavior.OpenOpen
  });

  private readonly errorDecorationType = vscode.window.createTextEditorDecorationType({
    after: {
      color: new vscode.ThemeColor('errorForeground'),
      margin: RESULT_SUFFIX_MARGIN
    },
    rangeBehavior: vscode.DecorationRangeBehavior.OpenOpen
  });

  private readonly editorStates = new Map<vscode.TextEditor, EditorDecorationState>();

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

    const state = this.getOrCreateState(editor);

    state.successDecorations.delete(lineNumber);
    state.errorDecorations.delete(lineNumber);

    if (isError) {
      state.errorDecorations.set(lineNumber, decoration);
      this.render(editor, state);
      return;
    }

    state.successDecorations.set(lineNumber, decoration);
    this.render(editor, state);
  }

  public clear(editor?: vscode.TextEditor, lineNumber?: number): void {
    if (!editor) {
      for (const [storedEditor] of this.editorStates) {
        this.clear(storedEditor);
      }
      return;
    }

    const state = this.editorStates.get(editor);

    if (!state) {
      editor.setDecorations(this.successDecorationType, []);
      editor.setDecorations(this.errorDecorationType, []);
      return;
    }

    if (lineNumber === undefined) {
      state.successDecorations.clear();
      state.errorDecorations.clear();
      this.editorStates.delete(editor);
      editor.setDecorations(this.successDecorationType, []);
      editor.setDecorations(this.errorDecorationType, []);
      return;
    }

    state.successDecorations.delete(lineNumber);
    state.errorDecorations.delete(lineNumber);
    this.render(editor, state);
  }

  public dispose(): void {
    this.clear();
    this.successDecorationType.dispose();
    this.errorDecorationType.dispose();
  }

  private getOrCreateState(editor: vscode.TextEditor): EditorDecorationState {
    const existingState = this.editorStates.get(editor);

    if (existingState) {
      return existingState;
    }

    const newState: EditorDecorationState = {
      successDecorations: new Map<number, vscode.DecorationOptions>(),
      errorDecorations: new Map<number, vscode.DecorationOptions>()
    };

    this.editorStates.set(editor, newState);
    return newState;
  }

  private render(editor: vscode.TextEditor, state: EditorDecorationState): void {
    const successDecorations = Array.from(state.successDecorations.values());
    const errorDecorations = Array.from(state.errorDecorations.values());

    editor.setDecorations(this.successDecorationType, successDecorations);
    editor.setDecorations(this.errorDecorationType, errorDecorations);

    if (successDecorations.length === 0 && errorDecorations.length === 0) {
      this.editorStates.delete(editor);
    }
  }
}

function createHoverMessage(fullOutput: string, isError: boolean): vscode.MarkdownString {
  const output = fullOutput.length > 0 ? fullOutput : EMPTY_OUTPUT_LABEL;
  const markdown = new vscode.MarkdownString(undefined, true);
  markdown.appendMarkdown(isError ? '**PowerShell error**\n\n' : '**PowerShell output**\n\n');
  markdown.appendCodeblock(output, 'text');
  return markdown;
}
