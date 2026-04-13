import {
  DEFAULT_PREVIEW_DEPTH,
  DEFAULT_PREVIEW_ITEM_LIMIT,
  OUTPUT_STRING_WIDTH
} from '../constants';

interface EvaluationRequest {
  requestId: string;
  codeBase64: string;
  outputWidth: number;
  previewItemLimit: number;
  previewDepth: number;
}

export function buildEvaluationRequest(
  code: string,
  requestId: string,
  outputWidth = OUTPUT_STRING_WIDTH,
  previewItemLimit = DEFAULT_PREVIEW_ITEM_LIMIT,
  previewDepth = DEFAULT_PREVIEW_DEPTH
): string {
  const request: EvaluationRequest = {
    requestId,
    codeBase64: Buffer.from(code, 'utf8').toString('base64'),
    outputWidth,
    previewItemLimit,
    previewDepth
  };

  return Buffer.from(JSON.stringify(request), 'utf8').toString('base64');
}
