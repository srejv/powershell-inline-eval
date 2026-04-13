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

  it('prefers structured metadata previews when available', () => {
    const presentation = formatInlineOutput('raw output', {
      kind: 'object',
      preview: '{ Name: alpha, Id: 42 }',
      itemCount: 1
    });

    assert.equal(presentation.text, '{ Name: alpha, Id: 42 }');
    assert.equal(presentation.revealOutputChannel, false);
  });

  it('summarizes property-list output', () => {
    const presentation = formatInlineOutput('Name : alpha\nId : 42\nState : Running');

    assert.equal(presentation.text, '{ Name: alpha, Id: 42, State: Running }');
    assert.equal(presentation.revealOutputChannel, false);
  });

  it('summarizes table output using the first row', () => {
    const presentation = formatInlineOutput(
      'Name Id State\n---- -- -----\nalpha 42 Running\nbeta 84 Stopped'
    );

    assert.equal(presentation.text, 'Name=alpha, Id=42, State=Running (+1 more row)');
    assert.equal(presentation.revealOutputChannel, true);
  });

  it('summarizes generic multi-line output', () => {
    const presentation = formatInlineOutput('first line\nsecond line\nthird line');

    assert.equal(presentation.text, 'first line | second line (+1 more line)');
    assert.equal(presentation.revealOutputChannel, true);
  });

  it('truncates long single-line output', () => {
    const presentation = formatInlineOutput('abcdefghijklmnopqrstuvwxyz', undefined, 10);

    assert.equal(presentation.text, 'abcdefg...');
    assert.equal(presentation.revealOutputChannel, true);
  });
});
