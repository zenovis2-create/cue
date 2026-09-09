# P13 fail-closed regression runner.
#
# Four full regressions died at ~60s with no exit line because the launching shell's
# lifetime decided whether evidence existed. Detachment therefore belongs inside the
# runner, not in whatever happened to call it.
#
# Contract:
#   - self-detaches (re-launches itself hidden) unless already the detached child
#   - records its own real PID so liveness is checkable without guessing
#   - hard wall deadline; exceeding it is exit=124, never silence (absolute rule 2)
#   - propagates the test process's exit code; the runner never ends 0 on a red run
#   - captures the source digest + dirty state before and after, and FAILS the run if
#     the tree moved mid-flight - a result that cannot be attributed to a source state
#     is not evidence (absolute rule 1)

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$LogName,
  [int]$DeadlineSeconds = 900,
  [switch]$Detached
)

$ErrorActionPreference = 'Stop'
$repo = 'C:\Users\User\cue'
$daemon = Join-Path $repo 'daemon'
$log = Join-Path $repo (Join-Path 'evidence\P13' $LogName)

if (-not $Detached) {
  # Re-launch self, detached and hidden, then report the child's real PID.
  $child = Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -PassThru -ArgumentList @(
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', $PSCommandPath, '-LogName', $LogName,
    '-DeadlineSeconds', $DeadlineSeconds, '-Detached'
  )
  Write-Output "runner_pid=$($child.Id)"
  Write-Output "log=$log"
  exit 0
}

function Get-SourceState {
  $digest = & git -C $repo rev-parse HEAD 2>&1
  # evidence/P13 is written BY the run, so it must not count as the source moving.
  # Everything else - including any other evidence path - still does.
  $dirty = & git -C $repo status --porcelain -- ':(exclude)evidence/P13' 2>&1
  # .NET directly: Get-FileHash lives in a module whose autoload can fail, and a
  # runner that dies before writing its header leaves no evidence at all.
  $dirtyHash = if ([string]::IsNullOrWhiteSpace(($dirty -join "`n"))) { 'clean' } else {
    $bytes = [Text.Encoding]::UTF8.GetBytes(($dirty -join "`n"))
    [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($bytes)).Replace('-','')
  }
  return @{ head = ($digest -join ''); worktree = $dirtyHash }
}

$vendor = 'C:/Users/User/cue-toolchain/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe'
$env:CUE_VENDOR_CODEX = $vendor
$vendorHash = if (Test-Path $vendor) {
  $stream = [IO.File]::OpenRead($vendor)
  try { [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($stream)).Replace('-','') } finally { $stream.Dispose() }
} else { 'MISSING' }

$before = Get-SourceState
$started = Get-Date

Set-Content -Path $log -Encoding utf8 -Value @(
  "runner_pid=$PID"
  "started=$($started.ToString('o'))"
  "deadline_seconds=$DeadlineSeconds"
  "CUE_VENDOR_CODEX=$vendor"
  "vendor_sha256=$vendorHash"
  "head_before=$($before.head)"
  "worktree_before=$($before.worktree)"
)

$outLog = "$log.stdout"
$codeFile = "$log.code"
Remove-Item $codeFile -ErrorAction SilentlyContinue
# cmd /v:on gives delayed expansion, so !ERRORLEVEL! is the code npm actually
# returned. Start-Process -PassThru does not reliably surface ExitCode after a
# timed WaitForExit, and a runner that guesses its own verdict is worthless.
$proc = Start-Process -FilePath 'cmd.exe' -ArgumentList '/v:on', '/c', "npm.cmd test & echo !ERRORLEVEL!> `"$codeFile`"" -WorkingDirectory $daemon `
  -NoNewWindow -PassThru -RedirectStandardOutput $outLog -RedirectStandardError "$log.stderr"

# Identity of the whole tree BEFORE any kill: once the root dies the closure query
# returns nothing, so survivors would read as "all clear".
function Get-TreeIdentities([int]$rootPid) {
  $all = @(Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, CreationDate)
  $set = [Collections.Generic.HashSet[int]]::new()
  [void]$set.Add($rootPid)
  do {
    $added = $false
    foreach ($p in $all) {
      if ($set.Contains([int]$p.ParentProcessId) -and -not $set.Contains([int]$p.ProcessId)) { $added = $set.Add([int]$p.ProcessId) -or $added }
    }
  } while ($added)
  return @($all | Where-Object { $set.Contains([int]$_.ProcessId) } | ForEach-Object { "$($_.ProcessId)@$($_.CreationDate.ToString('o'))" })
}

$timedOut = -not $proc.WaitForExit($DeadlineSeconds * 1000)
$containment = 'not_required'
if ($timedOut) {
  $tree = Get-TreeIdentities $proc.Id
  try { & taskkill.exe /PID $proc.Id /T /F *> $null } catch { }
  try { $proc.Kill($true) } catch { }
  # Verify every captured identity is actually gone. "We sent a kill" is not "they died".
  $deadline = (Get-Date).AddSeconds(60)
  do {
    $live = @(Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId)@$($_.CreationDate.ToString('o'))" })
    $survivors = @($tree | Where-Object { $live -contains $_ })
    if ($survivors.Count -eq 0) { break }
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)
  $containment = if ($survivors.Count -eq 0) { 'verified_dead' } else { "FAILED: $($survivors -join ', ')" }
  $code = 124
} else {
  $raw = if (Test-Path $codeFile) { (Get-Content $codeFile -Raw).Trim() } else { '' }
  if ($raw -match '^\d+$') { $code = [int]$raw } else {
    # Fail closed: an unreadable exit code is not a pass.
    Add-Content -Path $log -Value "exit_code_unreadable=$raw"
    $code = 126
  }
}
Remove-Item $codeFile -ErrorAction SilentlyContinue

foreach ($part in @($outLog, "$log.stderr")) {
  if (Test-Path $part) {
    Add-Content -Path $log -Value (Get-Content -Path $part -Raw -ErrorAction SilentlyContinue)
    Remove-Item $part -ErrorAction SilentlyContinue
  }
}

$after = Get-SourceState
$moved = ($before.head -ne $after.head) -or ($before.worktree -ne $after.worktree)

Add-Content -Path $log -Value @(
  "head_after=$($after.head)"
  "worktree_after=$($after.worktree)"
  "source_stable=$(-not $moved)"
  "timed_out=$timedOut"
  "containment=$containment"
  "exit=$code"
  "finished=$((Get-Date).ToString('o'))"
)

if ($moved) {
  Add-Content -Path $log -Value 'VERDICT=INVALID: source tree changed during the run; this log is not evidence for either state'
  exit 125
}

# The runner's own exit code is the test verdict. Never end 0 on a red run.
exit $code
