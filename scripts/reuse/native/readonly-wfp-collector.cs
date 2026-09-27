using System;
using System.Collections.Generic;
using System.Globalization;
using System.Net;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Threading;

public sealed class WfpRequest { public string ExecutablePath; public string PackageSid; public ushort RemotePort; public int DurationMs; }
public sealed class WfpEvent { public ulong Timestamp; public uint Flags; public uint IpVersion; public uint Protocol; public uint RemoteAddress; public ushort RemotePort; public string PackageSid; public byte[] AppId; public int Capability; public ulong FilterId; public bool IsLoopback; }
public sealed class WfpResult { public string Version="cue-wfp-collector-v1"; public string State="unknown"; public string Lifecycle="not-requested"; public uint OpenCode=uint.MaxValue; public uint GetCode=uint.MaxValue; public uint AppIdCode=uint.MaxValue; public uint SubscribeCode=uint.MaxValue; public uint UnsubscribeCode=uint.MaxValue; public uint CloseCode=uint.MaxValue; public int CollectionValue=-1; public bool Overflow; public WfpEvent[] Events=new WfpEvent[0]; }
public enum WorkerStartObservation { Unknown=0,Started=1,Rejected=2 }
public enum WorkerDeathObservation { Unknown=0,Dead=1,Alive=2,Cancelled=3,Timeout=4 }
public interface IReadonlyWorkerLifecycle { WorkerStartObservation StartAfterSubscription(); WorkerDeathObservation ObserveDeath(int timeoutMs); WorkerDeathObservation StopAndObserveDeath(); }
public interface IWfpNative {
  uint Open(out IntPtr engine); uint GetCollection(IntPtr engine,out int value); uint GetAppId(string path,out IntPtr appId,out byte[] bytes);
  uint Subscribe(IntPtr engine,WfpRequest request,byte[] appId,Action<WfpEvent> callback,out IntPtr subscription,out object rootedContext);
  uint Unsubscribe(IntPtr engine,IntPtr subscription); void Free(ref IntPtr memory); uint Close(IntPtr engine); void Wait(int milliseconds);
}
public static class WfpNativeLifetimeGuard { static readonly List<object> quarantine=new List<object>();static bool active,poisoned;public static bool TryBegin(){lock(quarantine){if(active||poisoned)return false;active=true;return true;}}public static void Release(){lock(quarantine){active=false;}}public static void Quarantine(params object[] owned){lock(quarantine){poisoned=true;active=false;quarantine.Add(owned);}} }
public static class WfpRequestValidator { public static bool IsValid(WfpRequest r){try{if(r==null||r.DurationMs<1||r.DurationMs>5000||r.RemotePort!=48193||String.IsNullOrEmpty(r.ExecutablePath)||r.ExecutablePath.Length>512||r.ExecutablePath.Length<3||r.ExecutablePath[1]!=':'||r.ExecutablePath[2]!='\\'||r.ExecutablePath.IndexOf('/')>=0)return false;foreach(char c in r.ExecutablePath)if(c<32||c>126)return false;foreach(string part in r.ExecutablePath.Split('\\'))if(part=="."||part=="..")return false;if(String.IsNullOrEmpty(r.PackageSid)||r.PackageSid.Length>184||!r.PackageSid.StartsWith("S-1-15-2-",StringComparison.Ordinal))return false;var sid=new SecurityIdentifier(r.PackageSid);return sid!=null;}catch{return false;}} }

public static class ReadonlyWfpCollector {
  public static WfpResult Collect(WfpRequest request,IWfpNative native) { return CollectCore(request,native,null); }
  public static WfpResult CollectWithLifecycle(WfpRequest request,IWfpNative native,IReadonlyWorkerLifecycle lifecycle) { if(lifecycle==null)return new WfpResult();return CollectCore(request,native,lifecycle); }
  static WfpResult CollectCore(WfpRequest request,IWfpNative native,IReadonlyWorkerLifecycle lifecycle) {
    var result=new WfpResult();if(native==null||!WfpRequestValidator.IsValid(request)||!WfpNativeLifetimeGuard.TryBegin())return result;
    IntPtr engine=IntPtr.Zero,appId=IntPtr.Zero,subscription=IntPtr.Zero;object rooted=null;var events=new List<WfpEvent>();bool overflow=false,subscribed=false,unsubscribeAttempted=false,safeCleanup=true,completed=false,cleanupFailed=false,lifecycleStartAttempted=false,quarantined=false,lifecycleCaptured=true;
    try {
      result.OpenCode=native.Open(out engine);if(result.OpenCode!=0||engine==IntPtr.Zero)return result;
      result.GetCode=native.GetCollection(engine,out result.CollectionValue);if(result.GetCode!=0||result.CollectionValue!=1)return result;
      byte[] appBytes;result.AppIdCode=native.GetAppId(request.ExecutablePath,out appId,out appBytes);if(result.AppIdCode!=0||appId==IntPtr.Zero||appBytes==null||appBytes.Length<1||appBytes.Length>4096)return result;
      result.SubscribeCode=native.Subscribe(engine,request,appBytes,e=>{lock(events){if(e==null||events.Count>=64){overflow=true;return;}events.Add(e);}},out subscription,out rooted);
      if(result.SubscribeCode!=0||subscription==IntPtr.Zero){if(subscription!=IntPtr.Zero){safeCleanup=false;WfpNativeLifetimeGuard.Quarantine(native,engine,appId,subscription,rooted);quarantined=true;}return result;}subscribed=true;
      if(lifecycle==null){native.Wait(request.DurationMs);}else{result.Lifecycle="subscription-ready";lifecycleStartAttempted=true;var started=lifecycle.StartAfterSubscription();if(started==WorkerStartObservation.Rejected){lifecycleStartAttempted=false;lifecycleCaptured=false;result.Lifecycle="start-rejected";}else if(started!=WorkerStartObservation.Started){result.Lifecycle="start-unverified";safeCleanup=false;WfpNativeLifetimeGuard.Quarantine(native,engine,appId,subscription,rooted,lifecycle);quarantined=true;return result;}else{result.Lifecycle="started";var death=lifecycle.ObserveDeath(request.DurationMs);if(death==WorkerDeathObservation.Alive||death==WorkerDeathObservation.Cancelled||death==WorkerDeathObservation.Timeout){lifecycleCaptured=false;result.Lifecycle=death==WorkerDeathObservation.Alive?"alive":death==WorkerDeathObservation.Cancelled?"cancelled":"timeout";death=lifecycle.StopAndObserveDeath();}if(death!=WorkerDeathObservation.Dead){result.Lifecycle="death-unknown";safeCleanup=false;WfpNativeLifetimeGuard.Quarantine(native,engine,appId,subscription,rooted,lifecycle);quarantined=true;return result;}result.Lifecycle="dead";}}
      unsubscribeAttempted=true;result.UnsubscribeCode=native.Unsubscribe(engine,subscription);if(result.UnsubscribeCode!=0){WfpNativeLifetimeGuard.Quarantine(native,engine,appId,subscription,rooted);quarantined=true;safeCleanup=false;return result;}subscribed=false;subscription=IntPtr.Zero;
      lock(events){result.Overflow=overflow;result.Events=events.ToArray();}completed=!overflow&&lifecycleCaptured;
    } catch {
      if(subscribed||subscription!=IntPtr.Zero||rooted!=null){if(lifecycle!=null&&lifecycleStartAttempted)safeCleanup=false;else if(!unsubscribeAttempted&&subscribed)try{unsubscribeAttempted=true;result.UnsubscribeCode=native.Unsubscribe(engine,subscription);if(result.UnsubscribeCode==0){subscribed=false;subscription=IntPtr.Zero;}else safeCleanup=false;}catch{safeCleanup=false;}else safeCleanup=false;if(!safeCleanup&&!quarantined){WfpNativeLifetimeGuard.Quarantine(native,engine,appId,subscription,rooted,lifecycle);quarantined=true;}}
      return result;
    }
    finally {
      if(safeCleanup){if(appId!=IntPtr.Zero)try{native.Free(ref appId);}catch{cleanupFailed=true;}if(engine!=IntPtr.Zero)try{result.CloseCode=native.Close(engine);if(result.CloseCode==0)engine=IntPtr.Zero;else cleanupFailed=true;}catch{cleanupFailed=true;}}
      else {GC.KeepAlive(rooted);}if(cleanupFailed)WfpNativeLifetimeGuard.Quarantine(native,engine,appId,rooted);else if(!quarantined)WfpNativeLifetimeGuard.Release();
    }
    if(completed&&!cleanupFailed&&result.CloseCode==0)result.State="captured";return result;
  }
}

public sealed class NativeWfp : IWfpNative {
  const uint RPC_C_AUTHN_WINNT=10,FWPM_ENGINE_COLLECT_NET_EVENTS=0,FWP_UINT32=3,TYPE_CAPABILITY_DROP=7;
  const uint IP_PROTOCOL=1,REMOTE_ADDR=4,REMOTE_PORT=16,APP_ID=32,IP_VERSION=256,PACKAGE_ID=1024;
  [StructLayout(LayoutKind.Sequential)] struct VALUE_LAYOUT { public uint type; public UIntPtr unionStorage; }
  [StructLayout(LayoutKind.Sequential)] struct BLOB { public uint size; public IntPtr data; }
  [StructLayout(LayoutKind.Explicit,Size=16)] struct ADDRESS { [FieldOffset(0)] public uint v4; }
  [StructLayout(LayoutKind.Sequential)] struct HEADER3 { public long timestamp;public uint flags;public uint ipVersion;public byte protocol;public ADDRESS localAddress;public ADDRESS remoteAddress;public ushort localPort;public ushort remotePort;public uint scope;public BLOB appId;public IntPtr userId;public uint addressFamily;public IntPtr packageSid;public IntPtr enterpriseId;public ulong policyFlags;public BLOB effectiveName; }
  [StructLayout(LayoutKind.Sequential)] struct EVENT3 { public HEADER3 header;public uint type;public IntPtr detail; }
  [StructLayout(LayoutKind.Sequential)] struct CAPABILITY_DROP { public uint capability;public ulong filterId;[MarshalAs(UnmanagedType.Bool)]public bool isLoopback; }
  [StructLayout(LayoutKind.Sequential)] struct SUBSCRIPTION { public IntPtr enumTemplate;public uint flags;public Guid sessionKey; }
  [UnmanagedFunctionPointer(CallingConvention.Winapi)] delegate void CALLBACK(IntPtr context,IntPtr eventPtr);
  [DllImport("fwpuclnt.dll",CharSet=CharSet.Unicode)] static extern uint FwpmEngineOpen0(string server,uint auth,IntPtr identity,IntPtr session,out IntPtr engine);
  [DllImport("fwpuclnt.dll")] static extern uint FwpmEngineGetOption0(IntPtr engine,uint option,out IntPtr value);
  [DllImport("fwpuclnt.dll",CharSet=CharSet.Unicode)] static extern uint FwpmGetAppIdFromFileName0(string path,out IntPtr appId);
  [DllImport("fwpuclnt.dll")] static extern uint FwpmNetEventSubscribe2(IntPtr engine,ref SUBSCRIPTION subscription,CALLBACK callback,IntPtr context,out IntPtr eventsHandle);
  [DllImport("fwpuclnt.dll")] static extern uint FwpmNetEventUnsubscribe0(IntPtr engine,IntPtr eventsHandle);
  [DllImport("fwpuclnt.dll")] static extern void FwpmFreeMemory0(ref IntPtr memory);
  [DllImport("fwpuclnt.dll")] static extern uint FwpmEngineClose0(IntPtr engine);
  [DllImport("advapi32.dll")] static extern uint GetLengthSid(IntPtr sid);
  public uint Open(out IntPtr engine){return FwpmEngineOpen0(null,RPC_C_AUTHN_WINNT,IntPtr.Zero,IntPtr.Zero,out engine);}
  public uint GetCollection(IntPtr engine,out int value){value=-1;IntPtr p=IntPtr.Zero;uint code=FwpmEngineGetOption0(engine,FWPM_ENGINE_COLLECT_NET_EVENTS,out p);try{if(code==0&&p!=IntPtr.Zero){uint type=unchecked((uint)Marshal.ReadInt32(p,0));if(type!=FWP_UINT32)return 13;int offset=Marshal.OffsetOf(typeof(VALUE_LAYOUT),"unionStorage").ToInt32();value=Marshal.ReadInt32(p,offset);}}catch{return 13;}finally{if(p!=IntPtr.Zero)FwpmFreeMemory0(ref p);}return code;}
  public uint GetAppId(string path,out IntPtr appId,out byte[] bytes){bytes=null;uint code=FwpmGetAppIdFromFileName0(path,out appId);if(code!=0||appId==IntPtr.Zero)return code;try{var blob=(BLOB)Marshal.PtrToStructure(appId,typeof(BLOB));if(blob.size<1||blob.size>4096||blob.data==IntPtr.Zero)return 13;bytes=new byte[blob.size];Marshal.Copy(blob.data,bytes,0,(int)blob.size);return 0;}catch{return 13;}}
  static byte[] CopyBlob(BLOB b){if(b.size<1||b.size>4096||b.data==IntPtr.Zero)return null;var x=new byte[b.size];Marshal.Copy(b.data,x,0,(int)b.size);return x;}
  static bool Equal(byte[] a,byte[] b){if(a==null||b==null||a.Length!=b.Length)return false;int d=0;for(int i=0;i<a.Length;i++)d|=a[i]^b[i];return d==0;}
  static bool IsLoopbackV4(uint address){return address==0x7f000001u;}
  static string CopySid(IntPtr p){if(p==IntPtr.Zero)return null;uint n=GetLengthSid(p);if(n<8||n>256)return null;var bytes=new byte[n];Marshal.Copy(p,bytes,0,(int)n);return new SecurityIdentifier(bytes,0).Value;}
  public uint Subscribe(IntPtr engine,WfpRequest request,byte[] expectedAppId,Action<WfpEvent> emit,out IntPtr subscription,out object rootedContext){
    CALLBACK callback=(ctx,p)=>{try{var e=(EVENT3)Marshal.PtrToStructure(p,typeof(EVENT3));uint need=IP_PROTOCOL|REMOTE_ADDR|REMOTE_PORT|APP_ID|IP_VERSION|PACKAGE_ID;var observedApp=CopyBlob(e.header.appId);var observedSid=CopySid(e.header.packageSid);if(e.type!=TYPE_CAPABILITY_DROP||(e.header.flags&need)!=need||e.header.ipVersion!=0||e.header.protocol!=6||!IsLoopbackV4(e.header.remoteAddress.v4)||e.header.remotePort!=request.RemotePort||!Equal(observedApp,expectedAppId)||!String.Equals(observedSid,request.PackageSid,StringComparison.Ordinal)||e.detail==IntPtr.Zero)return;var d=(CAPABILITY_DROP)Marshal.PtrToStructure(e.detail,typeof(CAPABILITY_DROP));if(!d.isLoopback)return;emit(new WfpEvent{Timestamp=unchecked((ulong)e.header.timestamp),Flags=e.header.flags,IpVersion=e.header.ipVersion,Protocol=e.header.protocol,RemoteAddress=e.header.remoteAddress.v4,RemotePort=e.header.remotePort,PackageSid=observedSid,AppId=(byte[])observedApp.Clone(),Capability=(int)d.capability,FilterId=d.filterId,IsLoopback=true});}catch{emit(null);} };
    rootedContext=callback;var spec=new SUBSCRIPTION();return FwpmNetEventSubscribe2(engine,ref spec,callback,IntPtr.Zero,out subscription);
  }
  public uint Unsubscribe(IntPtr engine,IntPtr subscription){return FwpmNetEventUnsubscribe0(engine,subscription);}public void Free(ref IntPtr p){FwpmFreeMemory0(ref p);}public uint Close(IntPtr engine){return FwpmEngineClose0(engine);}public void Wait(int ms){Thread.Sleep(ms);}
}
