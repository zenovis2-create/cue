# Independent native WFP collector review

Status: **PASS for the x64 diagnostic collector primitive.** No live WFP query/subscription, network connection, worker, profile, policy change, model, or provider action occurred.

## Frozen artifacts

- Collector C#: `64124E666B773D7036DFE2F35FFE373BC02A28EC472A2D9756297A40089D5B61`
- PowerShell wrapper: `F9AB6527918EEEAD39BFEE85FDAD325260DBB391E80A28E92B1C3E0F447314F5`
- Injected-native test: `A2018C6BABDD0007B496B256A72B62254B758A30758B2ABC795E129188725FF3`
- Done contract: `291ADED231CC74AE4684BF4B010FDBE1D99682A95332DDA0066570C9E4A5EAC5`
- Frozen native SDK layout output: `ED519D1B30E7CA6172EB0DB8059D5BAA16C653C1CF4B9F341A0E371FEF93EF1`

## ABI and decoding

- The implementation correctly pairs `FwpmNetEventSubscribe2`/callback2 with `FWPM_NET_EVENT3` and Header3. It does not use the incompatible Subscribe3/Event4 pairing from the historical plan.
- Managed x64 layouts match the Windows SDK 10.0.26100 probe: Header3 size 136 with appId offset 64 and packageSid 96; Event3 size 152 with type 136 and detail 144; capability-drop size 24 with filterId 8 and BOOL loopback 16; subscription size 32 with flags 8 and sessionKey 12; FWP_VALUE0 size 16 with union offset 8.
- Required flag constants and capability-drop event value match the installed SDK. Borrowed event, blob, SID, and detail pointers are decoded and copied only inside the callback. Copied events retain unsigned FILETIME bits, flags, IP version/protocol, raw remote address/port, observed package SID, cloned app-ID bytes, capability, filter ID, and loopback.
- WFP IPv4 uses host-order `FWP_UINT32`. The collector matches loopback as `0x7f000001` and rejects the reversed little-endian memory value `0x0100007f`. Remote address remains a raw uint in the DTO; the port remains the API's numeric field without an unsupported byte-order claim.

## Bounds and lifecycle

- Requests are x64-only, fixed to port 48193, duration 1–5000 ms, bounded local-drive executable path, and bounded AppContainer SID. Invalid requests make zero native calls. All native status fields begin at `uint.MaxValue`, so unattempted operations cannot look successful.
- Disabled/error/wrong collection state returns unknown without app-ID lookup or subscription. App-ID allocation and callback app-ID copies are bounded to 4096 bytes. Collection is capped at 64 events and five seconds; overflow or decode ambiguity remains unknown.
- A process-wide lock allows one active collector. Nested/concurrent collection returns unknown without opening WFP. Poisoned state rejects future collection.
- Successful cleanup requires a proven unsubscribe and engine close. Nonzero or thrown unsubscribe quarantines the delegate, native interface, engine, app allocation, and subscription for process lifetime without free/close. Wait failure attempts unsubscribe; only proven success permits cleanup. Nonzero or thrown engine close and free failure also poison/quarantine retained state. A nonzero close handle is not discarded.
- The returned state is only `captured` or `unknown`. Captured means bounded collection completed and cleaned up; it is not a PID match, one-process inference, permission result, network-denial conclusion, readiness result, or acceptance authority.

## Independent execution

- `node --test scripts/reuse/readonly-wfp-collector.test.mjs`: **12/12 PASS**, exit 0.
- `node --check scripts/reuse/readonly-wfp-collector.test.mjs`: PASS.

The tests compile the exact production C# with an injected `IWfpNative` implementation and exercise the real `Collect` control flow: disabled/error no-subscribe, bounds and sentinels, 64-event overflow, callback copy path, active guard, wait/unsubscribe failures, close/free exceptions, nonzero-close quarantine, future poison rejection, x64 SDK layout comparison, and host-order IPv4 positive/reversed-negative behavior.

This primitive is ready for a separately reviewed host integration or bounded availability-aware experiment. A future host must supply independently protected held-executable, exact profile SID, job/process interval, and time bounds before the normalized events can support the package-based inference described in the revised plan.
