$ErrorActionPreference='Stop'
$source=@'
using System;
using System.Runtime.InteropServices;
using System.Globalization;

public static class CueWfpAvailability {
  const uint RPC_C_AUTHN_WINNT=10;
  const uint FWPM_ENGINE_COLLECT_NET_EVENTS=0;
  const uint FWP_UINT32=3;
  [StructLayout(LayoutKind.Sequential)] struct FWP_VALUE_LAYOUT { public uint type; public UIntPtr unionStorage; }

  [DllImport("fwpuclnt.dll",CharSet=CharSet.Unicode)] static extern uint FwpmEngineOpen0(string serverName,uint authnService,IntPtr authIdentity,IntPtr session,out IntPtr engineHandle);
  [DllImport("fwpuclnt.dll")] static extern uint FwpmEngineGetOption0(IntPtr engineHandle,uint option,out IntPtr value);
  [DllImport("fwpuclnt.dll")] static extern uint FwpmEngineClose0(IntPtr engineHandle);
  [DllImport("fwpuclnt.dll")] static extern void FwpmFreeMemory0(ref IntPtr memory);

  static bool TryDecode(Func<int,int> read,out uint valueType,out int value) {
    valueType=0;value=0;
    try { valueType=unchecked((uint)read(0));int unionOffset=Marshal.OffsetOf(typeof(FWP_VALUE_LAYOUT),"unionStorage").ToInt32();value=read(unionOffset);return true; }
    catch { valueType=0;value=0;return false; }
  }

  public static string Format(uint openCode,uint getCode,uint closeCode,uint valueType,int value,bool valuePresent) {
    string state="unknown";
    if(openCode==0 && getCode==0 && closeCode==0 && valuePresent && valueType==FWP_UINT32 && (value==0||value==1)) state=value==1?"enabled":"disabled";
    string type=valuePresent?valueType.ToString(CultureInfo.InvariantCulture):"null",collect=state=="unknown"?"null":value.ToString(CultureInfo.InvariantCulture);
    return string.Format(CultureInfo.InvariantCulture,"{{\"version\":\"cue-wfp-availability-v1\",\"state\":\"{0}\",\"openCode\":{1},\"getCode\":{2},\"closeCode\":{3},\"valueType\":{4},\"collectNetEvents\":{5}}}",state,openCode,getCode,closeCode,type,collect);
  }

  public static string Query() {
    IntPtr engine=IntPtr.Zero,valuePtr=IntPtr.Zero;uint openCode=0xffffffff,getCode=0xffffffff,closeCode=0xffffffff,valueType=0;int value=0;bool present=false;
    try {
      openCode=FwpmEngineOpen0(null,RPC_C_AUTHN_WINNT,IntPtr.Zero,IntPtr.Zero,out engine);
      if(openCode==0 && engine!=IntPtr.Zero) {
        getCode=FwpmEngineGetOption0(engine,FWPM_ENGINE_COLLECT_NET_EVENTS,out valuePtr);
        if(getCode==0 && valuePtr!=IntPtr.Zero) {
          present=TryDecode(offset=>Marshal.ReadInt32(valuePtr,offset),out valueType,out value);
        }
      }
    } catch { present=false; }
    finally {
      if(valuePtr!=IntPtr.Zero) FwpmFreeMemory0(ref valuePtr);
      if(engine!=IntPtr.Zero) closeCode=FwpmEngineClose0(engine);
    }
    return Format(openCode,getCode,closeCode,valueType,value,present);
  }
}
'@
Add-Type -TypeDefinition $source -Language CSharp
[CueWfpAvailability]::Query()
