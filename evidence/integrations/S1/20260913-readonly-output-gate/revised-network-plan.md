# Revised read-only network evidence plan

Status: docs-only correction to `network-followup.md`. Attempt cap: one documentation correction. No implementation, subscription, audit change, native launch, listener, model, provider, or new connection occurred.

## Correction

WFP net-event headers do not provide a worker PID. A subscription therefore cannot directly bind a drop to PID `65008`. Any worker association derived from a unique AppContainer profile and one-process job interval must be labeled an inference. Missing fields, multiple matching events or processes, PID/profile reuse, collection disabled, subscription failure, or an ambiguous interval remains `unknown`.

## Two independent evidence routes

1. **Optional pre-enabled Security audit route.** Query only existing events 5157/5152. A matching 5157 can use its documented process ID, application path, timestamp, direction, addresses, ports, protocol, filter runtime ID, and layer. Require exact worker PID, sealed executable, outbound TCP, destination `127.0.0.1:48193`, and the launch-to-verified-death interval. First query the current audit state only; never enable or change it. Disabled auditing, no exact event, or 5152 without adequate process/application lineage is unknown.
2. **WFP package route.** Open a read-only filter-engine session, query `FWPM_ENGINE_COLLECT_NET_EVENTS` with `FwpmEngineGetOption0`, and proceed only when its `FWP_UINT32` value is `1`. Subscribe before worker resume with `FwpmNetEventSubscribe3`/`FWPM_NET_EVENT3` on supported systems (Windows 10 1607+); unsubscribe only after verified worker/job death. Do not call `FwpmEngineSetOption0`.

For the WFP route, accept only `FWPM_NET_EVENT_TYPE_CAPABILITY_DROP`. Its `FWPM_NET_EVENT_CAPABILITY_DROP0` must identify the missing AppContainer capability, its filter ID, and `isLoopback=true`. Its `FWPM_NET_EVENT_HEADER3.flags` must include `FWPM_NET_EVENT_FLAG_PACKAGE_ID_SET`, `FWPM_NET_EVENT_FLAG_APP_ID_SET`, IP version/protocol, remote address, and remote port flags before those fields are read. Require:

- `packageSid` equals the newly created unique protected profile SID;
- before resume, derive the expected `FWP_BYTE_BLOB` with documented `FwpmGetAppIdFromFileName0` from the exact held and sealed executable path, copy its canonical bytes into protected observation state, free the API allocation with `FwpmFreeMemory0`, and require the event `appId` blob to match byte-for-byte;
- IPv4/TCP and the controlled endpoint `127.0.0.1:48193` in the correct local/remote fields for the outbound flow;
- subscription is successfully active before resume, and the event timestamp is at or after subscription activation and no later than verified job death;
- exactly one protected profile, one sealed executable, and one process in the job for that interval.

Because the WFP header has no PID, a match supports: “a capability drop for this unique package SID and sealed app during its exclusive one-process interval; inferred worker association.” It must not be reported as an exact PID match.

## Concrete primary interfaces

- [`FWPM_NET_EVENT_HEADER3`](https://learn.microsoft.com/en-us/windows/win32/api/fwpmtypes/ns-fwpmtypes-fwpm_net_event_header3) defines timestamp, endpoint fields, `appId`, `packageSid`, and the presence flags `FWPM_NET_EVENT_FLAG_APP_ID_SET` and `FWPM_NET_EVENT_FLAG_PACKAGE_ID_SET`.
- [`FWPM_NET_EVENT3`](https://learn.microsoft.com/en-us/windows/win32/api/fwpmtypes/ns-fwpmtypes-fwpm_net_event3) carries the header, event type, and `capabilityDrop` union member.
- [`FWPM_NET_EVENT_CAPABILITY_DROP0`](https://learn.microsoft.com/en-us/windows/win32/api/fwpmtypes/ns-fwpmtypes-fwpm_net_event_capability_drop0) carries the missing network capability, filter ID, and loopback boolean.
- [`FwpmNetEventSubscribe3`](https://learn.microsoft.com/en-us/windows/win32/api/fwpmu/nf-fwpmu-fwpmneteventsubscribe3) is the notification API and requires `FWPM_ACTRL_SUBSCRIBE`; failure to acquire it is unknown.
- [`FwpmEngineGetOption0`](https://learn.microsoft.com/en-us/windows/win32/api/fwpmu/nf-fwpmu-fwpmenginegetoption0) reads `FWPM_ENGINE_COLLECT_NET_EVENTS` as `0` or `1`; this plan permits only that state query.
- [`FwpmGetAppIdFromFileName0`](https://learn.microsoft.com/en-us/windows/win32/api/fwpmu/nf-fwpmu-fwpmgetappidfromfilename0) derives the WFP application identifier blob from the exact executable path; its allocation is released with `FwpmFreeMemory0` after protected copying.
- [Security event 5157](https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-10/security/threat-protection/auditing/event-5157) is the separate PID-bearing audit route.

## Bounded proof

The next proof should first use offline synthetic event structures to test every required header flag, exact package SID/app ID/endpoint/time binding, cardinality, collection-disabled behavior, and inference labeling. A later real gate needs separate review and authorization. Neither route changes the existing `ETIMEDOUT` rejection or turns listener `accepted=0` into denial authority.
