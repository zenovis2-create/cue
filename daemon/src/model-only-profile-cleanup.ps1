param([Parameter(Mandatory=$true)][string]$PayloadBase64)
$ErrorActionPreference = 'Stop'
if ($PayloadBase64.Length -gt 8192) { throw 'guardian_payload_limit' }
$p = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($PayloadBase64)) | ConvertFrom-Json
if ($p.profile -notmatch '^Cue\.Model\.[0-9a-f]{32}$' -or $p.jobName -cne "Local\$($p.profile).job" -or $p.readyName -cne "Local\$($p.profile).ready") { throw 'guardian_identity_invalid' }
$root = [IO.Path]::GetFullPath([string]$p.root)
if ($root -cne [IO.Path]::GetFullPath((Join-Path ([IO.Path]::GetTempPath()) $p.profile))) { throw 'guardian_root_invalid' }
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class CueModelGuardian {
 [StructLayout(LayoutKind.Sequential)] struct Accounting { public long user,kernel,periodUser,periodKernel; public uint faults,total,active,terminated; }
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,int pid);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetProcessTimes(IntPtr process,out long created,out long exited,out long kernel,out long user);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr OpenJobObject(uint access,bool inherit,string name);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr OpenEvent(uint access,bool inherit,string name);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetEvent(IntPtr handle);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateJobObject(IntPtr handle,uint code);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr handle,int type,out Accounting info,uint size,IntPtr returned);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle,uint ms);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 [DllImport("userenv.dll",CharSet=CharSet.Unicode)] public static extern int DeleteAppContainerProfile(string name);
 static void Check(bool ok) { if(!ok) throw new InvalidOperationException("guardian_native:"+Marshal.GetLastWin32Error()); }
 public static void WaitAndDrain(int launcherPid,long expectedCreated,string jobName,string readyName) {
  IntPtr launcher=IntPtr.Zero,job=IntPtr.Zero,ready=IntPtr.Zero;
  try {
   launcher=OpenProcess(0x100000|0x1000,false,launcherPid); Check(launcher!=IntPtr.Zero);
   long created,exited,kernel,user; Check(GetProcessTimes(launcher,out created,out exited,out kernel,out user));
   if(created!=expectedCreated) throw new InvalidOperationException("guardian_launcher_reused");
   job=OpenJobObject(0x4|0x8,false,jobName); Check(job!=IntPtr.Zero);
   Accounting info; Check(QueryInformationJobObject(job,1,out info,(uint)Marshal.SizeOf(typeof(Accounting)),IntPtr.Zero));
   // Readiness precedes any client creation; an occupied name is not our job.
   if(info.total!=0 || info.active!=0) throw new InvalidOperationException("guardian_job_not_empty");
   ready=OpenEvent(0x2,false,readyName); Check(ready!=IntPtr.Zero); Check(SetEvent(ready));
   if(WaitForSingleObject(launcher,0xffffffff)!=0) throw new InvalidOperationException("guardian_launcher_wait_unknown");
   Check(TerminateJobObject(job,116));
   for(int attempt=0;attempt<100;attempt++) {
    Check(QueryInformationJobObject(job,1,out info,(uint)Marshal.SizeOf(typeof(Accounting)),IntPtr.Zero));
    if(info.active==0) return;
    System.Threading.Thread.Sleep(50);
   }
   throw new InvalidOperationException("guardian_client_cleanup_unknown");
  } finally { if(ready!=IntPtr.Zero) CloseHandle(ready); if(job!=IntPtr.Zero) CloseHandle(job); if(launcher!=IntPtr.Zero) CloseHandle(launcher); }
 }
}
'@
[CueModelGuardian]::WaitAndDrain([int]$p.launcherPid,[long]::Parse($p.launcherCreated),$p.jobName,$p.readyName)
# The verified job is empty and launcher is gone. Only now touch owned paths.
$packageRoot = Join-Path ([Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)) ('Packages\' + $p.profile.ToLowerInvariant())
if (Test-Path -LiteralPath $packageRoot) {
  $deleted = -1
  for ($attempt=0;$attempt -lt 50;$attempt++) { $deleted = [CueModelGuardian]::DeleteAppContainerProfile($p.profile); if ($deleted -eq 0 -or -not (Test-Path -LiteralPath $packageRoot)) { break }; Start-Sleep -Milliseconds 100 }
  if (Test-Path -LiteralPath $packageRoot) { throw "guardian_profile_cleanup_unknown:$deleted" }
}
if (Test-Path -LiteralPath $root) {
  if (((Get-Item -LiteralPath $root).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'guardian_reparse_root' }
  if (@(Get-ChildItem -LiteralPath $root -Force -Recurse | Where-Object { ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 }).Count -ne 0) { throw 'guardian_reparse_child' }
  Remove-Item -LiteralPath $root -Recurse -Force
}
if ((Test-Path -LiteralPath $root) -or (Test-Path -LiteralPath $packageRoot)) { throw 'guardian_cleanup_unknown' }
