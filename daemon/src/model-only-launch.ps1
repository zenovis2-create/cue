param(
  [Parameter(Mandatory=$true)][string]$PayloadBase64,
  [switch]$ProbeHarness,
  [switch]$QualificationHarness
)
$ErrorActionPreference = 'Stop'
function Get-SealedHash([string]$path) {
  $stream = [IO.File]::OpenRead($path); $algorithm = [Security.Cryptography.SHA256]::Create()
  try { return [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-','') }
  finally { $algorithm.Dispose(); $stream.Dispose() }
}
# Separate client boundary. No write launcher grants and no provider qualification.
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using System.ComponentModel;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
using System.Security.AccessControl;
using System.Security.Principal;
public static class CueModelBoundary {
 [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] public struct SI {
  public int cb; public string reserved, desktop, title; public int x,y,xsize,ysize,xc,yc,fill,flags;
  public short show,reserved2; public IntPtr reservedPtr,input,output,error;
 }
 [StructLayout(LayoutKind.Sequential)] public struct SIX { public SI si; public IntPtr list; }
 [StructLayout(LayoutKind.Sequential)] public struct PI { public IntPtr process,thread; public int pid,tid; }
 [StructLayout(LayoutKind.Sequential)] public struct SA { public int length; public IntPtr descriptor; public int inherit; }
 [StructLayout(LayoutKind.Sequential)] public struct Caps { public IntPtr sid,capabilities; public int count,reserved; }
 [StructLayout(LayoutKind.Sequential)] public struct Basic { public long user,job; public uint flags; public UIntPtr min,max; public uint active; public IntPtr affinity; public uint priority,scheduling; }
 [StructLayout(LayoutKind.Sequential)] public struct IO { public ulong r,w,o,rb,wb,ob; }
 [StructLayout(LayoutKind.Sequential)] public struct Limits { public Basic basic; public IO io; public UIntPtr processMemory,jobMemory,peakProcess,peakJob; }
 [DllImport("userenv.dll",CharSet=CharSet.Unicode)] public static extern int CreateAppContainerProfile(string name,string display,string desc,IntPtr caps,int count,out IntPtr sid);
 [DllImport("userenv.dll",CharSet=CharSet.Unicode)] public static extern int DeleteAppContainerProfile(string name);
 [DllImport("userenv.dll",CharSet=CharSet.Unicode)] public static extern int GetAppContainerFolderPath(string sid,out IntPtr path);
 [DllImport("kernel32.dll")] public static extern IntPtr LocalFree(IntPtr value);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode)] static extern uint GetNamedSecurityInfo(string name,int type,uint info,out IntPtr owner,out IntPtr group,out IntPtr dacl,out IntPtr sacl,out IntPtr descriptor);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode)] static extern uint SetNamedSecurityInfo(string name,int type,uint info,IntPtr owner,IntPtr group,IntPtr dacl,IntPtr sacl);
 [DllImport("advapi32.dll")] static extern uint GetSecurityDescriptorLength(IntPtr descriptor);
 static RawSecurityDescriptor ReadAcl(string path) {
  IntPtr owner,group,dacl,sacl,descriptor;
  uint error=GetNamedSecurityInfo(path,1,7,out owner,out group,out dacl,out sacl,out descriptor);
  if(error!=0) throw new InvalidOperationException("GetNamedSecurityInfo:"+error);
  try { byte[] bytes=new byte[GetSecurityDescriptorLength(descriptor)]; Marshal.Copy(descriptor,bytes,0,bytes.Length); return new RawSecurityDescriptor(bytes,0); }
  finally { LocalFree(descriptor); }
 }
 static string AclBytes(RawAcl acl) { byte[] bytes=new byte[acl.BinaryLength]; acl.GetBinaryForm(bytes,0); return Convert.ToBase64String(bytes); }
 public static void AssertReadOnly(string path) {
  RawSecurityDescriptor actual=ReadAcl(path);
  if(actual.DiscretionaryAcl==null || (actual.ControlFlags & ControlFlags.DiscretionaryAclProtected)==0) throw new InvalidOperationException("client_acl_unprotected");
  foreach(GenericAce ace in actual.DiscretionaryAcl) {
   KnownAce known=ace as KnownAce; QualifiedAce qualified=ace as QualifiedAce;
   if(known==null || qualified==null) throw new InvalidOperationException("unknown_ace_refused");
   if(known.SecurityIdentifier.Value.StartsWith("S-1-15-",StringComparison.Ordinal) && qualified.AceQualifier==AceQualifier.AccessAllowed && (known.AccessMask & ~0x001200A9)!=0) throw new InvalidOperationException("client_write_grant_restored");
  }
 }
 public static void SealReadOnly(string path,string sid,bool directory) {
  RawSecurityDescriptor before=ReadAcl(path);
  if(before.DiscretionaryAcl==null) throw new InvalidOperationException("null_dacl_refused");
  RawAcl desired=new RawAcl(before.DiscretionaryAcl.Revision,before.DiscretionaryAcl.Count+1);
  foreach(GenericAce original in before.DiscretionaryAcl) {
   KnownAce known=original as KnownAce;
   if(known==null) throw new InvalidOperationException("unknown_ace_refused");
   if(known.SecurityIdentifier.Value.StartsWith("S-1-15-",StringComparison.Ordinal)) continue;
   byte[] bytes=new byte[original.BinaryLength]; original.GetBinaryForm(bytes,0);
   GenericAce preserved=GenericAce.CreateFromBinaryForm(bytes,0); preserved.AceFlags &= ~AceFlags.Inherited;
   desired.InsertAce(desired.Count,preserved);
  }
  desired.InsertAce(desired.Count,new CommonAce(directory ? AceFlags.ContainerInherit|AceFlags.ObjectInherit : AceFlags.None,AceQualifier.AccessAllowed,0x001200A9,new SecurityIdentifier(sid),false,null));
  byte[] raw=new byte[desired.BinaryLength]; desired.GetBinaryForm(raw,0); IntPtr pointer=Marshal.AllocHGlobal(raw.Length);
  try { Marshal.Copy(raw,0,pointer,raw.Length); uint error=SetNamedSecurityInfo(path,1,0x80000004,IntPtr.Zero,IntPtr.Zero,pointer,IntPtr.Zero); if(error!=0) throw new InvalidOperationException("SetNamedSecurityInfo:"+error); }
  finally { Marshal.FreeHGlobal(pointer); }
  RawSecurityDescriptor after=ReadAcl(path);
  if(after.DiscretionaryAcl==null || AclBytes(desired)!=AclBytes(after.DiscretionaryAcl)) throw new InvalidOperationException("client_acl_bytes_mismatch");
  AssertReadOnly(path);
 }
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool InitializeProcThreadAttributeList(IntPtr list,int count,int flags,ref IntPtr size);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool UpdateProcThreadAttribute(IntPtr list,uint flags,IntPtr attr,IntPtr value,IntPtr size,IntPtr previous,IntPtr returned);
 [DllImport("kernel32.dll")] static extern void DeleteProcThreadAttributeList(IntPtr list);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateProcess(string app,string command,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr env,string cwd,ref SIX startup,out PI process);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool CreatePipe(out IntPtr read,out IntPtr write,ref SA security,uint size);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetHandleInformation(IntPtr handle,uint mask,uint flags);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr sa,string name);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int type,ref Limits value,uint length);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateJobObject(IntPtr job,uint code);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateProcess(IntPtr process,uint code);
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,int pid);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint WaitForMultipleObjects(uint count,IntPtr[] handles,bool all,uint ms);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle,uint ms);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr process,out uint code);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 [StructLayout(LayoutKind.Sequential)] struct CompletionAssociation { public IntPtr key,port; }
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr CreateIoCompletionPort(IntPtr file,IntPtr existing,IntPtr key,uint threads);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetQueuedCompletionStatus(IntPtr port,out uint message,out IntPtr key,out IntPtr overlapped,uint timeout);
 [DllImport("kernel32.dll",SetLastError=true,EntryPoint="SetInformationJobObject")] static extern bool AssociateCompletionPort(IntPtr job,int type,ref CompletionAssociation association,uint length);
 static void ObserveProcessLimit(PI process,IntPtr job,IntPtr port,IntPtr ownedKey,long expectedCreated) {
  IntPtr info=IntPtr.Zero;
  try {
   if(GetProcessId(process.process)!=(uint)process.pid) throw new InvalidOperationException("limit_identity_mismatch");
   long created,exited,kernel,user; Check(GetProcessTimes(process.process,out created,out exited,out kernel,out user));
   if(created!=expectedCreated) throw new InvalidOperationException("limit_identity_changed");
   int length=Marshal.SizeOf(typeof(Limits)); info=Marshal.AllocHGlobal(length); uint returned;
   Check(QueryInformationJobObject(job,9,info,(uint)length,out returned)); if(returned!=length) throw new InvalidOperationException("limit_query_length");
   Limits limits=(Limits)Marshal.PtrToStructure(info,typeof(Limits));
   if(limits.basic.active!=1 || (limits.basic.flags&0x2008)!=0x2008 || (limits.basic.flags&0x1800)!=0) throw new InvalidOperationException("limit_policy_changed");
   int matched=0; bool exhausted=true; var clock=System.Diagnostics.Stopwatch.StartNew();
   for(int i=0;i<64 && clock.ElapsedMilliseconds<100;i++) {
    uint message; IntPtr key,overlapped;
    if(!GetQueuedCompletionStatus(port,out message,out key,out overlapped,10)) {
     if(Marshal.GetLastWin32Error()!=258) throw new InvalidOperationException("limit_queue_unknown"); exhausted=false; break;
    }
    if(key!=ownedKey) throw new InvalidOperationException("limit_foreign_key");
    if(message==3) { if(overlapped!=IntPtr.Zero) throw new InvalidOperationException("limit_unexpected_pid"); matched++; }
   }
   if(exhausted) throw new InvalidOperationException("limit_queue_bound");
   // Delivery of ACTIVE_PROCESS_LIMIT is not guaranteed. No event is unknown,
   // never evidence of permission or denial. Its overlapped value is NOT a PID.
   Console.WriteLine("CUE_MODEL_PROCESS_LIMIT={\"status\":\""+(matched>0?"observed":"unknown")+"\",\"ownedWorkerPid\":"+process.pid+",\"createdFileTime\":\""+created+"\",\"activeProcessLimit\":"+limits.basic.active+",\"eventCount\":"+matched+",\"messageId\":3,\"qualification\":\"unknown\"}");
  } catch { Console.WriteLine("CUE_MODEL_PROCESS_LIMIT={\"status\":\"unknown\",\"qualification\":\"unknown\"}"); }
  finally { if(info!=IntPtr.Zero) Marshal.FreeHGlobal(info); Console.Out.Flush(); }
 }
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint GetProcessId(IntPtr process);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetProcessTimes(IntPtr process,out long created,out long exited,out long kernel,out long user);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool OpenProcessToken(IntPtr process,uint access,out IntPtr token);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool GetTokenInformation(IntPtr token,int type,IntPtr info,uint size,out uint needed);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job,int type,IntPtr info,uint size,out uint returned);
 [DllImport("FirewallAPI.dll")] static extern uint NetworkIsolationGetAppContainerConfig(out uint count,out IntPtr entries);
 [DllImport("kernel32.dll")] static extern IntPtr GetProcessHeap();
 [DllImport("kernel32.dll")] static extern bool HeapFree(IntPtr heap,uint flags,IntPtr memory);
 [StructLayout(LayoutKind.Sequential)] struct SidAttributes { public IntPtr sid; public uint attributes; }
 static IntPtr TokenInfo(IntPtr token,int type,out uint size) {
  GetTokenInformation(token,type,IntPtr.Zero,0,out size);
  if(size==0 || size>65536) throw new InvalidOperationException("observer_token_size");
  IntPtr buffer=Marshal.AllocHGlobal((int)size);
  try { uint returned; Check(GetTokenInformation(token,type,buffer,size,out returned)); if(returned>size) throw new InvalidOperationException("observer_token_length"); return buffer; }
  catch { Marshal.FreeHGlobal(buffer); throw; }
 }
 static bool IsLoopbackExempt(string expectedSid) {
  uint count=0; IntPtr entries=IntPtr.Zero;
  try {
   uint error=NetworkIsolationGetAppContainerConfig(out count,out entries);
   if(error!=0) throw new InvalidOperationException("observer_loopback_api:"+error);
   if(count>65536 || (count>0 && entries==IntPtr.Zero)) throw new InvalidOperationException("observer_exemption_count");
   bool exempt=false; int stride=Marshal.SizeOf(typeof(SidAttributes));
   for(uint i=0;i<count;i++) { IntPtr sid=Marshal.ReadIntPtr(entries,checked((int)i*stride)); if(sid==IntPtr.Zero) throw new InvalidOperationException("observer_exemption_sid"); if(new SecurityIdentifier(sid).Value==expectedSid) exempt=true; }
   return exempt;
  } finally {
   // Native API owns separate heap allocations for each SID and the array.
   if(entries!=IntPtr.Zero) { int stride=Marshal.SizeOf(typeof(SidAttributes)); for(uint i=0;i<count;i++) HeapFree(GetProcessHeap(),0,Marshal.ReadIntPtr(entries,checked((int)i*stride))); HeapFree(GetProcessHeap(),0,entries); }
  }
 }
 static void Observe(PI process,IntPtr job,IntPtr expectedSidPointer) {
  IntPtr token=IntPtr.Zero,info=IntPtr.Zero,jobInfo=IntPtr.Zero,members=IntPtr.Zero;
  try {
   Check(GetProcessId(process.process)==(uint)process.pid);
   if(WaitForSingleObject(process.process,0)!=0x102) throw new InvalidOperationException("observer_child_not_live");
   long created,exited,kernel,user; Check(GetProcessTimes(process.process,out created,out exited,out kernel,out user));
   Check(OpenProcessToken(process.process,0x8,out token)); uint size;
   info=TokenInfo(token,29,out size); if(size<4 || Marshal.ReadInt32(info)!=1) throw new InvalidOperationException("observer_not_appcontainer"); Marshal.FreeHGlobal(info); info=IntPtr.Zero;
   info=TokenInfo(token,31,out size); if(size<IntPtr.Size || Marshal.ReadIntPtr(info)==IntPtr.Zero) throw new InvalidOperationException("observer_missing_sid");
   string sid=new SecurityIdentifier(Marshal.ReadIntPtr(info)).Value;
   if(sid!=new SecurityIdentifier(expectedSidPointer).Value) throw new InvalidOperationException("observer_sid_mismatch"); Marshal.FreeHGlobal(info); info=IntPtr.Zero;
   info=TokenInfo(token,30,out size); if(size<4) throw new InvalidOperationException("observer_capabilities_missing");
   int capabilityCount=Marshal.ReadInt32(info); if(capabilityCount!=0) throw new InvalidOperationException("observer_capabilities_not_zero"); Marshal.FreeHGlobal(info); info=IntPtr.Zero;
   int length=Marshal.SizeOf(typeof(Limits)); jobInfo=Marshal.AllocHGlobal(length); uint returned;
   Check(QueryInformationJobObject(job,9,jobInfo,(uint)length,out returned)); if(returned!=length) throw new InvalidOperationException("observer_job_length");
   Limits limits=(Limits)Marshal.PtrToStructure(jobInfo,typeof(Limits));
   if(limits.basic.active!=1 || (limits.basic.flags&0x2008)!=0x2008 || (limits.basic.flags&0x1800)!=0) throw new InvalidOperationException("observer_job_limits");
   members=Marshal.AllocHGlobal(8+256*IntPtr.Size); Check(QueryInformationJobObject(job,3,members,(uint)(8+256*IntPtr.Size),out returned));
   if(Marshal.ReadInt32(members,0)!=1 || Marshal.ReadInt32(members,4)!=1 || Marshal.ReadIntPtr(members,8).ToInt64()!=process.pid) throw new InvalidOperationException("observer_job_membership");
   bool exempt=IsLoopbackExempt(sid); if(exempt) throw new InvalidOperationException("observer_loopback_exempt");
   long createdAgain; Check(GetProcessTimes(process.process,out createdAgain,out exited,out kernel,out user));
   if(createdAgain!=created || WaitForSingleObject(process.process,0)!=0x102) throw new InvalidOperationException("observer_identity_race");
   Console.WriteLine("CUE_MODEL_OBSERVATION={\"status\":\"observed\",\"phase\":\"suspended-before-resume\",\"pid\":"+process.pid+",\"createdFileTime\":\""+created+"\",\"appContainer\":true,\"appContainerSid\":\""+sid+"\",\"capabilities\":[],\"job\":{\"flags\":"+limits.basic.flags+",\"activeProcessLimit\":"+limits.basic.active+",\"memberPids\":["+process.pid+"]},\"loopbackExempt\":false,\"qualification\":\"unknown\"}");
   Console.Out.Flush();
  } catch {
   Console.WriteLine("CUE_MODEL_OBSERVATION={\"status\":\"unknown\",\"phase\":\"suspended-before-resume\",\"qualification\":\"unknown\"}"); Console.Out.Flush(); throw;
  } finally { if(info!=IntPtr.Zero) Marshal.FreeHGlobal(info); if(jobInfo!=IntPtr.Zero) Marshal.FreeHGlobal(jobInfo); if(members!=IntPtr.Zero) Marshal.FreeHGlobal(members); if(token!=IntPtr.Zero) CloseHandle(token); }
 }
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] public static extern IntPtr CreateEvent(IntPtr security,bool manual,bool initial,string name);
 public static void Release(IntPtr handle) { if(handle!=IntPtr.Zero) CloseHandle(handle); }
 public static IntPtr PrepareJob(string name) {
  IntPtr job=CreateJobObject(IntPtr.Zero,name); Check(job!=IntPtr.Zero);
  try { Limits limits=new Limits(); limits.basic.flags=0x2000|0x8; limits.basic.active=1; Check(SetInformationJobObject(job,9,ref limits,(uint)Marshal.SizeOf(limits))); return job; }
  catch { CloseHandle(job); throw; }
 }
 public static void AwaitGuardian(IntPtr ready,int guardianPid) {
  IntPtr guardian=OpenProcess(0x100000,false,guardianPid); Check(guardian!=IntPtr.Zero);
  try { if(WaitForMultipleObjects(2,new IntPtr[]{ready,guardian},false,10000)!=0) throw new InvalidOperationException("guardian_not_ready"); }
  finally { CloseHandle(guardian); }
 }
 static void Check(bool result) { if(!result) throw new Win32Exception(Marshal.GetLastWin32Error()); }
 static string BoundedLine(TextReader reader,int limit) {
  var line=new StringBuilder(); int value;
  while((value=reader.Read())!=-1) { if(value==10) return line.ToString(); if(line.Length>=limit) throw new InvalidDataException("broker_frame_limit"); line.Append((char)value); }
  throw new EndOfStreamException("broker_frame_eof");
 }
 public static string ReadBrokerFrame(int maxBytes,int timeout) {
  var reading=Task.Run(()=>BoundedLine(Console.In,checked(4*((maxBytes+2)/3))));
  if(!reading.Wait(timeout)) throw new TimeoutException("broker_input_timeout");
  byte[] bytes=Convert.FromBase64String(reading.Result);
  if(bytes.Length>maxBytes) throw new InvalidDataException("broker_input_limit");
  return new UTF8Encoding(false,true).GetString(bytes);
 }
 static string RelayBrokerOutput(Stream output,int maxBytes) {
  using(var reader=new StreamReader(output,new UTF8Encoding(false,true),false,4096,true)) {
   for(int i=0;i<2;i++) {
    string line=BoundedLine(reader,maxBytes); byte[] bytes=Encoding.UTF8.GetBytes(line);
    if(bytes.Length>maxBytes) throw new InvalidDataException("broker_output_limit");
    Console.WriteLine("CUE_MODEL_FRAME="+Convert.ToBase64String(bytes)); Console.Out.Flush();
   }
   if(reader.Read()!=-1) throw new InvalidDataException("broker_extra_output");
   return "";
  }
 }
 static void Close(ref IntPtr handle) { if(handle!=IntPtr.Zero) { CloseHandle(handle); handle=IntPtr.Zero; } }
 public static int Launch(string executable,string client,string cwd,IntPtr sid,int parentPid,string environment,string request,int timeout,Action sealBeforeResume,IntPtr job,bool broker,int maxRequestBytes,int maxResultBytes,bool checker) {
  IntPtr list=IntPtr.Zero,capsPtr=IntPtr.Zero,handlesPtr=IntPtr.Zero,env=IntPtr.Zero,parent=IntPtr.Zero;
  IntPtr inputRead=IntPtr.Zero,inputWrite=IntPtr.Zero,outputRead=IntPtr.Zero,outputWrite=IntPtr.Zero;
  IntPtr completionPort=IntPtr.Zero,completionKey=IntPtr.Zero;
  long childCreated=0;
  PI process=new PI(); bool initialized=false,assigned=false;
  FileStream input=null,output=null;
  try {
   // Private port/key, associated while the owned Job is empty; neither is inherited.
   completionPort=CreateIoCompletionPort((IntPtr)(-1),IntPtr.Zero,IntPtr.Zero,1); Check(completionPort!=IntPtr.Zero);
   completionKey=Marshal.AllocHGlobal(1);
   CompletionAssociation association=new CompletionAssociation { key=completionKey,port=completionPort };
   Check(AssociateCompletionPort(job,7,ref association,(uint)Marshal.SizeOf(association)));
   SA security=new SA { length=Marshal.SizeOf(typeof(SA)),inherit=1 };
   Check(CreatePipe(out inputRead,out inputWrite,ref security,8192)); Check(CreatePipe(out outputRead,out outputWrite,ref security,16384));
   Check(SetHandleInformation(inputWrite,1,0)); Check(SetHandleInformation(outputRead,1,0));
   IntPtr size=IntPtr.Zero; InitializeProcThreadAttributeList(IntPtr.Zero,2,0,ref size);
   list=Marshal.AllocHGlobal(size); Check(InitializeProcThreadAttributeList(list,2,0,ref size)); initialized=true;
   Caps caps=new Caps { sid=sid,count=0 }; capsPtr=Marshal.AllocHGlobal(Marshal.SizeOf(caps)); Marshal.StructureToPtr(caps,capsPtr,false);
   Check(UpdateProcThreadAttribute(list,0,(IntPtr)0x20009,capsPtr,(IntPtr)Marshal.SizeOf(caps),IntPtr.Zero,IntPtr.Zero));
   handlesPtr=Marshal.AllocHGlobal(2*IntPtr.Size); Marshal.WriteIntPtr(handlesPtr,0,inputRead); Marshal.WriteIntPtr(handlesPtr,IntPtr.Size,outputWrite);
   Check(UpdateProcThreadAttribute(list,0,(IntPtr)0x20002,handlesPtr,(IntPtr)(2*IntPtr.Size),IntPtr.Zero,IntPtr.Zero));
   SIX startup=new SIX(); startup.si.cb=Marshal.SizeOf(startup); startup.si.flags=0x100; startup.si.input=inputRead; startup.si.output=outputWrite; startup.si.error=outputWrite; startup.list=list;
   Check(job!=IntPtr.Zero);
   parent=OpenProcess(0x100000,false,parentPid); Check(parent!=IntPtr.Zero);
   env=Marshal.StringToHGlobalUni(environment);
   // Main is an owned staged regular file. Avoid ancestor realpath reads outside its RX grant.
   // Checker-only dependencies also need lexical resolution: native initial diagnostic
   // observed node:fs lstat failure during fixed require. Both files are staged regular
   // files with verified hashes; no request-selected modules or symlinks are copied.
   Check(CreateProcess(executable,"\""+executable+"\" --no-addons --preserve-symlinks-main "+(checker?"--preserve-symlinks ":"")+"\""+client+"\"",IntPtr.Zero,IntPtr.Zero,true,0x80004|0x400|0x08000000,env,cwd,ref startup,out process));
   long childExited,childKernel,childUser; Check(GetProcessTimes(process.process,out childCreated,out childExited,out childKernel,out childUser));
   Check(AssignProcessToJobObject(job,process.process)); assigned=true;
   // CreateProcess initializes the package profile and can restore its default grants.
   // Reseal synchronously while the only child thread is still suspended. A failure
   // reaches finally and terminates the Job without executing child user code.
   if(sealBeforeResume==null) throw new InvalidOperationException("client_seal_required");
   sealBeforeResume();
   Observe(process,job,sid);
   Close(ref inputRead); Close(ref outputWrite);
   input=new FileStream(new SafeFileHandle(inputWrite,true),FileAccess.Write); inputWrite=IntPtr.Zero;
   output=new FileStream(new SafeFileHandle(outputRead,true),FileAccess.Read); outputRead=IntPtr.Zero;
   var reader=Task.Run(()=> { if(broker) return RelayBrokerOutput(output,Math.Max(maxRequestBytes,maxResultBytes)); using(var buffer=new MemoryStream()) { byte[] chunk=new byte[1024]; int count;
    while((count=output.Read(chunk,0,chunk.Length))>0) { if(buffer.Length+count>16384) throw new InvalidDataException("client_output_limit"); buffer.Write(chunk,0,count); }
    return Convert.ToBase64String(buffer.ToArray()); } });
   if(ResumeThread(process.thread)==0xffffffff) throw new Win32Exception(Marshal.GetLastWin32Error());
   Console.WriteLine("CUE_MODEL_PID="+process.pid); Console.Out.Flush();
   byte[] message=Encoding.UTF8.GetBytes(request+(broker?"\n":"")); input.Write(message,0,message.Length); input.Flush();
   Task reply=null;
   if(broker) {
    FileStream brokerInput=input;
    reply=Task.Run(()=> { string response=ReadBrokerFrame(maxResultBytes,timeout); byte[] bytes=Encoding.UTF8.GetBytes(response+"\n"); brokerInput.Write(bytes,0,bytes.Length); brokerInput.Dispose(); });
   } else { input.Dispose(); input=null; }
   uint reason=WaitForMultipleObjects(2,new IntPtr[]{process.process,parent},false,(uint)timeout);
   if(reason!=0) { Check(TerminateJobObject(job,reason==1?114u:113u)); if(WaitForSingleObject(process.process,5000)!=0) throw new TimeoutException("client_cleanup_unverified"); }
   uint code; Check(GetExitCodeProcess(process.process,out code));
   if(!reader.Wait(5000)) throw new TimeoutException("client_pipe_cleanup_unverified");
   if(broker && code==0 && (reply==null || !reply.Wait(5000))) throw new TimeoutException("broker_reply_unverified");
   ObserveProcessLimit(process,job,completionPort,completionKey,childCreated);
   Console.WriteLine("CUE_MODEL_RESPONSE="+reader.Result); Console.WriteLine("CUE_MODEL_STOP_REASON="+reason); return unchecked((int)code);
  } finally {
   if(process.process!=IntPtr.Zero) {
    if(assigned) TerminateJobObject(job,115); else TerminateProcess(process.process,115);
    if(WaitForSingleObject(process.process,5000)!=0) Console.Error.WriteLine("CUE_MODEL_CLEANUP_UNKNOWN");
   }
   if(input!=null) input.Dispose(); if(output!=null) output.Dispose();
   Close(ref inputRead); Close(ref inputWrite); Close(ref outputRead); Close(ref outputWrite);
   Close(ref process.thread); Close(ref process.process); Close(ref parent);
   if(completionPort!=IntPtr.Zero) { CompletionAssociation detached=new CompletionAssociation(); AssociateCompletionPort(job,7,ref detached,(uint)Marshal.SizeOf(detached)); Close(ref completionPort); }
   if(completionKey!=IntPtr.Zero) Marshal.FreeHGlobal(completionKey);
   if(initialized) DeleteProcThreadAttributeList(list);
   if(list!=IntPtr.Zero) Marshal.FreeHGlobal(list); if(capsPtr!=IntPtr.Zero) Marshal.FreeHGlobal(capsPtr);
   if(handlesPtr!=IntPtr.Zero) Marshal.FreeHGlobal(handlesPtr); if(env!=IntPtr.Zero) Marshal.FreeHGlobal(env);
  }
 }
}
'@

if ($PayloadBase64.Length -gt 32768) { throw 'payload_limit' }
$payload = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($PayloadBase64)) | ConvertFrom-Json
$allowed = @('nodeExecutable','nodeSha256','parentPid','request','timeoutMs','broker','maxRequestBytes','maxResultBytes','clientKind','controlBundle')
if ($ProbeHarness -and $QualificationHarness) { throw 'harness_modes_conflict' }
if ($ProbeHarness) { $allowed += @('probePath','probeSha256','probeHoldAfterExit') }
if ($QualificationHarness) { $allowed += @('diagnosticClientSha256','qualificationOperation','qualificationHoldAfterExit') }
foreach ($property in $payload.PSObject.Properties.Name) { if ($property -notin $allowed) { throw 'unknown_payload_field' } }
if ($payload.PSObject.Properties.Name -contains 'probeHoldAfterExit' -and ($payload.probeHoldAfterExit -isnot [bool] -or $payload.probeHoldAfterExit -ne $true)) { throw 'invalid_probe_hold' }
if ($payload.parentPid -le 0 -or $payload.timeoutMs -lt 100 -or $payload.timeoutMs -gt 30000) { throw 'invalid_lifecycle_limit' }
$broker = $payload.broker -eq $true
$clientKind = 'model'
if ($null -ne $payload.clientKind) {
  if ($payload.clientKind -isnot [string] -or $payload.clientKind -notin @('model','json-checker','goal-proposal-checker') -or $ProbeHarness) { throw 'invalid_static_client' }
  $clientKind = $payload.clientKind
}
if ($clientKind -in @('json-checker','goal-proposal-checker') -and -not $broker -and -not $QualificationHarness) { throw 'checker_requires_broker' }
$pin = $payload.controlBundle
if ($ProbeHarness) {
  if ($null -ne $pin) { throw 'probe_control_bundle_refused' }
} else {
  if ($null -eq $pin) { throw 'control_bundle_required' }
  $pinFields = @('version','clientKind','nodeSha256','launcherSha256','guardianSha256','clientSha256','checkerCoreSha256')
  if (@($pin.PSObject.Properties).Count -ne 8) { throw 'control_bundle_invalid' }
  foreach ($key in $pin.PSObject.Properties.Name) { if ($key -notin ($pinFields + @('sha256'))) { throw 'control_bundle_invalid' } }
  if ($pin.version -cne 'cue-model-control-v1' -or $pin.clientKind -cne $clientKind -or $pin.nodeSha256 -ine $payload.nodeSha256) { throw 'control_bundle_invalid' }
  foreach ($key in @('nodeSha256','launcherSha256','guardianSha256','clientSha256','sha256')) { if ($pin.$key -isnot [string] -or $pin.$key -cnotmatch '^[a-f0-9]{64}$') { throw 'control_bundle_invalid' } }
  if (($clientKind -eq 'model' -and $null -ne $pin.checkerCoreSha256) -or ($clientKind -in @('json-checker','goal-proposal-checker') -and ($pin.checkerCoreSha256 -isnot [string] -or $pin.checkerCoreSha256 -cnotmatch '^[a-f0-9]{64}$'))) { throw 'control_bundle_invalid' }
  $values = New-Object 'System.Collections.Generic.List[object]'
  foreach ($key in $pinFields) { $values.Add($pin.$key) }
  $pinJson = ConvertTo-Json -InputObject $values.ToArray() -Compress
  $hasher = [Security.Cryptography.SHA256]::Create()
  try { $pinDigest = ([BitConverter]::ToString($hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($pinJson)))).Replace('-','').ToLowerInvariant() } finally { $hasher.Dispose() }
  if ($pinDigest -cne $pin.sha256) { throw 'control_bundle_digest' }
  # Installed launcher/control root trust is a host prerequisite; self-hash only detects drift.
  if ((Get-SealedHash $PSCommandPath) -ine $pin.launcherSha256) { throw 'control_launcher_hash_mismatch' }
  if ((Get-SealedHash (Join-Path $PSScriptRoot 'model-only-profile-cleanup.ps1')) -ine $pin.guardianSha256) { throw 'control_guardian_hash_mismatch' }
}

if ($QualificationHarness -and $broker) { throw 'qualification_broker_refused' }
if ($broker) {
  if ($ProbeHarness -or $null -ne $payload.request) { throw 'broker_argv_request_refused' }
  if ($payload.maxRequestBytes -isnot [int] -or $payload.maxRequestBytes -lt 1 -or $payload.maxRequestBytes -gt 1048576 -or $payload.maxResultBytes -isnot [int] -or $payload.maxResultBytes -lt 1 -or $payload.maxResultBytes -gt 1048576) { throw 'broker_invalid_limits' }
  $requestText = [CueModelBoundary]::ReadBrokerFrame($payload.maxRequestBytes,$payload.timeoutMs)
} else {
  if ($payload.request -isnot [string] -or [Text.Encoding]::UTF8.GetByteCount($payload.request) -gt 8192) { throw 'request_limit' }
  $requestText = $payload.request
}
if ($QualificationHarness) {
  if ($payload.diagnosticClientSha256 -isnot [string] -or $payload.diagnosticClientSha256 -cnotmatch '^[a-f0-9]{64}$' -or $payload.qualificationOperation -cnotin @('filesystem-network','process-limit')) { throw 'qualification_invalid' }
  if ($payload.PSObject.Properties.Name -contains 'qualificationHoldAfterExit' -and ($payload.qualificationHoldAfterExit -isnot [bool] -or $payload.qualificationHoldAfterExit -ne $true)) { throw 'qualification_invalid_hold' }
  $qualificationRequest = $requestText | ConvertFrom-Json
  $requestKeys = @('protocol','operation')
  if ($payload.qualificationOperation -ceq 'filesystem-network') { $requestKeys += @('outsideFile','port','nonce') }
  if (@($qualificationRequest.PSObject.Properties).Count -ne $requestKeys.Count -or $qualificationRequest.protocol -cne 'cue-boundary-probe-v1' -or $qualificationRequest.operation -cne $payload.qualificationOperation) { throw 'qualification_invalid_request' }
  foreach ($key in $qualificationRequest.PSObject.Properties.Name) { if ($key -cnotin $requestKeys) { throw 'qualification_invalid_request' } }
  if ($payload.qualificationOperation -ceq 'filesystem-network') {
    if ($qualificationRequest.outsideFile -isnot [string] -or $qualificationRequest.outsideFile.Length -gt 1024 -or $qualificationRequest.outsideFile.Contains([char]0) -or $qualificationRequest.port -isnot [int] -or $qualificationRequest.port -lt 1 -or $qualificationRequest.port -gt 65535 -or $qualificationRequest.nonce -isnot [string] -or $qualificationRequest.nonce -cnotmatch '^[a-zA-Z0-9-]{1,128}$') { throw 'qualification_invalid_request' }
    $outside = [IO.Path]::GetFullPath($qualificationRequest.outsideFile)
    $outsideDirectory = [IO.Path]::GetDirectoryName($outside)
    if ($outside -cne $qualificationRequest.outsideFile -or [IO.Path]::GetFileName($outside) -cne 'outside.txt' -or [IO.Path]::GetFileName($outsideDirectory) -cnotmatch '^Cue\.Qualification\.[a-zA-Z0-9-]{1,64}$' -or [IO.Path]::GetDirectoryName($outsideDirectory) -ine ([IO.Path]::GetTempPath()).TrimEnd('\')) { throw 'qualification_outside_not_fixture' }
    foreach ($path in @($outsideDirectory,$outside)) { $item=Get-Item -LiteralPath $path; if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'qualification_fixture_reparse' } }
    if (-not [IO.File]::Exists($outside)) { throw 'qualification_fixture_missing' }
  }
}
if ($payload.nodeSha256 -notmatch '^[0-9a-fA-F]{64}$' -or (Get-SealedHash $payload.nodeExecutable) -ne $payload.nodeSha256) { throw 'node_hash_mismatch' }
$clientSource = Join-Path $PSScriptRoot 'model-only-client.cjs'
if ($clientKind -eq 'json-checker') { $clientSource = Join-Path $PSScriptRoot 'json-checker-client.cjs' }
if ($clientKind -eq 'goal-proposal-checker') { $clientSource = Join-Path $PSScriptRoot 'goal-proposal-checker-client.cjs' }
 $productionClientSource = $clientSource
if ($QualificationHarness) {
  $clientSource = Join-Path $PSScriptRoot 'model-boundary-probe.cjs'
  if ((Get-SealedHash $clientSource) -ine $payload.diagnosticClientSha256) { throw 'qualification_client_hash_mismatch' }
}
if ($ProbeHarness) {
  if ($payload.probeSha256 -notmatch '^[0-9a-fA-F]{64}$' -or (Get-SealedHash $payload.probePath) -ne $payload.probeSha256) { throw 'probe_hash_mismatch' }
  $clientSource = $payload.probePath
}
$profile = 'Cue.Model.' + [Guid]::NewGuid().ToString('N')
$taskRoot = Join-Path ([IO.Path]::GetTempPath()) $profile
$sid = [IntPtr]::Zero; $profileCreated = $false; $profilePath = $null; $rootCreated = $false
$ownedJob = [IntPtr]::Zero; $readyEvent = [IntPtr]::Zero; $guardianLock = $null
function Set-ClientReadOnly([string]$path, $identity) {
  $items = @((Get-Item -LiteralPath $path)) + @(Get-ChildItem -LiteralPath $path -Force -Recurse)
  foreach ($item in $items) {
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'boundary_reparse_point' }
    # A fresh native DACL removes original ACE flag variants that .NET's exact
    # rule-removal could leave behind. Preserve raw host ACEs, replace package ACEs.
    [CueModelBoundary]::SealReadOnly($item.FullName,$identity.Value,$item.PSIsContainer)
  }
}
function Assert-ClientReadOnly([string]$path) {
  $items = @((Get-Item -LiteralPath $path)) + @(Get-ChildItem -LiteralPath $path -Force -Recurse)
  foreach ($item in $items) {
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'boundary_reparse_point' }
    [CueModelBoundary]::AssertReadOnly($item.FullName)
  }
}
try {
  # Arm the cleanup guardian before creating a profile, task root, or client.
  # Names are unpredictable and objects use the host token's default DACL;
  # no AppContainer SID/ALL APPLICATION PACKAGES grant is added.
  $jobName = "Local\$profile.job"; $readyName = "Local\$profile.ready"
  $ownedJob = [CueModelBoundary]::PrepareJob($jobName)
  $readyEvent = [CueModelBoundary]::CreateEvent([IntPtr]::Zero,$true,$false,$readyName)
  if ($readyEvent -eq [IntPtr]::Zero) { throw 'guardian_event_failed' }
  $guardianPayload = @{profile=$profile;root=$taskRoot;jobName=$jobName;readyName=$readyName;launcherPid=$PID;launcherCreated=([Diagnostics.Process]::GetCurrentProcess().StartTime.ToUniversalTime().ToFileTimeUtc().ToString())} | ConvertTo-Json -Compress
  $guardianEncoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($guardianPayload))
  $guardianScript = Join-Path $PSScriptRoot 'model-only-profile-cleanup.ps1'
  # Deny replacement/write from final verification until guardian has loaded and armed.
  $guardianLock = [IO.File]::Open($guardianScript,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
  if ($null -ne $pin -and (Get-SealedHash $guardianScript) -ine $pin.guardianSha256) { throw 'control_guardian_hash_mismatch' }
  $guardian = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList @('-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',('"' + $guardianScript + '"'),'-PayloadBase64',$guardianEncoded) -WindowStyle Hidden -PassThru
  [CueModelBoundary]::AwaitGuardian($readyEvent,$guardian.Id)
  $guardianLock.Dispose(); $guardianLock = $null
  Write-Output "CUE_MODEL_GUARDIAN_PID=$($guardian.Id)"
  # Read creation times from the exact owned Process handles, never session wall-clock metadata.
  $launcherProcess = [Diagnostics.Process]::GetCurrentProcess()
  if ($guardian.HasExited) { throw 'guardian_identity_exited' }
  $hostIdentity = @{launcher=@{pid=$PID;createdFileTime=$launcherProcess.StartTime.ToUniversalTime().ToFileTimeUtc().ToString()};guardian=@{pid=$guardian.Id;createdFileTime=$guardian.StartTime.ToUniversalTime().ToFileTimeUtc().ToString()}}
  if ($guardian.HasExited) { throw 'guardian_identity_race' }
  Write-Output ('CUE_MODEL_HOST_IDENTITY=' + ($hostIdentity | ConvertTo-Json -Compress -Depth 4))
  New-Item -ItemType Directory -Path $taskRoot | Out-Null; $rootCreated = $true
  $node = Join-Path $taskRoot 'node.exe'; $client = Join-Path $taskRoot 'client.cjs'; $temp = Join-Path $taskRoot 'temp'
  Copy-Item -LiteralPath $payload.nodeExecutable -Destination $node
  if ((Get-SealedHash $node) -ne $payload.nodeSha256) { throw 'staged_node_hash_mismatch' }
  Copy-Item -LiteralPath $clientSource -Destination $client
  $clientHash = if ($QualificationHarness) { $payload.diagnosticClientSha256 } elseif ($null -ne $pin) { $pin.clientSha256 } else { Get-SealedHash $clientSource }
  if ((Get-SealedHash $client) -ne $clientHash) { throw 'staged_client_hash_mismatch' }
  $productionClientTarget = $null
  if ($QualificationHarness) {
    $productionClientTarget = Join-Path $taskRoot 'production-client.cjs'
    Copy-Item -LiteralPath $productionClientSource -Destination $productionClientTarget
    if ((Get-SealedHash $productionClientTarget) -ine $pin.clientSha256) { throw 'qualification_production_hash_mismatch' }
  }
  $checkerCoreHash = $null
  if ($clientKind -in @('json-checker','goal-proposal-checker')) {
    $coreName = if ($clientKind -eq 'json-checker') { 'json-format-checker.cjs' } else { 'goal-proposal-checker.cjs' }
    $coreSource = Join-Path (Join-Path $PSScriptRoot 'verification') $coreName
    $checkerCoreHash = $pin.checkerCoreSha256
    $coreDirectory = Join-Path $taskRoot 'verification'
    [System.IO.Directory]::CreateDirectory($coreDirectory) | Out-Null
    $coreTarget = Join-Path $coreDirectory $coreName
    Copy-Item -LiteralPath $coreSource -Destination $coreTarget
    if ((Get-SealedHash $coreTarget) -ne $checkerCoreHash) { throw 'staged_checker_core_hash_mismatch' }
  }
  if ($ProbeHarness -and (Get-SealedHash $client) -ne $payload.probeSha256) { throw 'staged_probe_hash_mismatch' }
  New-Item -ItemType Directory -Path $temp | Out-Null
  [IO.File]::WriteAllText((Join-Path $taskRoot 'existing.txt'),'unchanged')
  $hr = [CueModelBoundary]::CreateAppContainerProfile($profile,'Cue model client','Ephemeral read-only client boundary',[IntPtr]::Zero,0,[ref]$sid)
  if ($hr -ne 0) { throw "profile_create_$hr" }; $profileCreated = $true
  $identity = New-Object Security.Principal.SecurityIdentifier($sid)
  $folder = [IntPtr]::Zero
  $hr = [CueModelBoundary]::GetAppContainerFolderPath($identity.Value,[ref]$folder)
  if ($hr -ne 0) { throw "profile_path_$hr" }
  try { $profilePath = [Runtime.InteropServices.Marshal]::PtrToStringUni($folder) } finally { [Runtime.InteropServices.Marshal]::FreeCoTaskMem($folder) }
  # Windows derives the package TEMP from LOCALAPPDATA. Give it the real base,
  # then seal the actual private package Temp rather than a nonexistent nested path.
  New-Item -ItemType Directory -Path (Join-Path $profilePath 'Temp') -Force | Out-Null
  Set-ClientReadOnly $taskRoot $identity
  Set-ClientReadOnly $profilePath $identity
  $localBase = [Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)
  $environment = @("APPDATA=$profilePath","LOCALAPPDATA=$localBase","SystemRoot=$env:SystemRoot","TEMP=$temp","TMP=$temp","USERPROFILE=$profilePath","WINDIR=$env:SystemRoot") -join "`0"
  $environment += "`0`0"
  Write-Output ('CUE_MODEL_BOUNDARY=' + (@{taskRoot=$taskRoot;profilePath=$profilePath;profile=$profile;sid=$identity.Value;clientOnly=$true;clientKind=$clientKind;clientSha256=$clientHash;checkerCoreSha256=$checkerCoreHash;controlBundleSha256=$(if ($null -ne $pin) { $pin.sha256 } else { $null });recipeVersion='cue-client-recipe-v1';productionClientSha256=$(if ($null -ne $pin) { $pin.clientSha256 } else { $null });diagnosticClientSha256=$(if ($QualificationHarness) { $payload.diagnosticClientSha256 } else { $null });controlStatus=$(if ($QualificationHarness) { 'qualification-pinned' } elseif ($null -ne $pin) { 'pinned' } else { 'diagnostic-unpinned' });guardianSha256=$(if ($null -ne $pin) { $pin.guardianSha256 } else { $null });preserveDependencySymlinks=($clientKind -in @('json-checker','goal-proposal-checker'))} | ConvertTo-Json -Compress))
  $seal = [Action]{
    Set-ClientReadOnly $taskRoot $identity
    Set-ClientReadOnly $profilePath $identity
    Assert-ClientReadOnly $taskRoot
    Assert-ClientReadOnly $profilePath
    if ((Get-SealedHash $node) -ine $payload.nodeSha256 -or (Get-SealedHash $client) -ine $clientHash) { throw 'control_staged_hash_mismatch' }
    if ($QualificationHarness -and (Get-SealedHash $productionClientTarget) -ine $pin.clientSha256) { throw 'qualification_production_hash_mismatch' }
    if ($clientKind -in @('json-checker','goal-proposal-checker') -and (Get-SealedHash $coreTarget) -ine $checkerCoreHash) { throw 'control_staged_core_hash_mismatch' }
    Write-Output 'CUE_MODEL_SEALED=suspended-before-resume'
  }
  $exitCode = [CueModelBoundary]::Launch($node,$client,$taskRoot,$sid,[int]$payload.parentPid,$environment,$requestText,[int]$payload.timeoutMs,$seal,$ownedJob,$broker,[int]$payload.maxRequestBytes,[int]$payload.maxResultBytes,($clientKind -in @('json-checker','goal-proposal-checker')))
  if (($ProbeHarness -and $payload.probeHoldAfterExit -eq $true) -or ($QualificationHarness -and $payload.qualificationHoldAfterExit -eq $true)) {
    # Diagnostic-only pause after the owned child has exited, before host cleanup.
    [Console]::WriteLine('CUE_MODEL_PROBE_WAIT=host-inspection'); [Console]::Out.Flush()
    $inspectionDeadline = [Diagnostics.Stopwatch]::StartNew()
    $inspectionMarker = Join-Path $taskRoot 'host-inspection-complete'
    while (-not [IO.File]::Exists($inspectionMarker)) {
      if ($inspectionDeadline.ElapsedMilliseconds -ge 5000) { throw 'probe_inspection_timeout' }
      [Threading.Thread]::Sleep(10)
    }
  }
  if ([IO.File]::ReadAllText((Join-Path $taskRoot 'existing.txt')) -ne 'unchanged') { throw 'workfile_mutated' }
  Write-Output "CUE_MODEL_EXIT=$exitCode"
} finally {
  if ($null -ne $guardianLock) { $guardianLock.Dispose() }
  [CueModelBoundary]::Release($readyEvent)
  [CueModelBoundary]::Release($ownedJob)
  if ($sid -ne [IntPtr]::Zero) { [CueModelBoundary]::LocalFree($sid) | Out-Null }
  if ($profileCreated) {
    $deleted = -1
    for ($attempt=0; $attempt -lt 30; $attempt++) { $deleted = [CueModelBoundary]::DeleteAppContainerProfile($profile); if ($deleted -eq 0) { break }; Start-Sleep -Milliseconds 100 }
    if ($deleted -ne 0) { throw "profile_cleanup_unknown_$deleted" }
  }
  if ($rootCreated) {
    $resolvedRoot = [IO.Path]::GetFullPath($taskRoot)
    if ([IO.Path]::GetDirectoryName($resolvedRoot) -ne [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') -or [IO.Path]::GetFileName($resolvedRoot) -notmatch '^Cue\.Model\.[0-9a-f]{32}$') { throw 'unsafe_cleanup_root' }
    Remove-Item -LiteralPath $resolvedRoot -Recurse -Force
  }
  Write-Output ('CUE_MODEL_CLEANUP=' + (@{taskRootAbsent= -not (Test-Path -LiteralPath $taskRoot);profileAbsent=($null -eq $profilePath -or -not (Test-Path -LiteralPath $profilePath))} | ConvertTo-Json -Compress))
}
exit $exitCode
