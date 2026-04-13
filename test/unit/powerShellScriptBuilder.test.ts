import * as assert from 'node:assert/strict';
import { buildEvaluationRequest } from '../../src/powershell/powerShellScriptBuilder';

describe('powerShellScriptBuilder', () => {
  it('encodes an evaluation request payload', () => {
    const encoded = buildEvaluationRequest("Write-Output 'hello'", 'request-1', 120, 4, 2);
    const request = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as {
      requestId: string;
      codeBase64: string;
      outputWidth: number;
      previewItemLimit: number;
      previewDepth: number;
    };

    assert.equal(request.requestId, 'request-1');
    assert.equal(request.outputWidth, 120);
    assert.equal(request.previewItemLimit, 4);
    assert.equal(request.previewDepth, 2);
    assert.equal(Buffer.from(request.codeBase64, 'base64').toString('utf8'), "Write-Output 'hello'");
  });
});
