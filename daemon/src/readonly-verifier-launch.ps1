param(
  [Parameter(Mandatory=$true)][string]$PayloadBase64
)

$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public interface ICueObservationLease : IDisposable { bool Ready(); bool ObserveProcessDeath(IntPtr processHandle); }
public delegate ICueObservationLease CueObservationLeaseProvider(IntPtr processHandle, IntPtr jobHandle);
public sealed class CueObservationAcquireException : Exception { public readonly bool DeathObserved;public CueObservationAcquireException(Exception inner,bool observed):base("observation lease acquisition failed",inner){DeathObserved=observed;} }
public sealed class CueObservationLeaseOwner {
  static readonly System.Collections.Generic.List<object> quarantine=new System.Collections.Generic.List<object>();
  ICueObservationLease lease; readonly IntPtr process,job; bool released,deathObserved,retained;
  public CueObservationLeaseOwner(ICueObservationLease value,IntPtr processHandle,IntPtr jobHandle){lease=value;process=processHandle;job=jobHandle;}
  public static CueObservationLeaseOwner Acquire(CueObservationLeaseProvider provider,IntPtr process,IntPtr job,Action terminateAndObserve){try{return new CueObservationLeaseOwner(provider(process,job),process,job);}catch(Exception acquireError){try{terminateAndObserve();throw new CueObservationAcquireException(acquireError,true);}catch(CueObservationAcquireException){throw;}catch(Exception stopError){throw new CueObservationAcquireException(new AggregateException(acquireError,stopError),false);}}}
  public bool Ready(){return lease!=null&&lease.Ready();}
  public void PrepareAndResume(Func<uint> resume,Action terminateAndObserve,Func<int> lastError){try{if(!Ready())throw new InvalidOperationException("observation lease refused");uint value=resume();if(value==0xffffffff)throw new Win32Exception(lastError());}catch{if(!EnsureDeath(terminateAndObserve))Quarantine();else ReleaseAfterObservedDeath();throw;}}
  public void MarkDeathObserved(){deathObserved=true;}
  bool EnsureDeath(Action terminateAndObserve){if(deathObserved)return true;try{terminateAndObserve();deathObserved=true;return true;}catch{return false;}}
  public bool Finish(Action terminateAndObserve){if(released)return !retained;if(!EnsureDeath(terminateAndObserve))return Quarantine();return ReleaseAfterObservedDeath();}
  public bool Retained { get { return retained; } }
  public bool ReleaseAfterObservedDeath(){if(released)return !retained;try{if(lease==null||!lease.ObserveProcessDeath(process))return Quarantine();lease.Dispose();lease=null;released=true;return true;}catch{return Quarantine();}}
  public bool Quarantine(){lock(quarantine){quarantine.Add(new object[]{lease,process,job});}lease=null;released=true;retained=true;return false;}
}

public static class CueAppContainer {
  const uint WAIT_OBJECT_0 = 0x00000000;
  const uint WAIT_TIMEOUT = 0x00000102;
  const uint WAIT_FAILED = 0xffffffff;
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct STARTUPINFO {
    public Int32 cb; public string lpReserved; public string lpDesktop; public string lpTitle;
    public Int32 dwX; public Int32 dwY; public Int32 dwXSize; public Int32 dwYSize;
    public Int32 dwXCountChars; public Int32 dwYCountChars; public Int32 dwFillAttribute;
    public Int32 dwFlags; public Int16 wShowWindow; public Int16 cbReserved2;
    public IntPtr lpReserved2; public IntPtr hStdInput; public IntPtr hStdOutput; public IntPtr hStdError;
  }
  [StructLayout(LayoutKind.Sequential)] public struct STARTUPINFOEX { public STARTUPINFO StartupInfo; public IntPtr lpAttributeList; }
  [StructLayout(LayoutKind.Sequential)] public struct PROCESS_INFORMATION { public IntPtr hProcess; public IntPtr hThread; public Int32 dwProcessId; public Int32 dwThreadId; }
  [StructLayout(LayoutKind.Sequential)] public struct SECURITY_CAPABILITIES { public IntPtr AppContainerSid; public IntPtr Capabilities; public Int32 CapabilityCount; public Int32 Reserved; }
  [StructLayout(LayoutKind.Sequential)] public struct SECURITY_ATTRIBUTES { public Int32 nLength; public IntPtr lpSecurityDescriptor; public Int32 bInheritHandle; }
  [StructLayout(LayoutKind.Sequential)] public struct JOBOBJECT_BASIC_LIMIT_INFORMATION {
    public Int64 PerProcessUserTimeLimit; public Int64 PerJobUserTimeLimit; public UInt32 LimitFlags;
    public UIntPtr MinimumWorkingSetSize; public UIntPtr MaximumWorkingSetSize; public UInt32 ActiveProcessLimit;
    public IntPtr Affinity; public UInt32 PriorityClass; public UInt32 SchedulingClass;
  }
  [StructLayout(LayoutKind.Sequential)] public struct IO_COUNTERS {
    public UInt64 ReadOperationCount; public UInt64 WriteOperationCount; public UInt64 OtherOperationCount;
    public UInt64 ReadTransferCount; public UInt64 WriteTransferCount; public UInt64 OtherTransferCount;
  }
  [StructLayout(LayoutKind.Sequential)] public struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
    public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation; public IO_COUNTERS IoInfo;
    public UIntPtr ProcessMemoryLimit; public UIntPtr JobMemoryLimit; public UIntPtr PeakProcessMemoryUsed; public UIntPtr PeakJobMemoryUsed;
  }

  [DllImport("userenv.dll", CharSet=CharSet.Unicode)] public static extern int CreateAppContainerProfile(string name, string display, string description, IntPtr capabilities, int count, out IntPtr sid);
  [DllImport("userenv.dll", CharSet=CharSet.Unicode)] public static extern int DeleteAppContainerProfile(string name);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool InitializeProcThreadAttributeList(IntPtr list, int count, int flags, ref IntPtr size);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool UpdateProcThreadAttribute(IntPtr list, uint flags, IntPtr attribute, IntPtr value, IntPtr size, IntPtr previous, IntPtr returned);
  [DllImport("kernel32.dll")] static extern void DeleteProcThreadAttributeList(IntPtr list);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool CreateProcess(string app, string commandLine, IntPtr processAttributes, IntPtr threadAttributes, bool inheritHandles, uint flags, IntPtr environment, string cwd, ref STARTUPINFOEX startup, out PROCESS_INFORMATION process);
  [DllImport("kernel32.dll", SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
  public static uint ObserveProcessDeathNow(IntPtr processHandle){return WaitForSingleObject(processHandle,0);}
  [DllImport("kernel32.dll", SetLastError=true)] static extern uint WaitForMultipleObjects(uint count, IntPtr[] handles, bool waitAll, uint milliseconds);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr process, out uint exitCode);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attributes, string name);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int informationClass, ref JOBOBJECT_EXTENDED_LIMIT_INFORMATION information, uint length);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateJobObject(IntPtr job, uint exitCode);
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint access, bool inheritHandle, int processId);
  [DllImport("kernel32.dll", SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateProcess(IntPtr process, uint exitCode);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  [DllImport("kernel32.dll")] public static extern IntPtr LocalFree(IntPtr value);
  public delegate bool TerminateJobCall(IntPtr job, uint exitCode);
  public delegate uint WaitProcessCall(IntPtr process, uint milliseconds);
  public delegate int LastErrorCall();
  public static void TerminateAndObserveProcess(IntPtr job, IntPtr process, uint exitCode, TerminateJobCall terminate, WaitProcessCall wait, LastErrorCall lastError) {
    if (!terminate(job, exitCode)) throw new Win32Exception(lastError());
    uint stopped = wait(process, 5000);
    if (stopped == WAIT_TIMEOUT) throw new TimeoutException("AppContainer worker did not terminate within 5000ms");
    if (stopped == WAIT_FAILED) throw new Win32Exception(lastError());
    if (stopped != WAIT_OBJECT_0) throw new InvalidOperationException("unexpected worker termination wait result: " + stopped);
  }
  static void TerminateAndObserveProcess(IntPtr job, IntPtr process, uint exitCode) {
    TerminateAndObserveProcess(job, process, exitCode, TerminateJobObject, WaitForSingleObject, Marshal.GetLastWin32Error);
  }
  internal static void FinalizeObservationOrThrow(CueObservationLeaseOwner observation,bool processDeathObserved,Action terminateAndObserve){if(observation==null)return;if(processDeathObserved)observation.MarkDeathObserved();if(!observation.Finish(terminateAndObserve))throw new InvalidOperationException("observation lease finalization unverified");}
  internal static bool ObserveFallbackTermination(bool processAssigned,bool processDeathObserved,bool terminationAttempted,bool hasObservation,Action terminateAndObserve){if(processAssigned&&!processDeathObserved&&!terminationAttempted&&!hasObservation)try{terminateAndObserve();return true;}catch{}return processDeathObserved;}
  internal static void RunFinalizationAndCleanup(Action finalizeObservation,Action cleanupIndependent){try{finalizeObservation();}finally{cleanupIndependent();}}
  [StructLayout(LayoutKind.Sequential)] struct FILE_ID_128 { [MarshalAs(UnmanagedType.ByValArray,SizeConst=16)] public byte[] Identifier; }
  [StructLayout(LayoutKind.Sequential)] struct FILE_ID_INFO { public ulong VolumeSerialNumber; public FILE_ID_128 FileId; }
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateFile(string name,uint access,uint share,IntPtr security,uint creation,uint flags,IntPtr templateFile);
  [DllImport("kernel32.dll", EntryPoint="CreateFileW", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateInheritableFile(string name,uint access,uint share,ref SECURITY_ATTRIBUTES security,uint creation,uint flags,IntPtr templateFile);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetHandleInformation(IntPtr handle,out uint flags);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetFileInformationByHandleEx(IntPtr handle,int infoClass,out FILE_ID_INFO info,uint size);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetProcessTimes(IntPtr process,out long created,out long exited,out long kernel,out long user);
  internal delegate bool GetProcessTimesCall(IntPtr process,out long created,out long exited,out long kernel,out long user);
  internal static void ContinueAfterCreatedProcessIdentity(IntPtr process,int processId,GetProcessTimesCall getTimes,Action<string> writeLine,Action flush,LastErrorCall lastError,Action continueLaunch){long created,exited,kernel,user;if(!getTimes(process,out created,out exited,out kernel,out user))throw new Win32Exception(lastError());writeLine("CUE_READONLY_PID="+processId+";CREATED_FILE_TIME="+created);flush();continueLaunch();}
  static IntPtr rootHandle=IntPtr.Zero; static string rootIdentity=null;
  static IntPtr executableHandle=IntPtr.Zero;
  static string Identity(IntPtr h) { FILE_ID_INFO i; if(!GetFileInformationByHandleEx(h,18,out i,(uint)Marshal.SizeOf(typeof(FILE_ID_INFO))))throw new Win32Exception(Marshal.GetLastWin32Error()); return BitConverter.ToString(BitConverter.GetBytes(i.VolumeSerialNumber)).Replace("-","").ToLowerInvariant()+":"+BitConverter.ToString(i.FileId.Identifier).Replace("-","").ToLowerInvariant(); }
  public static string HoldRoot(string path) { if(rootHandle!=IntPtr.Zero)throw new InvalidOperationException("root already held"); rootHandle=CreateFile(path,0,3,IntPtr.Zero,3,0x02000000,IntPtr.Zero); if(rootHandle==(IntPtr)(-1)){rootHandle=IntPtr.Zero;throw new Win32Exception(Marshal.GetLastWin32Error());} try{rootIdentity=Identity(rootHandle);return rootIdentity;}catch{ReleaseRoot();throw;} }
  public static string HeldRootIdentity() { if(rootHandle==IntPtr.Zero)throw new InvalidOperationException("root not held"); return Identity(rootHandle); }
  public static void ReleaseRoot() { if(rootHandle!=IntPtr.Zero){CloseHandle(rootHandle);rootHandle=IntPtr.Zero;rootIdentity=null;} }
  public static void HoldExecutable(string path,string expectedSha256) { if(executableHandle!=IntPtr.Zero)throw new InvalidOperationException("executable already held"); executableHandle=CreateFile(path,0x80000000,1,IntPtr.Zero,3,0,IntPtr.Zero); if(executableHandle==(IntPtr)(-1)){executableHandle=IntPtr.Zero;throw new Win32Exception(Marshal.GetLastWin32Error());} try{using(var stream=new System.IO.FileStream(new Microsoft.Win32.SafeHandles.SafeFileHandle(executableHandle,false),System.IO.FileAccess.Read)){using(var hash=System.Security.Cryptography.SHA256.Create()){var actual=BitConverter.ToString(hash.ComputeHash(stream)).Replace("-","").ToLowerInvariant();if(actual!=expectedSha256)throw new InvalidOperationException("executable hash drift");}}}catch{ReleaseExecutable();throw;} }
  public static void ReleaseExecutable(){if(executableHandle!=IntPtr.Zero){CloseHandle(executableHandle);executableHandle=IntPtr.Zero;}}
  static IntPtr OpenInheritableNull(uint access){SECURITY_ATTRIBUTES security=new SECURITY_ATTRIBUTES{nLength=Marshal.SizeOf(typeof(SECURITY_ATTRIBUTES)),lpSecurityDescriptor=IntPtr.Zero,bInheritHandle=1};IntPtr handle=CreateInheritableFile("NUL",access,3,ref security,3,0,IntPtr.Zero);if(handle==(IntPtr)(-1))throw new Win32Exception(Marshal.GetLastWin32Error());return handle;}

  public static int Launch(string app, string commandLine, string cwd, IntPtr sid, int parentPid, string[] environment, uint timeoutMs, string cancelMarker) { return LaunchCore(app,commandLine,cwd,sid,parentPid,environment,timeoutMs,cancelMarker,null); }
  internal static int LaunchWithObservationLease(string app,string commandLine,string cwd,IntPtr sid,int parentPid,string[] environment,uint timeoutMs,string cancelMarker,CueObservationLeaseProvider provider){if(provider==null)throw new ArgumentNullException("provider");return LaunchCore(app,commandLine,cwd,sid,parentPid,environment,timeoutMs,cancelMarker,provider);}
  static int LaunchCore(string app, string commandLine, string cwd, IntPtr sid, int parentPid, string[] environment, uint timeoutMs, string cancelMarker, CueObservationLeaseProvider observationProvider) {
    IntPtr size = IntPtr.Zero;
    InitializeProcThreadAttributeList(IntPtr.Zero, 2, 0, ref size);
    IntPtr list = Marshal.AllocHGlobal(size);
    bool listInitialized = false;
    IntPtr capsPtr = IntPtr.Zero;
    IntPtr job = IntPtr.Zero;
    IntPtr parent = IntPtr.Zero;
    IntPtr environmentPtr = IntPtr.Zero;
    IntPtr handlesPtr = IntPtr.Zero;
    IntPtr nullRead = IntPtr.Zero, nullWrite = IntPtr.Zero;
    PROCESS_INFORMATION process = new PROCESS_INFORMATION();
    bool processCreated = false;
    bool processAssigned = false,processDeathObserved = false,retainNativeHandles = false,terminationAttempted = false;
    CueObservationLeaseOwner observation = null;
    try {
      if (!InitializeProcThreadAttributeList(list, 2, 0, ref size)) throw new Win32Exception(Marshal.GetLastWin32Error()); listInitialized = true;
      SECURITY_CAPABILITIES caps = new SECURITY_CAPABILITIES { AppContainerSid=sid, Capabilities=IntPtr.Zero, CapabilityCount=0, Reserved=0 };
      capsPtr = Marshal.AllocHGlobal(Marshal.SizeOf(caps)); Marshal.StructureToPtr(caps, capsPtr, false);
      if (!UpdateProcThreadAttribute(list, 0, (IntPtr)0x20009, capsPtr, (IntPtr)Marshal.SizeOf(caps), IntPtr.Zero, IntPtr.Zero)) throw new Win32Exception(Marshal.GetLastWin32Error());
      STARTUPINFOEX startup = new STARTUPINFOEX(); startup.StartupInfo.cb = Marshal.SizeOf(startup); startup.lpAttributeList = list;
      nullRead=OpenInheritableNull(0x80000000); nullWrite=OpenInheritableNull(0x40000000);
      handlesPtr=Marshal.AllocHGlobal(2*IntPtr.Size);Marshal.WriteIntPtr(handlesPtr,0,nullRead);Marshal.WriteIntPtr(handlesPtr,IntPtr.Size,nullWrite);
      if(!UpdateProcThreadAttribute(list,0,(IntPtr)0x20002,handlesPtr,(IntPtr)(2*IntPtr.Size),IntPtr.Zero,IntPtr.Zero))throw new Win32Exception(Marshal.GetLastWin32Error());
      startup.StartupInfo.dwFlags=0x00000100; startup.StartupInfo.hStdInput=nullRead; startup.StartupInfo.hStdOutput=nullWrite; startup.StartupInfo.hStdError=nullWrite;
      job = CreateJobObject(IntPtr.Zero, null);
      if (job == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
      JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
      // A worker cannot bypass host executable sealing with its own child launch.
      // Additional programs must be separate cue_workspace calls.
      limits.BasicLimitInformation.LimitFlags = 0x00002000 | 0x00000008;
      limits.BasicLimitInformation.ActiveProcessLimit = 1;
      if (!SetInformationJobObject(job, 9, ref limits, (uint)Marshal.SizeOf(limits))) throw new Win32Exception(Marshal.GetLastWin32Error());
      if(environment==null||environment.Length<1||environment.Length>32)throw new InvalidOperationException("invalid environment");
      string block=String.Join("\0",environment)+"\0\0"; environmentPtr=Marshal.StringToHGlobalUni(block);
      if (!CreateProcess(app, commandLine, IntPtr.Zero, IntPtr.Zero, true, 0x00080404 | 0x08000000, environmentPtr, cwd, ref startup, out process)) throw new Win32Exception(Marshal.GetLastWin32Error());
      processCreated = true;
      if (!AssignProcessToJobObject(job, process.hProcess)) { TerminateProcess(process.hProcess, 111); throw new Win32Exception(Marshal.GetLastWin32Error()); }
      processAssigned = true;
      ContinueAfterCreatedProcessIdentity(process.hProcess,process.dwProcessId,GetProcessTimes,Console.WriteLine,Console.Out.Flush,Marshal.GetLastWin32Error,()=>{
        parent = OpenProcess(0x00100000, false, parentPid);
        if (parent == IntPtr.Zero) { int error = Marshal.GetLastWin32Error(); TerminateJobObject(job, 112); throw new Win32Exception(error); }
        if(observationProvider!=null){observation=CueObservationLeaseOwner.Acquire(observationProvider,process.hProcess,job,()=>TerminateAndObserveProcess(job,process.hProcess,112));observation.PrepareAndResume(()=>ResumeThread(process.hThread),()=>TerminateAndObserveProcess(job,process.hProcess,112),Marshal.GetLastWin32Error);}
        else if (ResumeThread(process.hThread) == 0xffffffff) { TerminateProcess(process.hProcess, 112); throw new Win32Exception(Marshal.GetLastWin32Error()); }
      });
      var watch=System.Diagnostics.Stopwatch.StartNew(); uint signaled;
      while(true){ signaled=WaitForMultipleObjects(2,new IntPtr[]{process.hProcess,parent},false,100); if(signaled!=WAIT_TIMEOUT)break; if(System.IO.File.Exists(cancelMarker)){try{terminationAttempted=true;processDeathObserved=true;TerminateAndObserveProcess(job,process.hProcess,117);return 125;}catch{processDeathObserved=false;throw;}} if(watch.ElapsedMilliseconds>=timeoutMs){try{terminationAttempted=true;processDeathObserved=true;TerminateAndObserveProcess(job,process.hProcess,116);return 124;}catch{processDeathObserved=false;throw;}} }
      if (signaled == 1) {
        terminationAttempted=true;TerminateAndObserveProcess(job, process.hProcess, 114);processDeathObserved=true;
      }
      else if (signaled == 0) processDeathObserved=true;
      else { int error = Marshal.GetLastWin32Error(); terminationAttempted=true;TerminateAndObserveProcess(job,process.hProcess,115);processDeathObserved=true;throw new Win32Exception(error); }
      uint exitCode; if (!GetExitCodeProcess(process.hProcess, out exitCode)) throw new Win32Exception(Marshal.GetLastWin32Error()); return unchecked((int)exitCode);
    } catch(CueObservationAcquireException acquireFailure){processDeathObserved=acquireFailure.DeathObserved;if(!processDeathObserved)retainNativeHandles=true;throw;
    } catch {
      processDeathObserved=ObserveFallbackTermination(processAssigned,processDeathObserved,terminationAttempted,observation!=null,()=>{terminationAttempted=true;TerminateAndObserveProcess(job,process.hProcess,118);});
      throw;
    } finally {
      RunFinalizationAndCleanup(()=>{if(observation!=null)try{FinalizeObservationOrThrow(observation,processDeathObserved,()=>TerminateAndObserveProcess(job,process.hProcess,118));}catch{if(observation.Retained)retainNativeHandles=true;throw;}},()=>{
        if (processCreated&&!retainNativeHandles) { CloseHandle(process.hThread); CloseHandle(process.hProcess); }
        if (parent != IntPtr.Zero) CloseHandle(parent);
        if (job != IntPtr.Zero&&!retainNativeHandles) CloseHandle(job);
        if (capsPtr != IntPtr.Zero) Marshal.FreeHGlobal(capsPtr);
        if (environmentPtr != IntPtr.Zero) Marshal.FreeHGlobal(environmentPtr);
        if (handlesPtr != IntPtr.Zero) Marshal.FreeHGlobal(handlesPtr);
        if (nullRead != IntPtr.Zero && nullRead != (IntPtr)(-1)) CloseHandle(nullRead);
        if (nullWrite != IntPtr.Zero && nullWrite != (IntPtr)(-1)) CloseHandle(nullWrite);
        if (listInitialized) DeleteProcThreadAttributeList(list);
        if (list != IntPtr.Zero) Marshal.FreeHGlobal(list);
      });
    }
  }
}
'@

$payload = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($PayloadBase64)) | ConvertFrom-Json
$icacls = [IO.Path]::Combine([Environment]::GetFolderPath('Windows'), 'System32', 'icacls.exe')
if (-not [IO.File]::Exists($icacls)) { throw 'sealed icacls executable missing' }
$profile = [string]$payload.profileName
if ($profile -notmatch '^Cue\.Verifier\.[0-9a-f]{32}$') { throw 'invalid Cue verifier profile name' }
$worktree = [IO.Path]::GetFullPath([string]$payload.worktree)
$runtimeRoot = [IO.Path]::GetFullPath([string]$payload.runtimeRoot)
$executable = [IO.Path]::GetFullPath([string]$payload.executable)
foreach ($path in @($worktree,$runtimeRoot,$executable)) { if ((Get-Item -LiteralPath $path -Force).Attributes.HasFlag([IO.FileAttributes]::ReparsePoint)) { throw 'readonly verifier reparse' } }
$heldIdentity = [CueAppContainer]::HoldRoot($worktree)
$originalSddl = $null
$sid = [IntPtr]::Zero; $sidText = $null; $worktreeAce = $false; $runtimeAce = $false; $profileCreated = $false
try {
  if ($heldIdentity -ne [string]$payload.rootIdentity -or [CueAppContainer]::HeldRootIdentity() -ne $heldIdentity) { throw 'readonly root identity drift' }
  $originalSddl = (Get-Acl -LiteralPath $worktree).Sddl
  if ($originalSddl -ne [string]$payload.originalSddl) { throw 'readonly acl drift' }
  [CueAppContainer]::HoldExecutable($executable,[string]$payload.executableSha256)
  $hr = [CueAppContainer]::CreateAppContainerProfile($profile,'Cue verifier','Ephemeral read-only verifier boundary',[IntPtr]::Zero,0,[ref]$sid)
  if ($hr -ne 0) { throw "CreateAppContainerProfile failed: 0x$('{0:X8}' -f $hr)" }; $profileCreated = $true
  $sidText = (New-Object Security.Principal.SecurityIdentifier($sid)).Value
  & $icacls $worktree /grant "*$sidText`:(OI)(CI)RX" /Q | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "worktree RX grant failed: $LASTEXITCODE" }; $worktreeAce = $true
  & $icacls $runtimeRoot /grant "*$sidText`:(OI)(CI)M" /Q | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "runtime M grant failed: $LASTEXITCODE" }; $runtimeAce = $true
  if ([CueAppContainer]::HeldRootIdentity() -ne $heldIdentity) { throw 'readonly prelaunch identity drift' }
  $environment=@($payload.environment); if($environment.Count -lt 1 -or $environment.Count -gt 32){throw 'readonly environment invalid'}
  $exitCode = [CueAppContainer]::Launch($executable,[string]$payload.commandLine,$worktree,$sid,$PID,[string[]]$environment,[uint32]$payload.timeoutMs,[string]$payload.cancelMarker)
  Write-Output "CUE_READONLY_EXIT=$exitCode;NONCE=$([string]$payload.nonce)"
  exit $exitCode
} finally {
  $cleanupOk = $false
  try {
    if ($runtimeAce -and $sidText -and (Test-Path -LiteralPath $runtimeRoot)) { & $icacls $runtimeRoot /remove "*$sidText" /Q | Out-Null; if ($LASTEXITCODE -ne 0) { throw 'runtime ACE removal failed' } }
    if ($worktreeAce -and $sidText -and (Test-Path -LiteralPath $worktree)) { & $icacls $worktree /remove "*$sidText" /Q | Out-Null; if ($LASTEXITCODE -ne 0) { throw 'worktree ACE removal failed' } }
    if ($null -ne $originalSddl -and (Test-Path -LiteralPath $worktree)) { $acl=Get-Acl -LiteralPath $worktree; $acl.SetSecurityDescriptorSddlForm($originalSddl); Set-Acl -LiteralPath $worktree -AclObject $acl }
    if ([CueAppContainer]::HeldRootIdentity() -ne $heldIdentity -or (Get-Acl -LiteralPath $worktree).Sddl -ne $originalSddl) { throw 'readonly final identity or ACL drift' }
    $cleanupOk = $true
  } finally {
    if ($sid -ne [IntPtr]::Zero) { [CueAppContainer]::LocalFree($sid) | Out-Null }
    if ($profileCreated) { $deleted=-1; for($attempt=0;$attempt -lt 50;$attempt++){ $deleted=[CueAppContainer]::DeleteAppContainerProfile($profile); if($deleted -eq 0){break}; Start-Sleep -Milliseconds 100 }; if($deleted -ne 0){throw "verifier profile cleanup failed: $deleted"} }
    [CueAppContainer]::ReleaseRoot()
    [CueAppContainer]::ReleaseExecutable()
  }
  if ($cleanupOk) { Write-Output ('CUE_READONLY_CLEANUP=' + (@{nonce=[string]$payload.nonce;profileAbsent=$true;aclRestored=$true;rootIdentity=$heldIdentity} | ConvertTo-Json -Compress)) }
}
