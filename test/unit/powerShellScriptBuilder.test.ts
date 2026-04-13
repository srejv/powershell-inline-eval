import * as assert from 'node:assert/strict';
import {
  EXECUTION_END_MARKER,
  EXECUTION_ERROR_MARKER,
  EXECUTION_METADATA_MARKER,
  EXECUTION_START_MARKER
} from '../../src/constants';
import {
  buildBootstrapScript,
  buildEvaluationScript
} from '../../src/powershell/powerShellScriptBuilder';

describe('powerShellScriptBuilder', () => {
  it('builds the bootstrap script', () => {
    const script = buildBootstrapScript();

    assert.match(script, /ProgressPreference/);
    assert.match(script, /function global:prompt/);
  });

  it('embeds markers and encoded code in the evaluation script', () => {
    const requestId = 'request-1';
    const script = buildEvaluationScript("Write-Output 'hello'", requestId, 120);

    assert.match(script, new RegExp(`${EXECUTION_START_MARKER}${requestId}`));
    assert.match(script, new RegExp(`${EXECUTION_ERROR_MARKER}${requestId}`));
    assert.match(script, new RegExp(`${EXECUTION_METADATA_MARKER}${requestId}:`));
    assert.match(script, new RegExp(`${EXECUTION_END_MARKER}${requestId}`));
    assert.match(script, /V3JpdGUtT3V0cHV0ICdoZWxsbyc=/);
  });
});
