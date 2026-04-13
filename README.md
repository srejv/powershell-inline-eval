# PowerShell Context

PowerShell Context is a VS Code extension that evaluates the current PowerShell line in a persistent PowerShell session and renders a compact inline result in the editor.

## Current MVP

- Evaluate the current line with `Ctrl+Enter` on Windows or `Cmd+Enter` on macOS.
- Keep a dedicated PowerShell session alive between evaluations.
- Show a compact inline result next to the evaluated line.
- Send large output and errors to a dedicated output channel.

## Development

```bash
npm install
npm run compile
npm test
```
