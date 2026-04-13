import * as assert from 'node:assert/strict';
import { formatInlineOutput } from '../../src/ui/inlineOutputFormatter';

describe('formatInlineOutput', () => {
  it('returns a placeholder when there is no output', () => {
    const presentation = formatInlineOutput('   \n');

    assert.equal(presentation.text, '(no output)');
    assert.equal(presentation.revealOutputChannel, false);
  });

  it('keeps short single-line output inline', () => {
    const presentation = formatInlineOutput('value');

    assert.equal(presentation.text, 'value');
    assert.equal(presentation.revealOutputChannel, false);
  });

  it('collapses and truncates long output', () => {
    const presentation = formatInlineOutput('first line\nsecond line', 10);

    assert.equal(presentation.text, 'first l...');
    assert.equal(presentation.revealOutputChannel, true);
  });
});
