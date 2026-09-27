param([Parameter(Mandatory=$true)][string]$ExecutablePath,[Parameter(Mandatory=$true)][string]$PackageSid,[Parameter(Mandatory=$true)][ValidateRange(1,65535)][int]$RemotePort,[ValidateRange(1,5000)][int]$DurationMs=5000)
$ErrorActionPreference='Stop'
if(-not [Environment]::Is64BitProcess){throw 'wfp_collector_requires_x64'}
$source=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native\readonly-wfp-collector.cs') -Raw
Add-Type -TypeDefinition $source -Language CSharp
$request=New-Object WfpRequest;$request.ExecutablePath=[IO.Path]::GetFullPath($ExecutablePath);$request.PackageSid=$PackageSid;$request.RemotePort=[uint16]$RemotePort;$request.DurationMs=$DurationMs
[ReadonlyWfpCollector]::Collect($request,(New-Object NativeWfp))|ConvertTo-Json -Depth 5 -Compress
