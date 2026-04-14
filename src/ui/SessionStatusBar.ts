import * as vscode from 'vscode';
import { RESTART_SESSION_COMMAND } from '../constants';
import type { PowerShellSessionLike, PowerShellSessionState } from '../powershell/PowerShellSession';

const ACTIVE_ICON = '$(terminal-powershell)';
const IDLE_ICON = '$(circle-large-outline)';

export class SessionStatusBar implements vscode.Disposable {
  private readonly statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  private readonly stateSubscription: vscode.Disposable;

  constructor(private readonly session: PowerShellSessionLike) {
    this.statusBarItem.command = RESTART_SESSION_COMMAND;
    this.stateSubscription = this.session.onDidChangeState(state => {
      this.render(state);
    });
    this.render(this.session.getState());
    this.statusBarItem.show();
  }

  public refresh(): void {
    this.render(this.session.getState());
  }

  public dispose(): void {
    this.stateSubscription.dispose();
    this.statusBarItem.dispose();
  }

  private render(state: PowerShellSessionState): void {
    this.statusBarItem.text = `${state.hasActiveProcess ? ACTIVE_ICON : IDLE_ICON} ${getDisplayLabel(state)}`;
    this.statusBarItem.tooltip = createTooltip(state);
  }
}

function getDisplayLabel(state: PowerShellSessionState): string {
  if (state.activeExecutable === 'pwsh') {
    return 'PS 7+';
  }

  if (state.activeExecutable === 'powershell') {
    return 'PS 5.1';
  }

  if (state.preferredExecutable === 'pwsh') {
    return 'PS 7+ (idle)';
  }

  if (state.preferredExecutable === 'powershell') {
    return 'PS 5.1 (idle)';
  }

  return 'PS Auto';
}

function createTooltip(state: PowerShellSessionState): vscode.MarkdownString {
  const tooltip = new vscode.MarkdownString(undefined, true);
  tooltip.appendMarkdown('**PowerShell Inline Eval Session**\n\n');
  tooltip.appendMarkdown(`Configured engine: ${getPreferenceLabel(state.preferredExecutable)}\n\n`);

  if (state.activeExecutable) {
    tooltip.appendMarkdown(`Active engine: ${getExecutableLabel(state.activeExecutable)}\n\n`);
  } else {
    tooltip.appendMarkdown('Session state: Idle\n\n');
  }

  tooltip.appendMarkdown('Click to restart the session.');
  return tooltip;
}

function getPreferenceLabel(preference: PowerShellSessionState['preferredExecutable']): string {
  if (preference === 'pwsh') {
    return 'PowerShell 7+';
  }

  if (preference === 'powershell') {
    return 'Windows PowerShell 5.1';
  }

  return 'Auto (prefer PowerShell 7+)';
}

function getExecutableLabel(executable: string): string {
  if (executable === 'pwsh') {
    return 'PowerShell 7+';
  }

  if (executable === 'powershell') {
    return 'Windows PowerShell 5.1';
  }

  return executable;
}
