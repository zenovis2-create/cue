[CmdletBinding()]
param([int]$HashDeadlineSeconds = 120, [switch]$ParserOnly)
$ErrorActionPreference = 'Stop'
if (-not ('CueIdentityArgv' -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class CueIdentityArgv {
  [DllImport("shell32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
  static extern IntPtr CommandLineToArgvW(string commandLine, out int count);
  [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr memory);
  public static string[] Parse(string commandLine) {
    if (String.IsNullOrWhiteSpace(commandLine)) throw new ArgumentException("empty_command_line");
    int count; IntPtr memory=CommandLineToArgvW(commandLine,out count);
    if(memory==IntPtr.Zero) throw new InvalidOperationException("argv_parse_failed");
    try { var result=new string[count]; for(int i=0;i<count;i++) result[i]=Marshal.PtrToStringUni(Marshal.ReadIntPtr(memory,i*IntPtr.Size)); return result; }
    finally { LocalFree(memory); }
  }
}
'@
}
function Get-ConfiguredModelPath([string]$CommandLine) {
  $tokens = [CueIdentityArgv]::Parse($CommandLine)
  $models = [Collections.Generic.List[string]]::new()
  for ($i=1; $i -lt $tokens.Length; $i++) {
    $token=$tokens[$i]
    if ($token -ceq '-m' -or $token -ceq '--model') {
      if ($i+1 -ge $tokens.Length -or [string]::IsNullOrWhiteSpace($tokens[$i+1]) -or $tokens[$i+1].StartsWith('-')) { return $null }
      $models.Add($tokens[++$i])
    } elseif ($token.StartsWith('--model=',[StringComparison]::Ordinal)) {
      $value=$token.Substring(8)
      if ([string]::IsNullOrWhiteSpace($value)) { return $null }
      $models.Add($value)
    }
  }
  if ($models.Count -ne 1) { return $null }
  return $models[0]
}
if ($ParserOnly) { return }
if ($HashDeadlineSeconds -lt 1 -or $HashDeadlineSeconds -gt 120) { throw 'Hash deadline must be 1..120 seconds' }
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$evidenceRoot = Join-Path $repoRoot 'evidence/integrations/S1/20260911-qwen-identity'
New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null
$startedAt = [DateTime]::UtcNow
$budget = [Diagnostics.Stopwatch]::StartNew()

function Get-StreamingIdentity([string]$TargetPath) {
  $result = [ordered]@{ path = $TargetPath; status = 'unknown'; sha256 = $null }
  if (-not $TargetPath -or -not [IO.Path]::IsPathFullyQualified($TargetPath) -or -not [IO.File]::Exists($TargetPath)) {
    $result.reason = 'missing_or_nonabsolute_path'; return $result
  }
  $before = Get-Item -LiteralPath $TargetPath
  $result.before = @{ sizeBytes = $before.Length; modifiedUtc = $before.LastWriteTimeUtc.ToString('o') }
  $stream = $null; $hasher = $null
  try {
    $stream = [IO.File]::Open($TargetPath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete)
    $hasher = [Security.Cryptography.IncrementalHash]::CreateHash([Security.Cryptography.HashAlgorithmName]::SHA256)
    $buffer = New-Object byte[] (4 * 1024 * 1024)
    [long]$total = 0
    while ($true) {
      if ($budget.Elapsed.TotalSeconds -ge $HashDeadlineSeconds) { $result.reason = 'hash_deadline'; return $result }
      $count = $stream.Read($buffer, 0, $buffer.Length)
      if ($count -eq 0) { break }
      $hasher.AppendData($buffer, 0, $count); $total += $count
    }
    $result.bytesRead = $total
    $result.sha256 = [Convert]::ToHexString($hasher.GetHashAndReset()).ToLowerInvariant()
    $after = Get-Item -LiteralPath $TargetPath
    $result.after = @{ sizeBytes = $after.Length; modifiedUtc = $after.LastWriteTimeUtc.ToString('o') }
    $result.stable = $before.Length -eq $after.Length -and $before.LastWriteTimeUtc -eq $after.LastWriteTimeUtc -and $total -eq $before.Length
    if ($result.stable) { $result.status = 'observed' } else { $result.status = 'drift'; $result.reason = 'file_changed_while_hashing' }
    return $result
  } catch {
    # Do not serialize exception messages that may carry arbitrary host paths.
    $result.reason = 'file_read_failed'; return $result
  } finally { if ($stream) { $stream.Dispose() }; if ($hasher) { $hasher.Dispose() } }
}

$record = [ordered]@{ kind = 'live-read-only-identity'; startedAtUtc = $startedAt.ToString('o'); endpoint = 'http://127.0.0.1:8085/v1'; expectedModel = 'qwen38-27b-unc'; hashDeadlineSeconds = $HashDeadlineSeconds; eligibilityGranted = $false }
try {
  $listeners = @(Get-NetTCPConnection -LocalPort 8085 -State Listen | Where-Object LocalAddress -eq '127.0.0.1')
  if ($listeners.Count -ne 1) { throw 'ambiguous_loopback_listener' }
  $ownerId = $listeners[0].OwningProcess
  $processRecord = Get-CimInstance Win32_Process -Filter "ProcessId=$ownerId"
  if (-not $processRecord) { throw 'owner_disappeared' }
  $processStart = $processRecord.CreationDate.ToUniversalTime().ToString('o')
  $record.process = @{ pid = $ownerId; startUtc = $processStart; executablePath = $processRecord.ExecutablePath }
  # Only extract the model argument; never output or persist raw command line/environment.
  $modelPath = Get-ConfiguredModelPath $processRecord.CommandLine
  $processRecord = $null
  try {
    $models = Invoke-RestMethod -Uri 'http://127.0.0.1:8085/v1/models' -TimeoutSec 5 -MaximumRedirection 0
    $record.models = @($models.data | ForEach-Object { @{ id = [string]$_.id; object = [string]$_.object; created = $_.created; ownedBy = [string]$_.owned_by } })
    $record.expectedModelListed = @($record.models | Where-Object id -eq $record.expectedModel).Count -eq 1
  } catch { $record.modelsStatus = 'unavailable' }
  try {
    $props = Invoke-RestMethod -Uri 'http://127.0.0.1:8085/props' -TimeoutSec 5 -MaximumRedirection 0
    # Explicit safe allowlist. No template, system prompt, arbitrary metadata or file paths.
    $record.props = @{ totalSlots = $props.total_slots; contextPerSlot = $props.default_generation_settings.n_ctx;
      modelAlias = [string]$props.model_alias }
  } catch { $record.propsStatus = 'unavailable' }
  $record.serverBinary = Get-StreamingIdentity $record.process.executablePath
  $record.modelFile = Get-StreamingIdentity $modelPath
  $record.modelFile.scope = 'configured model argument only; additional shards/adapters/projectors not inferred'
  $afterProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$ownerId"
  $afterListeners = @(Get-NetTCPConnection -LocalPort 8085 -State Listen | Where-Object { $_.LocalAddress -eq '127.0.0.1' -and $_.OwningProcess -eq $ownerId })
  $record.processStable = $null -ne $afterProcess -and $afterProcess.CreationDate.ToUniversalTime().ToString('o') -eq $processStart -and $afterListeners.Count -eq 1
  $record.status = if ($record.processStable -and $record.serverBinary.status -eq 'observed' -and $record.modelFile.status -eq 'observed' -and $record.expectedModelListed) { 'observed' } else { 'partial_or_unknown' }
} catch { $record.status = 'partial_or_unknown'; $record.reason = 'identity_discovery_failed' }
finally {
  $record.completedAtUtc = [DateTime]::UtcNow.ToString('o'); $record.elapsedMs = $budget.ElapsedMilliseconds
  $record.limitations = @('Read-only identity is not M1/M2/M3 or P eligibility', 'File hashes do not prove loaded memory equals disk or server has no external fallback', 'Size/mtime comparison is drift detection, not an atomic filesystem snapshot', '120-second hashing budget is cooperative between blocking reads, not a hard process timeout')
  $record.scriptSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $PSCommandPath).Hash.ToLowerInvariant()
  $record | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $evidenceRoot 'identity.json') -Encoding utf8
}
Write-Output ("Identity status: {0}; elapsed {1}ms; eligibility not granted" -f $record.status, $record.elapsedMs)
