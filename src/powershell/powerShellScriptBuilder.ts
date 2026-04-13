import {
  DEFAULT_PREVIEW_DEPTH,
  DEFAULT_PREVIEW_ITEM_LIMIT,
  EXECUTION_END_MARKER,
  EXECUTION_ERROR_MARKER,
  EXECUTION_METADATA_MARKER,
  EXECUTION_START_MARKER
} from '../constants';

const BOOTSTRAP_LINES = [
  "$ProgressPreference = 'SilentlyContinue'",
  "$ErrorActionPreference = 'Continue'",
  "function global:prompt { '' }",
  "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
  "function global:Get-PowerShellContextText([object]$Value) {",
  "  if ($null -eq $Value) { return '(null)' }",
  "  $text = [string]$Value",
  "  if ([string]::IsNullOrWhiteSpace($text)) { return '(empty)' }",
  "  return (($text -replace '\\s+', ' ').Trim())",
  "}",
  "function global:Get-PowerShellContextPreview([object]$Value, [int]$Depth = 0) {",
  "  if ($Depth -ge $global:PowerShellContextPreviewDepth) { return (Get-PowerShellContextText $Value) }",
  "  if ($null -eq $Value) { return '(null)' }",
  "  if ($Value -is [string] -or $Value -is [ValueType] -or $Value -is [datetime] -or $Value -is [guid] -or $Value -is [timespan]) { return (Get-PowerShellContextText $Value) }",
  "  if ($Value -is [System.Collections.IDictionary]) {",
  '    $entries = @($Value.GetEnumerator() | Select-Object -First $global:PowerShellContextPreviewItemLimit | ForEach-Object { "$($_.Key): $(Get-PowerShellContextPreview $_.Value ($Depth + 1))" })',
  "    $suffix = if ($Value.Count -gt $global:PowerShellContextPreviewItemLimit) { ', ...' } else { '' }",
  "    return '{ ' + ($entries -join ', ') + $suffix + ' }'",
  "  }",
  "  if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string])) {",
  "    $items = @($Value)",
  '    $previewItems = @($items | Select-Object -First $global:PowerShellContextPreviewItemLimit | ForEach-Object { Get-PowerShellContextPreview $_ ($Depth + 1) })',
  "    $suffix = if ($items.Count -gt $global:PowerShellContextPreviewItemLimit) { ', ...' } else { '' }",
  "    return '[' + $items.Count + ' items] ' + ($previewItems -join ', ') + $suffix",
  "  }",
  "  $properties = @($Value.PSObject.Properties | Where-Object { $_.MemberType -ne 'Method' })",
  "  if ($properties.Count -gt 0) {",
  '    $previewProperties = @($properties | Select-Object -First $global:PowerShellContextPreviewItemLimit)',
  '    $pairs = @($previewProperties | ForEach-Object { "$($_.Name): $(Get-PowerShellContextPreview $_.Value ($Depth + 1))" })',
  "    $suffix = if ($properties.Count -gt $global:PowerShellContextPreviewItemLimit) { ', ...' } else { '' }",
  "    return '{ ' + ($pairs -join ', ') + $suffix + ' }'",
  "  }",
  "  return (Get-PowerShellContextText ($Value | Out-String))",
  "}",
  "function global:Get-PowerShellContextOutputMetadata([object[]]$Values) {",
  "  $items = @($Values)",
  "  if ($items.Count -eq 0) { return @{ kind = 'empty'; preview = '(no output)'; itemCount = 0 } }",
  "  if ($items.Count -gt 1) {",
  '    $previewItems = @($items | Select-Object -First $global:PowerShellContextPreviewItemLimit | ForEach-Object { Get-PowerShellContextPreview $_ 0 })',
  "    $suffix = if ($items.Count -gt $global:PowerShellContextPreviewItemLimit) { ', ...' } else { '' }",
  "    return @{ kind = 'collection'; preview = '[' + $items.Count + ' items] ' + ($previewItems -join ', ') + $suffix; itemCount = $items.Count }",
  "  }",
  "  $single = $items[0]",
  "  if ($single -is [System.Collections.IDictionary]) { return @{ kind = 'dictionary'; preview = Get-PowerShellContextPreview $single 0; itemCount = 1 } }",
  "  if ($single -is [System.Collections.IEnumerable] -and -not ($single -is [string])) {",
  "    $collectionItems = @($single)",
  '    $previewItems = @($collectionItems | Select-Object -First $global:PowerShellContextPreviewItemLimit | ForEach-Object { Get-PowerShellContextPreview $_ 1 })',
  "    $suffix = if ($collectionItems.Count -gt $global:PowerShellContextPreviewItemLimit) { ', ...' } else { '' }",
  "    return @{ kind = 'collection'; preview = '[' + $collectionItems.Count + ' items] ' + ($previewItems -join ', ') + $suffix; itemCount = $collectionItems.Count }",
  "  }",
  "  if ($single -isnot [string] -and $single -isnot [ValueType]) {",
  "    $properties = @($single.PSObject.Properties | Where-Object { $_.MemberType -ne 'Method' })",
  "    if ($properties.Count -gt 0) { return @{ kind = 'object'; preview = Get-PowerShellContextPreview $single 0; itemCount = 1 } }",
  "  }",
  "  return @{ kind = 'scalar'; preview = Get-PowerShellContextPreview $single 0; itemCount = 1 }",
  "}"
];

export function buildBootstrapScript(): string {
  return BOOTSTRAP_LINES.join('\n');
}

export function buildEvaluationScript(
  code: string,
  requestId: string,
  outputWidth: number,
  previewItemLimit = DEFAULT_PREVIEW_ITEM_LIMIT,
  previewDepth = DEFAULT_PREVIEW_DEPTH
): string {
  const encodedCode = Buffer.from(code, 'utf8').toString('base64');
  const startMarker = `${EXECUTION_START_MARKER}${requestId}`;
  const errorMarker = `${EXECUTION_ERROR_MARKER}${requestId}`;
  const metadataMarker = `${EXECUTION_METADATA_MARKER}${requestId}:`;
  const endMarker = `${EXECUTION_END_MARKER}${requestId}`;

  return [
    `$__psctxCode = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encodedCode}'))`,
    `$global:PowerShellContextPreviewItemLimit = ${previewItemLimit}`,
    `$global:PowerShellContextPreviewDepth = ${previewDepth}`,
    '$__psctxItems = @()',
    '$__psctxIsError = $false',
    `Write-Output '${startMarker}'`,
    'try {',
    "  $ErrorActionPreference = 'Stop'",
    '  $__psctxItems = @(& ([ScriptBlock]::Create($__psctxCode)) 2>&1)',
    "  if ($__psctxItems | Where-Object { $_ -is [System.Management.Automation.ErrorRecord] }) { $__psctxIsError = $true }",
    '} catch {',
    '  $__psctxItems = @($_)',
    '  $__psctxIsError = $true',
    '}',
    "if ($__psctxIsError) { Write-Output '" + errorMarker + "' }",
    '($__psctxItems | Out-String -Width ' + outputWidth + ') | Write-Output',
    '$__psctxMetadata = Get-PowerShellContextOutputMetadata $__psctxItems',
    '$__psctxMetadataJson = $__psctxMetadata | ConvertTo-Json -Compress -Depth 4',
    '$__psctxMetadataEncoded = [System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($__psctxMetadataJson))',
    "Write-Output ('" + metadataMarker + "' + $__psctxMetadataEncoded)",
    `Write-Output '${endMarker}'`
  ].join('\n');
}
