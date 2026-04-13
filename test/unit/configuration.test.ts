import * as assert from 'node:assert/strict';
import { toPowerShellContextSettings } from '../../src/configurationModel';

describe('configuration', () => {
  it('normalizes invalid configuration values to safe defaults', () => {
    const settings = toPowerShellContextSettings({
      get: (section: string) => {
        const values: Record<string, unknown> = {
          'preview.inlineMaxLength': 5,
          'preview.itemLimit': 99,
          'preview.depth': 0,
          'outputChannel.autoOpen': 'bad-value',
          'previewPanel.autoOpen': 'unknown',
          'powerShellExecutable': 'legacy'
        };

        return values[section] as never;
      }
    });

    assert.equal(settings.inlineOutputMaxLength, 16);
    assert.equal(settings.previewItemLimit, 10);
    assert.equal(settings.previewDepth, 1);
    assert.equal(settings.outputChannelAutoOpen, 'errors');
    assert.equal(settings.previewPanelAutoOpen, 'structured');
    assert.equal(settings.powerShellExecutablePreference, 'auto');
  });
});
