# Read/write diagnostic limited to its own ephemeral profile. No child launch.
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
public static class CueAclDiagnostic {
 [DllImport("userenv.dll",CharSet=CharSet.Unicode)] public static extern int CreateAppContainerProfile(string name,string display,string description,IntPtr capabilities,int count,out IntPtr sid);
 [DllImport("userenv.dll",CharSet=CharSet.Unicode)] public static extern int DeleteAppContainerProfile(string name);
 [DllImport("userenv.dll",CharSet=CharSet.Unicode)] public static extern int GetAppContainerFolderPath(string sid,out IntPtr path);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode)] static extern uint GetNamedSecurityInfo(string name,int type,uint info,out IntPtr owner,out IntPtr group,out IntPtr dacl,out IntPtr sacl,out IntPtr descriptor);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode)] static extern uint SetNamedSecurityInfo(string name,int type,uint info,IntPtr owner,IntPtr group,IntPtr dacl,IntPtr sacl);
 [DllImport("advapi32.dll")] static extern uint GetSecurityDescriptorLength(IntPtr descriptor);
 [DllImport("kernel32.dll")] public static extern IntPtr LocalFree(IntPtr pointer);
 public static RawSecurityDescriptor Read(string path) {
  IntPtr owner,group,dacl,sacl,descriptor;
  uint error=GetNamedSecurityInfo(path,1,7,out owner,out group,out dacl,out sacl,out descriptor);
  if(error!=0) throw new InvalidOperationException("GetNamedSecurityInfo:"+error);
  try { byte[] bytes=new byte[GetSecurityDescriptorLength(descriptor)]; Marshal.Copy(descriptor,bytes,0,bytes.Length); return new RawSecurityDescriptor(bytes,0); }
  finally { LocalFree(descriptor); }
 }
 public static RawAcl Fresh(RawSecurityDescriptor before,string sid) {
  if(before.DiscretionaryAcl==null) throw new InvalidOperationException("null_dacl_refused");
  RawAcl desired=new RawAcl(before.DiscretionaryAcl.Revision,before.DiscretionaryAcl.Count+1);
  foreach(GenericAce original in before.DiscretionaryAcl) {
   KnownAce known=original as KnownAce;
   if(known==null) throw new InvalidOperationException("unknown_ace_refused");
   if(known.SecurityIdentifier.Value.StartsWith("S-1-15-",StringComparison.Ordinal)) continue;
   byte[] bytes=new byte[original.BinaryLength]; original.GetBinaryForm(bytes,0);
   GenericAce preserved=GenericAce.CreateFromBinaryForm(bytes,0);
   // Freeze the host-management entries as explicit entries on this private tree.
   preserved.AceFlags &= ~AceFlags.Inherited;
   desired.InsertAce(desired.Count,preserved);
  }
  desired.InsertAce(desired.Count,new CommonAce(AceFlags.ContainerInherit|AceFlags.ObjectInherit,AceQualifier.AccessAllowed,0x001200A9,new SecurityIdentifier(sid),false,null));
  return desired;
 }
 public static void Write(string path,RawAcl desired) {
  byte[] bytes=new byte[desired.BinaryLength]; desired.GetBinaryForm(bytes,0); IntPtr acl=Marshal.AllocHGlobal(bytes.Length);
  try { Marshal.Copy(bytes,0,acl,bytes.Length); uint error=SetNamedSecurityInfo(path,1,0x80000004,IntPtr.Zero,IntPtr.Zero,acl,IntPtr.Zero); if(error!=0) throw new InvalidOperationException("SetNamedSecurityInfo:"+error); }
  finally { Marshal.FreeHGlobal(acl); }
 }
 public static string Bytes(RawAcl acl) { byte[] bytes=new byte[acl.BinaryLength]; acl.GetBinaryForm(bytes,0); return Convert.ToBase64String(bytes); }
}
'@
function Get-Masks($acl) {
  $rows = @()
  foreach ($ace in $acl) {
    $rows += [ordered]@{sid=$ace.SecurityIdentifier.Value;mask=('0x{0:X8}' -f $ace.AccessMask);flags=[string]$ace.AceFlags;type=[string]$ace.AceType}
  }
  return ,$rows
}
$name = 'Cue.Model.Diagnostic.' + [Guid]::NewGuid().ToString('N')
$root = Join-Path ([IO.Path]::GetTempPath()) $name
$sid = [IntPtr]::Zero; $created = $false; $profilePath = $null; $rootCreated = $false
try {
  New-Item -ItemType Directory -Path $root | Out-Null; $rootCreated = $true
  $code = [CueAclDiagnostic]::CreateAppContainerProfile($name,'Cue ACL diagnostic','No child process',[IntPtr]::Zero,0,[ref]$sid)
  if ($code -ne 0) { throw "profile_create:$code" }; $created = $true
  $identity = New-Object Security.Principal.SecurityIdentifier($sid)
  $folder = [IntPtr]::Zero
  $code = [CueAclDiagnostic]::GetAppContainerFolderPath($identity.Value,[ref]$folder)
  if ($code -ne 0) { throw "profile_path:$code" }
  try { $profilePath = [Runtime.InteropServices.Marshal]::PtrToStringUni($folder) } finally { [Runtime.InteropServices.Marshal]::FreeCoTaskMem($folder) }
  $temp = Join-Path $profilePath 'Temp'; New-Item -ItemType Directory -Path $temp -Force | Out-Null
  $paths = @($root,$profilePath,$temp)
  $records = @()
  foreach ($path in $paths) {
    if (((Get-Item -LiteralPath $path).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'reparse_refused' }
    $before = [CueAclDiagnostic]::Read($path)
    $desired = [CueAclDiagnostic]::Fresh($before,$identity.Value)
    [CueAclDiagnostic]::Write($path,$desired)
    $after = [CueAclDiagnostic]::Read($path)
    $records += [ordered]@{path=$path;before=(Get-Masks $before.DiscretionaryAcl);desired=(Get-Masks $desired);actual=(Get-Masks $after.DiscretionaryAcl);
      exactDaclBytes=([CueAclDiagnostic]::Bytes($desired) -eq [CueAclDiagnostic]::Bytes($after.DiscretionaryAcl));protected=(($after.ControlFlags -band [Security.AccessControl.ControlFlags]::DiscretionaryAclProtected) -ne 0)}
  }
  # Re-read after all three writes without calling a profile API or creating any process.
  $later = @($paths | ForEach-Object { $acl = [CueAclDiagnostic]::Read($_); [ordered]@{path=$_;actual=(Get-Masks $acl.DiscretionaryAcl)} })
  [ordered]@{diagnostic='native-fresh-dacl-before-process';profile=$name;sid=$identity.Value;rxMask='0x001200A9';records=$records;later=$later;childLaunched=$false;qualification='unknown'} | ConvertTo-Json -Depth 12 -Compress
} finally {
  if ($sid -ne [IntPtr]::Zero) { [CueAclDiagnostic]::LocalFree($sid) | Out-Null }
  if ($created) {
    $deleted = -1
    for ($attempt=0;$attempt -lt 30;$attempt++) { $deleted = [CueAclDiagnostic]::DeleteAppContainerProfile($name); if ($deleted -eq 0) { break }; Start-Sleep -Milliseconds 100 }
    if ($deleted -ne 0) { throw "profile_cleanup_unknown:$deleted" }
  }
  if ($rootCreated) {
    $absolute = [IO.Path]::GetFullPath($root)
    if ([IO.Path]::GetDirectoryName($absolute) -ne [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') -or [IO.Path]::GetFileName($absolute) -notmatch '^Cue\.Model\.Diagnostic\.[0-9a-f]{32}$') { throw 'unsafe_root_cleanup' }
    Remove-Item -LiteralPath $absolute -Recurse -Force
  }
  $rootAbsent = -not (Test-Path -LiteralPath $root)
  $profileAbsent = $null -eq $profilePath -or -not (Test-Path -LiteralPath $profilePath)
  [ordered]@{cleanup=$true;rootAbsent=$rootAbsent;profileAbsent=$profileAbsent} | ConvertTo-Json -Compress
  if (-not $rootAbsent -or -not $profileAbsent) { throw 'cleanup_unverified' }
}
