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

  [DllImport("userenv.dll", CharSet=CharSet.Unicode)] public static extern int CreateAppContainerProfile(string name, string display, string description, IntPtr capabilities, int count, out IntPtr sid);
  [DllImport("userenv.dll", CharSet=CharSet.Unicode)] public static extern int DeleteAppContainerProfile(string name);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool InitializeProcThreadAttributeList(IntPtr list, int count, int flags, ref IntPtr size);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool UpdateProcThreadAttribute(IntPtr list, uint flags, IntPtr attribute, IntPtr value, IntPtr size, IntPtr previous, IntPtr returned);
  [DllImport("kernel32.dll")] static extern void DeleteProcThreadAttributeList(IntPtr list);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool CreateProcess(string app, string commandLine, IntPtr processAttributes, IntPtr threadAttributes, bool inheritHandles, uint flags, IntPtr environment, string cwd, ref STARTUPINFOEX startup, out PROCESS_INFORMATION process);
  [DllImport("kernel32.dll", SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr process, out uint exitCode);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  [DllImport("kernel32.dll")] public static extern IntPtr LocalFree(IntPtr value);

  public static int Launch(string app, string commandLine, string cwd, IntPtr sid) {
    IntPtr size = IntPtr.Zero;
    InitializeProcThreadAttributeList(IntPtr.Zero, 1, 0, ref size);
    IntPtr list = Marshal.AllocHGlobal(size);
    IntPtr capsPtr = IntPtr.Zero;
    try {
      if (!InitializeProcThreadAttributeList(list, 1, 0, ref size)) throw new Win32Exception(Marshal.GetLastWin32Error());
      SECURITY_CAPABILITIES caps = new SECURITY_CAPABILITIES { AppContainerSid=sid, Capabilities=IntPtr.Zero, CapabilityCount=0, Reserved=0 };
      capsPtr = Marshal.AllocHGlobal(Marshal.SizeOf(caps)); Marshal.StructureToPtr(caps, capsPtr, false);
      if (!UpdateProcThreadAttribute(list, 0, (IntPtr)0x20009, capsPtr, (IntPtr)Marshal.SizeOf(caps), IntPtr.Zero, IntPtr.Zero)) throw new Win32Exception(Marshal.GetLastWin32Error());
      STARTUPINFOEX startup = new STARTUPINFOEX(); startup.StartupInfo.cb = Marshal.SizeOf(startup); startup.lpAttributeList = list;
      PROCESS_INFORMATION process;
      if (!CreateProcess(app, commandLine, IntPtr.Zero, IntPtr.Zero, false, 0x00080000, IntPtr.Zero, cwd, ref startup, out process)) throw new Win32Exception(Marshal.GetLastWin32Error());
      Console.WriteLine("CUE_APPCONTAINER_PID=" + process.dwProcessId + ";START_TIME=" + DateTime.UtcNow.ToString("o"));
      Console.Out.Flush();
      try { WaitForSingleObject(process.hProcess, 0xffffffff); uint exitCode; if (!GetExitCodeProcess(process.hProcess, out exitCode)) throw new Win32Exception(Marshal.GetLastWin32Error()); return unchecked((int)exitCode); }
      finally { CloseHandle(process.hThread); CloseHandle(process.hProcess); }
    } finally {
      if (capsPtr != IntPtr.Zero) Marshal.FreeHGlobal(capsPtr);
      if (list != IntPtr.Zero) { DeleteProcThreadAttributeList(list); Marshal.FreeHGlobal(list); }
    }
  }
}
'@

$payload = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($PayloadBase64)) | ConvertFrom-Json
$profile = 'Cue.Worker.' + [Guid]::NewGuid().ToString('N')
$sid = [IntPtr]::Zero
$sidText = $null
$aceAdded = $false
$grantedPaths = @()
try {
  $hr = [CueAppContainer]::CreateAppContainerProfile($profile, 'Cue worker', 'Ephemeral Cue worker boundary', [IntPtr]::Zero, 0, [ref]$sid)
  if ($hr -ne 0) { throw "CreateAppContainerProfile failed: 0x$('{0:X8}' -f $hr)" }
  $identity = New-Object Security.Principal.SecurityIdentifier($sid)
  $sidText = $identity.Value
  & icacls.exe $payload.cwd /grant "*$sidText`:(OI)(CI)M" /Q | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "icacls grant failed: $LASTEXITCODE" }
  $aceAdded = $true
  foreach ($grantPath in @($payload.grantPaths)) {
    if (-not $grantPath) { continue }
    & icacls.exe $grantPath /grant "*$sidText`:(OI)(CI)M" /Q | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "icacls grant failed for extra path: $LASTEXITCODE" }
    $grantedPaths += $grantPath
  }
  $exitCode = [CueAppContainer]::Launch($payload.executable, $payload.commandLine, $payload.cwd, $sid)
  Write-Output "CUE_APPCONTAINER_EXIT=$exitCode"
  exit $exitCode
} finally {
  if ($aceAdded -and $sidText) { & icacls.exe $payload.cwd /remove:g "*$sidText" /Q | Out-Null }
  foreach ($grantPath in $grantedPaths) { & icacls.exe $grantPath /remove:g "*$sidText" /Q | Out-Null }
  if ($sid -ne [IntPtr]::Zero) { [CueAppContainer]::LocalFree($sid) | Out-Null }
  [CueAppContainer]::DeleteAppContainerProfile($profile) | Out-Null
}
