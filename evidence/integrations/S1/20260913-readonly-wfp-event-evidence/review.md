# Independent WFP event diagnostic matcher review

Verdict: **PASS for the pure diagnostic matcher**

The matcher accepts one exact `FWPM_NET_EVENT_TYPE_CAPABILITY_DROP` shape. It requires all presence flags for the header fields it uses, byte-exact protected application ID, exact package SID, IPv4/TCP loopback target and port, an event timestamp within the asserted subscription/death interval, the expected missing capability, positive `UINT64` filter ID, and `isLoopback=true`. Every context and event FILETIME is bounded to `UINT64`.

The field model agrees with Microsoft’s primary definitions: [`FWPM_NET_EVENT_HEADER3`](https://learn.microsoft.com/en-us/windows/win32/api/fwpmtypes/ns-fwpmtypes-fwpm_net_event_header3) defines the timestamp, presence flags, IP/protocol/address/port, app-ID blob, and package SID; [`FWPM_NET_EVENT3`](https://learn.microsoft.com/en-us/windows/win32/api/fwpmtypes/ns-fwpmtypes-fwpm_net_event3) selects `capabilityDrop` by event type; and [`FWPM_NET_EVENT_CAPABILITY_DROP0`](https://learn.microsoft.com/en-us/windows/win32/api/fwpmtypes/ns-fwpmtypes-fwpm_net_event_capability_drop0) defines the missing capability, `UINT64` filter ID, and loopback boolean. [`FwpmGetAppIdFromFileName0`](https://learn.microsoft.com/en-us/windows/win32/api/fwpmu/nf-fwpmu-fwpmgetappidfromfilename0) returns the application identifier as an `FWP_BYTE_BLOB`, supporting exact byte comparison rather than path-string inference.

Collection disabled, inactive or shortened subscription, loss, overflow, nonexclusive protected profile/executable/job-process counts, missing flags, tuple drift, interval drift, and zero or multiple matches all return `unknown`. This matches the separation between the engine collection option documented by [`FwpmEngineGetOption0`](https://learn.microsoft.com/en-us/windows/win32/api/fwpmu/nf-fwpmu-fwpmenginegetoption0) and event delivery subscriptions documented by [`FwpmNetEventSubscribe3`](https://learn.microsoft.com/en-us/windows/win32/api/fwpmu/nf-fwpmu-fwpmneteventsubscribe3).

Input is bounded to 64 events, 4,096 app-ID bytes, 512-character strings, small fixed records, and a 16-entry flag array. Accessors are rejected through descriptors. Node's proxy detection precedes prototype or descriptor inspection for records and arrays; the regression checks top-level and nested proxy locations and proves their traps are not invoked. Sparse, extra-field, oversized, malformed, and impossible `UINT64` timestamp inputs fail closed.

The sole positive vocabulary is `package-drop-inference` with an explicitly inferred package/application/exclusive-interval association. The function accepts no PID and returns no PID, readiness, permission, acceptance, or qualification field. Caller assertions such as collection and cardinality booleans constrain this diagnostic match but do not become independent authority.

## Independent gate

From `C:\Users\User\cue`:

```text
node --test scripts/reuse/readonly-wfp-event-evidence.test.mjs
```

Result: exit 0; **6 tests passed, 0 failed**, 81.9352 ms. This was a pure Node test. No WFP query/subscription, OS/native helper, model, network probe, or build ran.

## Frozen hashes

- `scripts/reuse/readonly-wfp-event-evidence.mjs`: `DAA91273FB5FD668BF2E4CF23C9C85607B0D880502ECB020B17F243F5BC4C660`
- `scripts/reuse/readonly-wfp-event-evidence.test.mjs`: `7B0546044A2B533C3AEF12ADEFE8A3D99BFEC4AE00EAFC56A99091C1633D1363`
- `evidence/integrations/S1/20260913-readonly-wfp-event-evidence/PLAN.md`: `2C94224E116DD9F8A17680CEBAB9E722CE78FF2D352CB6D603252B7192FD0B5A`
- `evidence/integrations/S1/20260913-readonly-wfp-event-evidence/RESULT.md`: `6BBAE5FDC5C44EEE2770A5DD7B8DAF054D83D7E83902EBA29E5E26AEB84B3C19`

No blocker remains within this synthetic diagnostic-matcher scope.
