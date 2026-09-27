param([Parameter(Mandatory=$true)][string]$PayloadBase64)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
if ($PayloadBase64.Length -gt 8192) { throw 'observation_input_limit' }
$p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($PayloadBase64)) | ConvertFrom-Json
if ($p.version -cne 'cue-native-query-v1' -or $p.nonce -cnotmatch '^[a-f0-9-]{36}$' -or @($p.processes).Count -ne 3) { throw 'observation_input' }
$seen=@{}
foreach ($entry in $p.processes) {
  if ($entry.pid -lt 1 -or $entry.pid -gt 2147483647 -or $entry.pid -ne [math]::Floor($entry.pid) -or $seen.ContainsKey([string]$entry.pid)) { throw 'observation_pid' }
  $seen[[string]$entry.pid]=$true
}
Add-Type -TypeDefinition @'
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
public static class CueNativeReadOnly {
 public sealed class Observation { public int pid; public string createdFileTime; public string liveness; }
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,int pid);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetProcessTimes(IntPtr process,out ulong created,out ulong exited,out ulong kernel,out ulong user);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint WaitForSingleObject(IntPtr process,uint ms);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 public static Observation Observe(int pid) {
  var result=new Observation {pid=pid,liveness="unknown",createdFileTime=null};
  // This narrow local overload documents ArgumentException for a missing PID.
  // An arbitrary OpenProcess error is never classified as absence.
  try { using(var check=Process.GetProcessById(pid)) {} }
  catch(ArgumentException) { result.liveness="absent"; return result; }
  catch { return result; }
  IntPtr handle=OpenProcess(0x1000|0x100000,false,pid);
  if(handle==IntPtr.Zero) return result;
  try {
   ulong created,exited,kernel,user;
   if(!GetProcessTimes(handle,out created,out exited,out kernel,out user)) return result;
   uint wait=WaitForSingleObject(handle,0);
   if(wait!=0 && wait!=258) return result;
   result.createdFileTime=created.ToString(System.Globalization.CultureInfo.InvariantCulture);
   result.liveness=wait==0?"exited":"alive";
   return result;
  } finally { CloseHandle(handle); }
 }
}
'@
$processes=@($p.processes | ForEach-Object { [CueNativeReadOnly]::Observe([int]$_.pid) })
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
@{version='cue-native-query-v1';nonce=$p.nonce;processes=$processes;temp=[IO.Path]::GetTempPath();localAppData=[Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)} | ConvertTo-Json -Depth 5 -Compress
