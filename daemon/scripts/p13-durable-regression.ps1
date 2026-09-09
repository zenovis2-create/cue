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
  $dirtyHash = if ([string]::IsNullOrWhiteSpace(($dirty -join "`n"))) { 'clean' } else {
    $bytes = [Text.Encoding]::UTF8.GetBytes(($dirty -join "`n"))
    (Get-FileHash -InputStream ([IO.MemoryStream]::new($bytes)) -Algorithm SHA256).Hash
  }
  return @{ head = ($digest -join ''); worktree = $dirtyHash }
}

$vendor = 'C:/Users/User/cue-toolchain/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe'
$env:CUE_VENDOR_CODEX = $vendor
$vendorHash = if (Test-Path $vendor) { (Get-FileHash $vendor -Algorithm SHA256).Hash } else { 'MISSING' }

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
$proc = Start-Process -FilePath 'npm.cmd' -ArgumentList 'test' -WorkingDirectory $daemon `
  -NoNewWindow -PassThru -RedirectStandardOutput $outLog -RedirectStandardError "$log.stderr"

$timedOut = -not $proc.WaitForExit($DeadlineSeconds * 1000)
if ($timedOut) {
  # A hung run must still leave a verdict on disk. .Kill($true) only reaches managed
  # children; npm spawns a node tree that outlives it and keeps writing to the
  # redirect handles, so sweep the OS tree and then wait for the handles to close.
  try { & taskkill.exe /PID $proc.Id /T /F *> $null } catch { }
  try { $proc.Kill($true) } catch { }
  try { $proc.WaitForExit(30000) | Out-Null } catch { }
  $code = 124
} else {
  $code = $proc.ExitCode
}

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
  "exit=$code"
  "finished=$((Get-Date).ToString('o'))"
)

if ($moved) {
  Add-Content -Path $log -Value 'VERDICT=INVALID: source tree changed during the run; this log is not evidence for either state'
  exit 125
}

# The runner's own exit code is the test verdict. Never end 0 on a red run.
exit $code
