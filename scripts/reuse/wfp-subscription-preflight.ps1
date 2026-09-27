# Read-only permission probe: no policy options, filters, ACLs or traffic payloads.
# Contracts: Microsoft Learn fwpmu FwpmNetEventSubscribe1/FwpmNetEventUnsubscribe0,
# fwpmtypes FWPM_NET_EVENT_SUBSCRIPTION0. Callback intentionally never reads data.
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class CueWfpSubscriptionPreflight {
  [StructLayout(LayoutKind.Sequential)] struct Subscription { public IntPtr Template; public uint Flags; public Guid SessionKey; }
  [UnmanagedFunctionPointer(CallingConvention.Winapi)] delegate void Callback(IntPtr context, IntPtr netEvent);
  [DllImport("fwpuclnt.dll", CharSet=CharSet.Unicode)] static extern uint FwpmEngineOpen0(string server, uint auth, IntPtr identity, IntPtr session, out IntPtr handle);
  [DllImport("fwpuclnt.dll")] static extern uint FwpmEngineClose0(IntPtr handle);
  [DllImport("fwpuclnt.dll")] static extern uint FwpmNetEventSubscribe1(IntPtr engine, ref Subscription subscription, Callback callback, IntPtr context, out IntPtr events);
  [DllImport("fwpuclnt.dll")] static extern uint FwpmNetEventUnsubscribe0(IntPtr engine, IntPtr events);
  public sealed class Result {
    public uint? OpenCode { get; set; } public uint? SubscribeCode { get; set; }
    public uint? UnsubscribeCode { get; set; } public uint? CloseCode { get; set; }
    public bool EventPayloadRead { get { return false; } }
    public bool PolicyChanged { get { return false; } }
    public string Qualification { get { return "unknown"; } }
  }
  public static Result Run() {
    var result = new Result(); IntPtr engine = IntPtr.Zero, events = IntPtr.Zero;
    Callback ignore = delegate(IntPtr context, IntPtr data) {};
    try {
      result.OpenCode = FwpmEngineOpen0(null, 10, IntPtr.Zero, IntPtr.Zero, out engine);
      if (result.OpenCode != 0) return result;
      var subscription = new Subscription();
      result.SubscribeCode = FwpmNetEventSubscribe1(engine, ref subscription, ignore, IntPtr.Zero, out events);
      return result;
    } finally {
      if (events != IntPtr.Zero) result.UnsubscribeCode = FwpmNetEventUnsubscribe0(engine, events);
      if (engine != IntPtr.Zero) result.CloseCode = FwpmEngineClose0(engine);
      GC.KeepAlive(ignore);
    }
  }
}
'@
[CueWfpSubscriptionPreflight]::Run() | ConvertTo-Json
