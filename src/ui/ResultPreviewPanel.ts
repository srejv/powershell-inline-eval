import * as vscode from 'vscode';
import { PREVIEW_PANEL_TITLE, SHOW_LAST_RESULT_PREVIEW_COMMAND } from '../constants';
import type { LineExecutionContext } from '../commands/evaluateLineContext';
import type { SessionExecutionResult } from '../types';

interface PreviewState {
  execution: LineExecutionContext;
  result: SessionExecutionResult;
}

export class ResultPreviewPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private lastState: PreviewState | undefined;

  public update(execution: LineExecutionContext, result: SessionExecutionResult): void {
    this.lastState = { execution, result };

    if (this.panel) {
      this.panel.webview.html = this.renderHtml(execution, result);
    }
  }

  public showLatest(preserveFocus = false): void {
    if (!this.lastState) {
      void vscode.window.showInformationMessage('No PowerShell result preview is available yet.');
      return;
    }

    this.show(this.lastState.execution, this.lastState.result, preserveFocus);
  }

  public show(execution: LineExecutionContext, result: SessionExecutionResult, preserveFocus = false): void {
    this.lastState = { execution, result };

    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        SHOW_LAST_RESULT_PREVIEW_COMMAND,
        PREVIEW_PANEL_TITLE,
        vscode.ViewColumn.Beside,
        {
          enableFindWidget: true,
          retainContextWhenHidden: true
        }
      );
      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });
    } else {
      this.panel.reveal(vscode.ViewColumn.Beside, preserveFocus);
    }

    this.panel.title = PREVIEW_PANEL_TITLE;
  this.panel.webview.html = this.renderHtml(execution, result);
  }

  public dispose(): void {
    this.panel?.dispose();
    this.panel = undefined;
  }

  private renderHtml(execution: LineExecutionContext, result: SessionExecutionResult): string {
    const nonce = createNonce();
    const metadataSummary = result.metadata
      ? `<dl>
          <dt>Kind</dt><dd>${escapeHtml(result.metadata.kind)}</dd>
          <dt>Items</dt><dd>${String(result.metadata.itemCount)}</dd>
          <dt>Preview</dt><dd>${escapeHtml(result.metadata.preview)}</dd>
        </dl>`
      : '<p class="muted">No structured preview metadata was captured for this result.</p>';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(PREVIEW_PANEL_TITLE)}</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-editor-foreground);
      --muted: var(--vscode-descriptionForeground);
      --border: var(--vscode-panel-border);
      --accent: var(--vscode-textLink-foreground);
      --error: var(--vscode-errorForeground);
      --code-bg: color-mix(in srgb, var(--bg) 88%, var(--fg) 12%);
      font-family: Consolas, 'Courier New', monospace;
    }
    body {
      background: var(--bg);
      color: var(--fg);
      margin: 0;
      padding: 20px;
      line-height: 1.5;
    }
    h1, h2 {
      margin: 0 0 12px;
      font-size: 15px;
      font-weight: 600;
    }
    h2 {
      margin-top: 20px;
      border-top: 1px solid var(--border);
      padding-top: 16px;
    }
    .meta {
      color: var(--muted);
      margin-bottom: 12px;
    }
    .status-ok {
      color: var(--accent);
    }
    .status-error {
      color: var(--error);
    }
    pre {
      white-space: pre-wrap;
      word-break: break-word;
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 12px;
      margin: 0;
    }
    dl {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 8px 12px;
      margin: 0;
    }
    dt {
      color: var(--muted);
    }
    dd {
      margin: 0;
    }
    .muted {
      color: var(--muted);
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(PREVIEW_PANEL_TITLE)}</h1>
  <div class="meta">
    <div class="${result.isError ? 'status-error' : 'status-ok'}">${result.isError ? 'Error result' : 'Successful result'}</div>
    <div>${escapeHtml(execution.locationLabel)} • ${result.durationMs}ms</div>
  </div>
  <h2>Code</h2>
  <pre>${escapeHtml(execution.code)}</pre>
  <h2>Structured Preview</h2>
  ${metadataSummary}
  <h2>Full Output</h2>
  <pre>${escapeHtml(result.output.length > 0 ? result.output : '(no output)')}</pre>
  <script nonce="${nonce}"></script>
</body>
</html>`;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createNonce(): string {
  return Math.random().toString(36).slice(2, 10);
}
