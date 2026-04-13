import type { PowerShellContextSettings } from './configurationModel';
import type { PowerShellSessionState } from './powershell/PowerShellSession';

export function formatSessionInfo(
  state: PowerShellSessionState,
  settings: PowerShellContextSettings
): string {
  const lines = [
    'PowerShell Context Session Info',
    `Active executable: ${formatActiveExecutable(state.activeExecutable)}`,
    `Configured preference: ${formatPreference(settings.powerShellExecutablePreference)}`,
    `Launch order: ${getLaunchOrder(settings.powerShellExecutablePreference).join(' -> ')}`,
    `Session active: ${state.hasActiveProcess ? 'yes' : 'no'}`,
    'Preview settings:',
    `  inline max length: ${settings.inlineOutputMaxLength}`,
    `  item limit: ${settings.previewItemLimit}`,
    `  depth: ${settings.previewDepth}`,
    `  preview panel auto-open: ${settings.previewPanelAutoOpen}`,
    `  output channel auto-open: ${settings.outputChannelAutoOpen}`,
    ''
  ];

  return lines.join('\n');
}

function formatActiveExecutable(executable: string | undefined): string {
  if (!executable) {
    return 'not started';
  }

  if (executable === 'pwsh') {
    return 'pwsh.exe (PowerShell 7+)';
  }

  if (executable === 'powershell') {
    return 'powershell.exe (Windows PowerShell 5.1)';
  }

  return executable;
}

function formatPreference(preference: PowerShellContextSettings['powerShellExecutablePreference']): string {
  if (preference === 'pwsh') {
    return 'pwsh (PowerShell 7+)';
  }

  if (preference === 'powershell') {
    return 'powershell (Windows PowerShell 5.1)';
  }

  return 'auto (prefer pwsh, fallback to powershell)';
}

function getLaunchOrder(
  preference: PowerShellContextSettings['powerShellExecutablePreference']
): string[] {
  if (preference === 'pwsh') {
    return ['pwsh.exe'];
  }

  if (preference === 'powershell') {
    return ['powershell.exe'];
  }

  return ['pwsh.exe', 'powershell.exe'];
}