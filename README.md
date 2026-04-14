# PowerShell Inline Eval

PowerShell Inline Eval runs PowerShell code in a persistent session and shows the result directly in your editor. It is built for quick feedback while scripting, without switching to a terminal for every expression, pipeline, or object inspection.

## Features

- Evaluate the current line with `Ctrl+Enter` on Windows and Linux or `Cmd+Enter` on macOS.
- Evaluate the current selection with `Ctrl+Shift+Enter` on Windows and Linux or `Cmd+Shift+Enter` on macOS.
- Evaluate the full PowerShell document from the Command Palette.
- Reuse a dedicated PowerShell session between evaluations instead of spawning a fresh shell every time.
- Choose `pwsh`, `powershell`, or automatic engine detection.
- Show the active or configured PowerShell engine in the status bar.
- Restart the PowerShell session from the Command Palette or by clicking the status bar item.
- Preserve multiple inline results in the same editor.
- Render compact inline summaries for structured objects, hashtables, and collections.
- Open a dedicated preview panel for larger or structured results.
- Send expanded output and errors to a dedicated output channel.

## Requirements

- VS Code `1.99.0` or newer.
- One of the following PowerShell engines available on your machine:
	- PowerShell 7 or newer via `pwsh`
	- Windows PowerShell 5.1 via `powershell`

## Quick Start

1. Open a PowerShell file.
2. Place the cursor on a line or select a block of code.
3. Run `Evaluate Current PowerShell Line` or `Evaluate PowerShell Selection`.
4. Inspect the inline result, or open the preview panel for larger output.

## Commands

- `PowerShell Inline Eval: Evaluate Current PowerShell Line`
- `PowerShell Inline Eval: Evaluate PowerShell Selection`
- `PowerShell Inline Eval: Evaluate PowerShell File`
- `PowerShell Inline Eval: Restart PowerShell Session`
- `PowerShell Inline Eval: Show PowerShell Session Info`
- `PowerShell Inline Eval: Show Last PowerShell Result Preview`
- `PowerShell Inline Eval: Clear Inline PowerShell Result`

## Settings

- `powershellContext.powerShellExecutable`: Choose `auto`, `pwsh`, or `powershell`.
- `powershellContext.preview.inlineMaxLength`: Maximum inline preview length before truncation.
- `powershellContext.preview.itemLimit`: Maximum number of object properties or collection items shown in structured previews.
- `powershellContext.preview.depth`: Maximum nesting depth for structured previews.
- `powershellContext.previewPanel.autoOpen`: Control when the dedicated result preview panel opens automatically.
- `powershellContext.outputChannel.autoOpen`: Control when the output channel opens automatically.

## Development

```bash
npm install
npm run compile
npm test
```

## Packaging

Create a VSIX package locally:

```bash
npm install
npm run package:vsix
```

Repository: https://github.com/srejv/powershell-inline-eval
