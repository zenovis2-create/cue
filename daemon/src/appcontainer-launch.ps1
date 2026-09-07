param(
  [Parameter(Mandatory=$true)][string]$PayloadBase64
)

$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class CueAppContainer {
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

  public static int Launch(string app, string commandLine, string cwd, IntPtr sid, int parentPid) {
    IntPtr size = IntPtr.Zero;
    InitializeProcThreadAttributeList(IntPtr.Zero, 1, 0, ref size);
    IntPtr list = Marshal.AllocHGlobal(size);
    IntPtr capsPtr = IntPtr.Zero;
    IntPtr job = IntPtr.Zero;
    IntPtr parent = IntPtr.Zero;
    PROCESS_INFORMATION process = new PROCESS_INFORMATION();
    bool processCreated = false;
    try {
      if (!InitializeProcThreadAttributeList(list, 1, 0, ref size)) throw new Win32Exception(Marshal.GetLastWin32Error());
      SECURITY_CAPABILITIES caps = new SECURITY_CAPABILITIES { AppContainerSid=sid, Capabilities=IntPtr.Zero, CapabilityCount=0, Reserved=0 };
      capsPtr = Marshal.AllocHGlobal(Marshal.SizeOf(caps)); Marshal.StructureToPtr(caps, capsPtr, false);
      if (!UpdateProcThreadAttribute(list, 0, (IntPtr)0x20009, capsPtr, (IntPtr)Marshal.SizeOf(caps), IntPtr.Zero, IntPtr.Zero)) throw new Win32Exception(Marshal.GetLastWin32Error());
      STARTUPINFOEX startup = new STARTUPINFOEX(); startup.StartupInfo.cb = Marshal.SizeOf(startup); startup.lpAttributeList = list;
      job = CreateJobObject(IntPtr.Zero, null);
      if (job == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
      JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
      // A worker cannot bypass host executable sealing with its own child launch.
      // Additional programs must be separate cue_workspace calls.
      limits.BasicLimitInformation.LimitFlags = 0x00002000 | 0x00000008;
      limits.BasicLimitInformation.ActiveProcessLimit = 1;
      if (!SetInformationJobObject(job, 9, ref limits, (uint)Marshal.SizeOf(limits))) throw new Win32Exception(Marshal.GetLastWin32Error());
      if (!CreateProcess(app, commandLine, IntPtr.Zero, IntPtr.Zero, false, 0x00080004, IntPtr.Zero, cwd, ref startup, out process)) throw new Win32Exception(Marshal.GetLastWin32Error());
      processCreated = true;
      if (!AssignProcessToJobObject(job, process.hProcess)) { TerminateProcess(process.hProcess, 111); throw new Win32Exception(Marshal.GetLastWin32Error()); }
      parent = OpenProcess(0x00100000, false, parentPid);
      if (parent == IntPtr.Zero) { int error = Marshal.GetLastWin32Error(); TerminateJobObject(job, 112); throw new Win32Exception(error); }
      if (ResumeThread(process.hThread) == 0xffffffff) { TerminateProcess(process.hProcess, 112); throw new Win32Exception(Marshal.GetLastWin32Error()); }
      Console.WriteLine("CUE_APPCONTAINER_PID=" + process.dwProcessId + ";START_TIME=" + DateTime.UtcNow.ToString("o"));
      Console.Out.Flush();
      uint signaled = WaitForMultipleObjects(2, new IntPtr[] { process.hProcess, parent }, false, 0xffffffff);
      if (signaled == 1) { TerminateJobObject(job, 114); WaitForSingleObject(process.hProcess, 0xffffffff); }
      else if (signaled != 0) { int error = Marshal.GetLastWin32Error(); TerminateJobObject(job, 115); throw new Win32Exception(error); }
      uint exitCode; if (!GetExitCodeProcess(process.hProcess, out exitCode)) throw new Win32Exception(Marshal.GetLastWin32Error()); return unchecked((int)exitCode);
    } finally {
      if (processCreated) { CloseHandle(process.hThread); CloseHandle(process.hProcess); }
      if (parent != IntPtr.Zero) CloseHandle(parent);
      if (job != IntPtr.Zero) CloseHandle(job);
      if (capsPtr != IntPtr.Zero) Marshal.FreeHGlobal(capsPtr);
      if (list != IntPtr.Zero) { DeleteProcThreadAttributeList(list); Marshal.FreeHGlobal(list); }
    }
  }
}
'@

$payload = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($PayloadBase64)) | ConvertFrom-Json
$icacls = [IO.Path]::Combine([Environment]::GetFolderPath('Windows'), 'System32', 'icacls.exe')
if (-not [IO.File]::Exists($icacls)) { throw 'sealed icacls executable missing' }
$profile = 'Cue.Worker.' + [Guid]::NewGuid().ToString('N')
$sid = [IntPtr]::Zero
$sidText = $null
$aceAdded = $false
$grantedPaths = @()
$cleanupPaths = @()
try {
  $hr = [CueAppContainer]::CreateAppContainerProfile($profile, 'Cue worker', 'Ephemeral Cue worker boundary', [IntPtr]::Zero, 0, [ref]$sid)
  if ($hr -ne 0) { throw "CreateAppContainerProfile failed: 0x$('{0:X8}' -f $hr)" }
  $identity = New-Object Security.Principal.SecurityIdentifier($sid)
  $sidText = $identity.Value
  & $icacls $payload.cwd /grant "*$sidText`:(OI)(CI)M" /Q | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "icacls grant failed: $LASTEXITCODE" }
  $aceAdded = $true
  foreach ($grantPath in @($payload.grantPaths)) {
    if (-not $grantPath) { continue }
    & $icacls $grantPath /grant "*$sidText`:(OI)(CI)M" /Q | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "icacls grant failed for extra path: $LASTEXITCODE" }
    $grantedPaths += $grantPath
  }
  foreach ($cleanupPath in @($payload.cleanupPaths)) {
    if (-not $cleanupPath) { continue }
    $resolvedCleanup = [IO.Path]::GetFullPath([string]$cleanupPath)
    $leaf = [IO.Path]::GetFileName($resolvedCleanup.TrimEnd([IO.Path]::DirectorySeparatorChar))
    if (-not $leaf.StartsWith('codex-home-', [StringComparison]::Ordinal)) { throw "unsafe cleanup path refused: $resolvedCleanup" }
    if ($resolvedCleanup -eq [IO.Path]::GetFullPath([string]$payload.cwd)) { throw "worktree cleanup refused" }
    $cleanupPaths += $resolvedCleanup
  }
  $exitCode = [CueAppContainer]::Launch($payload.executable, $payload.commandLine, $payload.cwd, $sid, [int]$payload.parentPid)
  Write-Output "CUE_APPCONTAINER_EXIT=$exitCode"
  exit $exitCode
} finally {
  foreach ($cleanupPath in $cleanupPaths) { if (Test-Path -LiteralPath $cleanupPath) { Remove-Item -LiteralPath $cleanupPath -Recurse -Force } }
  if ($aceAdded -and $sidText) { & $icacls $payload.cwd /remove "*$sidText" /Q | Out-Null }
  foreach ($grantPath in $grantedPaths) { & $icacls $grantPath /remove "*$sidText" /Q | Out-Null }
  if ($sid -ne [IntPtr]::Zero) { [CueAppContainer]::LocalFree($sid) | Out-Null }
  [CueAppContainer]::DeleteAppContainerProfile($profile) | Out-Null
}
