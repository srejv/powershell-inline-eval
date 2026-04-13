# PowerShell Context

PowerShell Context is a VS Code extension that evaluates PowerShell code in a persistent PowerShell session and renders compact inline results in the editor.

## Current MVP

- Evaluate the current line with `Ctrl+Enter` on Windows or `Cmd+Enter` on macOS.
- Evaluate the current selection with `Ctrl+Shift+Enter` on Windows or `Cmd+Shift+Enter` on macOS.
- Evaluate the full PowerShell document from the command palette.
- Keep a dedicated PowerShell session alive between evaluations.
- Choose between `pwsh` (PowerShell 7+) and `powershell` (Windows PowerShell 5.1), or let the extension auto-select.
- Preserve multiple inline results in the same editor instead of replacing the previous result.
- Summarize object-style and multi-line output inline instead of flattening everything into one raw string.
- Use execution-time metadata to preview PSCustomObject, hashtable, and collection results more predictably.
- Open a dedicated preview panel for larger or structured results.
- Send large output and errors to a dedicated output channel.

## Settings

- `powershellContext.powerShellExecutable`: Choose `auto`, `pwsh`, or `powershell`.
- `powershellContext.preview.inlineMaxLength`: Set the maximum inline preview length before truncation.
- `powershellContext.preview.itemLimit`: Control how many properties or items appear in structured previews.
- `powershellContext.preview.depth`: Control how deeply nested structured previews can recurse.
- `powershellContext.previewPanel.autoOpen`: Control whether the dedicated preview panel opens automatically.
- `powershellContext.outputChannel.autoOpen`: Control when the output channel opens automatically.

## Development

```bash
npm install
npm run compile
npm test
```
