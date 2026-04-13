# PowerShell Context

PowerShell Context is a VS Code extension that evaluates PowerShell code in a persistent PowerShell session and renders compact inline results in the editor.

## Current MVP

- Evaluate the current line with `Ctrl+Enter` on Windows or `Cmd+Enter` on macOS.
- Evaluate the current selection with `Ctrl+Shift+Enter` on Windows or `Cmd+Shift+Enter` on macOS.
- Evaluate the full PowerShell document from the command palette.
- Keep a dedicated PowerShell session alive between evaluations.
- Preserve multiple inline results in the same editor instead of replacing the previous result.
- Summarize object-style and multi-line output inline instead of flattening everything into one raw string.
- Use execution-time metadata to preview PSCustomObject, hashtable, and collection results more predictably.
- Send large output and errors to a dedicated output channel.

## Development

```bash
npm install
npm run compile
npm test
```
