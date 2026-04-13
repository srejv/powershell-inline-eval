import {
  EXECUTION_END_MARKER,
  EXECUTION_ERROR_MARKER,
  EXECUTION_START_MARKER
} from '../constants';

const BOOTSTRAP_LINES = [
  "$ProgressPreference = 'SilentlyContinue'",
  "$ErrorActionPreference = 'Continue'",
  "function global:prompt { '' }",
  "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8"
];

export function buildBootstrapScript(): string {
  return BOOTSTRAP_LINES.join('\n');
}

export function buildEvaluationScript(code: string, requestId: string, outputWidth: number): string {
  const encodedCode = Buffer.from(code, 'utf8').toString('base64');
  const startMarker = `${EXECUTION_START_MARKER}${requestId}`;
  const errorMarker = `${EXECUTION_ERROR_MARKER}${requestId}`;
  const endMarker = `${EXECUTION_END_MARKER}${requestId}`;

  return [
    `$__psctxCode = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encodedCode}'))`,
    `Write-Output '${startMarker}'`,
    'try {',
    "  $ErrorActionPreference = 'Stop'",
    '  & ([ScriptBlock]::Create($__psctxCode)) 2>&1 | Out-String -Width ' + outputWidth + ' | Write-Output',
    '} catch {',
    `  Write-Output '${errorMarker}'`,
    '  $_ | Out-String -Width ' + outputWidth + ' | Write-Output',
    '} finally {',
    `  Write-Output '${endMarker}'`,
    '}'
  ].join('\n');
}
