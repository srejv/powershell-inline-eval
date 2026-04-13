param(
  [Parameter(Mandatory = $true)]
  [string]$RequestDirectory
)

$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Continue'
function global:prompt { '' }
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Get-PowerShellContextText([object]$Value) {
  if ($null -eq $Value) { return '(null)' }
  $text = [string]$Value
  if ([string]::IsNullOrWhiteSpace($text)) { return '(empty)' }
  return (($text -replace '\s+', ' ').Trim())
}

function Get-PowerShellContextPreview([object]$Value, [int]$Depth = 0) {
  if ($Depth -ge $global:PowerShellContextPreviewDepth) { return (Get-PowerShellContextText $Value) }
  if ($null -eq $Value) { return '(null)' }
  if ($Value -is [string] -or $Value -is [ValueType] -or $Value -is [datetime] -or $Value -is [guid] -or $Value -is [timespan]) {
    return (Get-PowerShellContextText $Value)
  }
  if ($Value -is [System.Collections.IDictionary]) {
    $entries = @($Value.GetEnumerator() | Select-Object -First $global:PowerShellContextPreviewItemLimit | ForEach-Object { "$($_.Key): $(Get-PowerShellContextPreview $_.Value ($Depth + 1))" })
    $suffix = if ($Value.Count -gt $global:PowerShellContextPreviewItemLimit) { ', ...' } else { '' }
    return '{ ' + ($entries -join ', ') + $suffix + ' }'
  }
  if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string])) {
    $items = @($Value)
    $previewItems = @($items | Select-Object -First $global:PowerShellContextPreviewItemLimit | ForEach-Object { Get-PowerShellContextPreview $_ ($Depth + 1) })
    $suffix = if ($items.Count -gt $global:PowerShellContextPreviewItemLimit) { ', ...' } else { '' }
    return '[' + $items.Count + ' items] ' + ($previewItems -join ', ') + $suffix
  }
  $properties = @($Value.PSObject.Properties | Where-Object { $_.MemberType -ne 'Method' })
  if ($properties.Count -gt 0) {
    $previewProperties = @($properties | Select-Object -First $global:PowerShellContextPreviewItemLimit)
    $pairs = @($previewProperties | ForEach-Object { "$($_.Name): $(Get-PowerShellContextPreview $_.Value ($Depth + 1))" })
    $suffix = if ($properties.Count -gt $global:PowerShellContextPreviewItemLimit) { ', ...' } else { '' }
    return '{ ' + ($pairs -join ', ') + $suffix + ' }'
  }
  return (Get-PowerShellContextText ($Value | Out-String))
}

function Get-PowerShellContextOutputMetadata([object[]]$Values) {
  $items = @($Values)
  if ($items.Count -eq 0) { return @{ kind = 'empty'; preview = '(no output)'; itemCount = 0 } }
  if ($items.Count -gt 1) {
    $previewItems = @($items | Select-Object -First $global:PowerShellContextPreviewItemLimit | ForEach-Object { Get-PowerShellContextPreview $_ 0 })
    $suffix = if ($items.Count -gt $global:PowerShellContextPreviewItemLimit) { ', ...' } else { '' }
    return @{ kind = 'collection'; preview = '[' + $items.Count + ' items] ' + ($previewItems -join ', ') + $suffix; itemCount = $items.Count }
  }
  $single = $items[0]
  if ($single -is [System.Collections.IDictionary]) {
    return @{ kind = 'dictionary'; preview = Get-PowerShellContextPreview $single 0; itemCount = 1 }
  }
  if ($single -is [System.Collections.IEnumerable] -and -not ($single -is [string])) {
    $collectionItems = @($single)
    $previewItems = @($collectionItems | Select-Object -First $global:PowerShellContextPreviewItemLimit | ForEach-Object { Get-PowerShellContextPreview $_ 1 })
    $suffix = if ($collectionItems.Count -gt $global:PowerShellContextPreviewItemLimit) { ', ...' } else { '' }
    return @{ kind = 'collection'; preview = '[' + $collectionItems.Count + ' items] ' + ($previewItems -join ', ') + $suffix; itemCount = $collectionItems.Count }
  }
  if ($single -isnot [string] -and $single -isnot [ValueType]) {
    $properties = @($single.PSObject.Properties | Where-Object { $_.MemberType -ne 'Method' })
    if ($properties.Count -gt 0) {
      return @{ kind = 'object'; preview = Get-PowerShellContextPreview $single 0; itemCount = 1 }
    }
  }
  return @{ kind = 'scalar'; preview = Get-PowerShellContextPreview $single 0; itemCount = 1 }
}

while ($true) {
  $requestFiles = @(Get-ChildItem -Path $RequestDirectory -Filter '*.request' -File -ErrorAction SilentlyContinue | Sort-Object Name)

  if ($requestFiles.Count -eq 0) {
    Start-Sleep -Milliseconds 50
    continue
  }

  foreach ($requestFile in $requestFiles) {
    $requestLine = Get-Content -Path $requestFile.FullName -Raw -ErrorAction SilentlyContinue
    Remove-Item -Path $requestFile.FullName -Force -ErrorAction SilentlyContinue

    if ([string]::IsNullOrWhiteSpace($requestLine)) {
      continue
    }

    try {
      $requestJson = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($requestLine.Trim()))
      $request = $requestJson | ConvertFrom-Json
      $requestId = [string]$request.requestId
      $global:PowerShellContextPreviewItemLimit = [int]$request.previewItemLimit
      $global:PowerShellContextPreviewDepth = [int]$request.previewDepth
      $outputWidth = [int]$request.outputWidth
      $code = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String([string]$request.codeBase64))
    } catch {
      continue
    }

    [Console]::Out.WriteLine("__PSCTX_START__" + $requestId)
    $__psctxItems = @()
    $__psctxIsError = $false

    try {
      $ErrorActionPreference = 'Stop'
      $__psctxItems = @(& ([ScriptBlock]::Create($code)) 2>&1)
      if ($__psctxItems | Where-Object { $_ -is [System.Management.Automation.ErrorRecord] }) {
        $__psctxIsError = $true
      }
    } catch {
      $__psctxItems = @($_)
      $__psctxIsError = $true
    }

    if ($__psctxIsError) {
      [Console]::Out.WriteLine("__PSCTX_ERROR__" + $requestId)
    }

    [Console]::Out.WriteLine(($__psctxItems | Out-String -Width $outputWidth))
    $__psctxMetadata = Get-PowerShellContextOutputMetadata $__psctxItems
    $__psctxMetadataJson = $__psctxMetadata | ConvertTo-Json -Compress -Depth 4
    $__psctxMetadataEncoded = [System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($__psctxMetadataJson))
    [Console]::Out.WriteLine("__PSCTX_META__" + $requestId + ':' + $__psctxMetadataEncoded)
    [Console]::Out.WriteLine("__PSCTX_END__" + $requestId)
    [Console]::Out.Flush()
  }
}
