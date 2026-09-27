# Read-only native preflight. No event enumeration/subscription or policy mutation.
# Microsoft declarations checked 2026-09-11:
# https://learn.microsoft.com/en-us/windows/win32/api/fwpmu/nf-fwpmu-fwpmengineopen0
# https://learn.microsoft.com/en-us/windows/win32/api/fwpmu/nf-fwpmu-fwpmenginegetoption0
# https://learn.microsoft.com/en-us/windows/win32/api/fwpmtypes/ne-fwpmtypes-fwpm_engine_option
# https://learn.microsoft.com/en-us/windows/win32/api/fwptypes/ns-fwptypes-fwp_value0
# https://learn.microsoft.com/en-us/windows/win32/api/fwptypes/ne-fwptypes-fwp_data_type
# https://learn.microsoft.com/en-us/windows/win32/api/fwpmu/nf-fwpmu-fwpmfreememory0
# https://learn.microsoft.com/en-us/windows/win32/api/fwpmu/nf-fwpmu-fwpmengineclose0
$ErrorActionPreference = 'Stop'
if (-not ('CueWfpObservationPreflight' -as [type])) {
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class CueWfpObservationPreflight {
    [DllImport("fwpuclnt.dll", ExactSpelling=true, CharSet=CharSet.Unicode)]
    static extern uint FwpmEngineOpen0(string serverName, uint authnService, IntPtr authIdentity, IntPtr session, out IntPtr engineHandle);
    [DllImport("fwpuclnt.dll", ExactSpelling=true)]
    static extern uint FwpmEngineGetOption0(IntPtr engineHandle, uint option, out IntPtr value);
    [DllImport("fwpuclnt.dll", ExactSpelling=true)]
    static extern void FwpmFreeMemory0(ref IntPtr memory);
    [DllImport("fwpuclnt.dll", ExactSpelling=true)]
    static extern uint FwpmEngineClose0(IntPtr engineHandle);
    public sealed class Result {
        public string status = "unavailable";
        public uint? openError, queryError, closeError;
        public bool? collectionEnabled;
        public string subscriptionStatus = "not_attempted";
    }
    public static Result Read() {
        var result = new Result();
        IntPtr engine = IntPtr.Zero, value = IntPtr.Zero;
        try {
            result.openError = FwpmEngineOpen0(null, 10 /* RPC_C_AUTHN_WINNT */, IntPtr.Zero, IntPtr.Zero, out engine);
            if (result.openError != 0) { result.status = result.openError == 5 ? "access_denied" : "unavailable"; return result; }
            result.queryError = FwpmEngineGetOption0(engine, 0 /* FWPM_ENGINE_COLLECT_NET_EVENTS */, out value);
            if (result.queryError != 0) { result.status = result.queryError == 5 ? "access_denied" : "unavailable"; return result; }
            // FWP_VALUE0: 32-bit enum then union of integers/pointers. Native
            // union alignment is pointer-sized (UINT64/double members are pointers).
            if (value == IntPtr.Zero || Marshal.ReadInt32(value) != 3 /* FWP_UINT32 */) { result.status = "invalid_native_value"; return result; }
            int enabled = Marshal.ReadInt32(value, IntPtr.Size == 8 ? 8 : 4);
            if (enabled != 0 && enabled != 1) { result.status = "invalid_native_value"; return result; }
            result.collectionEnabled = enabled == 1;
            result.status = "available";
            return result;
        } finally {
            try { if (value != IntPtr.Zero) FwpmFreeMemory0(ref value); }
            finally { if (engine != IntPtr.Zero) result.closeError = FwpmEngineClose0(engine); }
        }
    }
}
'@
}
[CueWfpObservationPreflight]::Read() | ConvertTo-Json
