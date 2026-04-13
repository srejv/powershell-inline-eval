import * as assert from 'node:assert/strict';
import { formatSessionInfo } from '../../src/sessionInfo';

describe('sessionInfo', () => {
  it('formats the active engine and preview settings into a readable summary', () => {
    const output = formatSessionInfo(
      {
        activeExecutable: 'pwsh',
        preferredExecutable: 'auto',
        hasActiveProcess: true
      },
      {
        inlineOutputMaxLength: 72,
        previewItemLimit: 3,
        previewDepth: 2,
        outputChannelAutoOpen: 'errors',
        previewPanelAutoOpen: 'structured',
        powerShellExecutablePreference: 'auto'
      }
    );

    assert.match(output, /Active executable: pwsh\.exe \(PowerShell 7\+\)/);
    assert.match(output, /Configured preference: auto \(prefer pwsh, fallback to powershell\)/);
    assert.match(output, /Launch order: pwsh\.exe -> powershell\.exe/);
    assert.match(output, /inline max length: 72/);
    assert.match(output, /depth: 2/);
  });
});