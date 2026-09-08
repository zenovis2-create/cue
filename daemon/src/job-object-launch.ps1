param(
  [Parameter(Mandatory=$true)][string]$PayloadBase64
)

$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class CueJobLauncher {
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
  [StructLayout(LayoutKind.Sequential)] public struct PROCESS_INFORMATION { public IntPtr hProcess; public IntPtr hThread; public Int32 dwProcessId; public Int32 dwThreadId; }
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

  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool CreateProcess(string app, string commandLine, IntPtr processAttributes, IntPtr threadAttributes, bool inheritHandles, uint flags, IntPtr environment, string cwd, ref STARTUPINFO startup, out PROCESS_INFORMATION process);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attributes, string name);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int informationClass, ref JOBOBJECT_EXTENDED_LIMIT_INFORMATION information, uint length);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateJobObject(IntPtr job, uint exitCode);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateProcess(IntPtr process, uint exitCode);
  [DllImport("kernel32.dll", SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
  [DllImport("kernel32.dll", SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
  [DllImport("kernel32.dll", SetLastError=true)] static extern uint WaitForMultipleObjects(uint count, IntPtr[] handles, bool waitAll, uint milliseconds);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr process, out uint exitCode);
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint access, bool inheritHandle, int processId);
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr GetStdHandle(int standardHandle);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);

  static void WaitForExitOrThrow(IntPtr process) {
    uint wait = WaitForSingleObject(process, 5000);
    if (wait == WAIT_TIMEOUT) throw new TimeoutException("process remained alive after termination");
    if (wait == WAIT_FAILED) throw new Win32Exception(Marshal.GetLastWin32Error());
    if (wait != WAIT_OBJECT_0) throw new InvalidOperationException("unexpected process wait result: " + wait);
  }

  static void TerminateAndWait(IntPtr job, IntPtr process, uint exitCode) {
    if (!TerminateJobObject(job, exitCode)) throw new Win32Exception(Marshal.GetLastWin32Error());
    WaitForExitOrThrow(process);
  }

  static void TerminateProcessAndWait(IntPtr process, uint exitCode) {
    if (!TerminateProcess(process, exitCode)) throw new Win32Exception(Marshal.GetLastWin32Error());
    WaitForExitOrThrow(process);
  }

  public static int Launch(string app, string commandLine, string cwd, int parentPid) {
    IntPtr job = IntPtr.Zero;
    IntPtr parent = IntPtr.Zero;
    PROCESS_INFORMATION process = new PROCESS_INFORMATION();
    bool processCreated = false;
    try {
      job = CreateJobObject(IntPtr.Zero, null);
      if (job == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
      JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
      limits.BasicLimitInformation.LimitFlags = 0x00002000;
      if (!SetInformationJobObject(job, 9, ref limits, (uint)Marshal.SizeOf(limits))) throw new Win32Exception(Marshal.GetLastWin32Error());

      STARTUPINFO startup = new STARTUPINFO();
      startup.cb = Marshal.SizeOf(startup);
      startup.dwFlags = 0x00000100;
      startup.hStdInput = GetStdHandle(-10);
      startup.hStdOutput = GetStdHandle(-11);
      startup.hStdError = GetStdHandle(-12);
      if (!CreateProcess(app, commandLine, IntPtr.Zero, IntPtr.Zero, true, 0x00000004, IntPtr.Zero, cwd, ref startup, out process)) throw new Win32Exception(Marshal.GetLastWin32Error());
      processCreated = true;
      if (!AssignProcessToJobObject(job, process.hProcess)) { int error = Marshal.GetLastWin32Error(); TerminateProcessAndWait(process.hProcess, 111); throw new Win32Exception(error); }
      parent = OpenProcess(0x00100000, false, parentPid);
      if (parent == IntPtr.Zero) { int error = Marshal.GetLastWin32Error(); TerminateAndWait(job, process.hProcess, 112); throw new Win32Exception(error); }
      Console.Error.WriteLine("CUE_HOST_CONTROLLER_PID=" + process.dwProcessId + ";START_TIME=" + DateTime.UtcNow.ToString("o"));
      Console.Error.Flush();
      if (ResumeThread(process.hThread) == 0xffffffff) { int error = Marshal.GetLastWin32Error(); TerminateAndWait(job, process.hProcess, 113); throw new Win32Exception(error); }

      uint signaled = WaitForMultipleObjects(2, new IntPtr[] { process.hProcess, parent }, false, 0xffffffff);
      if (signaled == 1) {
        TerminateAndWait(job, process.hProcess, 114);
      } else if (signaled != 0) {
        int error = Marshal.GetLastWin32Error(); TerminateAndWait(job, process.hProcess, 115); throw new Win32Exception(error);
      }
      uint exitCode;
      if (!GetExitCodeProcess(process.hProcess, out exitCode)) throw new Win32Exception(Marshal.GetLastWin32Error());
      return unchecked((int)exitCode);
    } finally {
      if (processCreated) { CloseHandle(process.hThread); CloseHandle(process.hProcess); }
      if (parent != IntPtr.Zero) CloseHandle(parent);
      if (job != IntPtr.Zero) CloseHandle(job);
    }
  }
}
'@

$payload = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($PayloadBase64)) | ConvertFrom-Json
$exitCode = [CueJobLauncher]::Launch([string]$payload.executable, [string]$payload.commandLine, [string]$payload.cwd, [int]$payload.parentPid)
exit $exitCode
