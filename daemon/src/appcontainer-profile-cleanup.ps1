param(
  [Parameter(Mandatory=$true)][string]$ProfileName,
  [Parameter(Mandatory=$true)][string]$Worktree
)

$ErrorActionPreference = 'Stop'
if ($ProfileName -notmatch '^Cue\.Worker\.[0-9a-f]{32}$') { throw 'invalid Cue AppContainer profile name' }
$canonicalWorktree = [IO.Path]::GetFullPath($Worktree)
$root = [IO.Path]::GetPathRoot($canonicalWorktree)
if ($canonicalWorktree.TrimEnd([IO.Path]::DirectorySeparatorChar) -eq $root.TrimEnd([IO.Path]::DirectorySeparatorChar)) {
  throw 'drive-root AppContainer cleanup is forbidden'
}

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class CueAppContainerCleanup {
  [DllImport("userenv.dll", CharSet=CharSet.Unicode)] public static extern int DeriveAppContainerSidFromAppContainerName(string name, out IntPtr sid);
  [DllImport("userenv.dll", CharSet=CharSet.Unicode)] public static extern int DeleteAppContainerProfile(string name);
  [DllImport("kernel32.dll")] public static extern IntPtr LocalFree(IntPtr value);
}
'@

$mappingRoot = 'Registry::HKEY_CURRENT_USER\Software\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppContainer\Mappings'
function Get-CueProfileCount {
  if (-not (Test-Path $mappingRoot)) { return 0 }
  return @(
    Get-ChildItem $mappingRoot | Where-Object { (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).Moniker -eq $ProfileName }
  ).Count
}

$sid = [IntPtr]::Zero
try {
  $derived = [CueAppContainerCleanup]::DeriveAppContainerSidFromAppContainerName($ProfileName, [ref]$sid)
  if ($derived -ne 0) { throw "DeriveAppContainerSidFromAppContainerName failed: 0x$('{0:X8}' -f $derived)" }
  $sidText = (New-Object Security.Principal.SecurityIdentifier($sid)).Value
  if (Test-Path -LiteralPath $canonicalWorktree) {
    $icacls = [IO.Path]::Combine([Environment]::GetFolderPath('Windows'), 'System32', 'icacls.exe')
    if (-not [IO.File]::Exists($icacls)) { throw 'sealed icacls executable missing' }
    & $icacls $canonicalWorktree /remove "*$sidText" /Q | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "icacls remove failed: $LASTEXITCODE" }
    $aclText = (& $icacls $canonicalWorktree 2>&1 | Out-String)
    if ($LASTEXITCODE -ne 0) { throw "icacls verification failed: $LASTEXITCODE" }
    if ($aclText.IndexOf($sidText, [StringComparison]::OrdinalIgnoreCase) -ge 0) { throw 'AppContainer worktree ACE cleanup could not be verified' }
  }

  $deleteCode = -1
  for ($attempt = 0; $attempt -lt 50; $attempt++) {
    $deleteCode = [CueAppContainerCleanup]::DeleteAppContainerProfile($ProfileName)
    if ($deleteCode -eq 0 -or (Get-CueProfileCount) -eq 0) { $deleteCode = 0; break }
    Start-Sleep -Milliseconds 100
  }
  if ($deleteCode -ne 0) { throw "DeleteAppContainerProfile failed: 0x$('{0:X8}' -f $deleteCode)" }
  if ((Get-CueProfileCount) -ne 0) { throw 'AppContainer profile cleanup could not be verified' }
  Write-Output 'CUE_APPCONTAINER_PROFILE_CLEANUP=PASS'
} finally {
  if ($sid -ne [IntPtr]::Zero) { [CueAppContainerCleanup]::LocalFree($sid) | Out-Null }
}
