import { INLINE_OUTPUT_MAX_LENGTH } from '../constants';
import type { InlinePresentation } from '../types';

const ELLIPSIS = '...';
const EMPTY_OUTPUT_LABEL = '(no output)';

export function formatInlineOutput(output: string, maxLength = INLINE_OUTPUT_MAX_LENGTH): InlinePresentation {
  const normalizedOutput = normalizeOutput(output);

  if (normalizedOutput.length === 0) {
    return {
      text: EMPTY_OUTPUT_LABEL,
      revealOutputChannel: false
    };
  }

  if (normalizedOutput.length <= maxLength) {
    return {
      text: normalizedOutput,
      revealOutputChannel: false
    };
  }

  return {
    text: `${normalizedOutput.slice(0, Math.max(maxLength - ELLIPSIS.length, 0))}${ELLIPSIS}`,
    revealOutputChannel: true
  };
}

function normalizeOutput(output: string): string {
  return output
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join(' ')
    .trim();
}
