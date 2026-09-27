# WFP event diagnostic matcher

Status: maker plan. This unit is an offline, pure matcher; it does not register a WFP subscription or grant launch, readiness, permission, acceptance, or qualification authority.

## Done contract

- Command: `node --test scripts/reuse/readonly-wfp-event-evidence.test.mjs`
- Attempt cap: 2 measured test runs. Every pass runs the exact command above.
- Done means the command exits 0 and covers one exact package-drop inference plus collection/subscription/loss/cardinality, required-header-flag, package SID, app-ID byte, IPv4/TCP endpoint, timestamp, capability-drop, loopback, filter-ID, malformed/oversize, hostile proxy/getter, and multiple-match unknown outcomes.
- If a pass fails, retry once only with a new source-supported hypothesis. If the second pass fails, stop and report the failing assertion and hypothesis.

## Contract

The matcher accepts only bounded plain records and arrays. Protected collector assertions must say collection was enabled, subscription was active before worker resume and remained active through verified job death, no loss or overflow occurred, and exactly one protected profile, sealed executable, and job process occupied the interval. Event fields mirror `FWPM_NET_EVENT3`, `FWPM_NET_EVENT_HEADER3`, and `FWPM_NET_EVENT_CAPABILITY_DROP0`. Required header flags guard every field used in the match. Package SID and application-ID bytes compare exactly; the latter is the protected copy produced earlier from `FwpmGetAppIdFromFileName0`.

The sole positive result kind is `package-drop-inference`, explicitly describing an inferred worker association during an exclusive one-process interval. Every ambiguity returns `unknown`. The result contains no PID claim or authority flag.

## Primary references

- [FWPM_NET_EVENT_HEADER3](https://learn.microsoft.com/en-us/windows/win32/api/fwpmtypes/ns-fwpmtypes-fwpm_net_event_header3)
- [FWPM_NET_EVENT3](https://learn.microsoft.com/en-us/windows/win32/api/fwpmtypes/ns-fwpmtypes-fwpm_net_event3)
- [FWPM_NET_EVENT_CAPABILITY_DROP0](https://learn.microsoft.com/en-us/windows/win32/api/fwpmtypes/ns-fwpmtypes-fwpm_net_event_capability_drop0)
- [FwpmNetEventSubscribe3](https://learn.microsoft.com/en-us/windows/win32/api/fwpmu/nf-fwpmu-fwpmneteventsubscribe3)
- [FwpmEngineGetOption0](https://learn.microsoft.com/en-us/windows/win32/api/fwpmu/nf-fwpmu-fwpmenginegetoption0)
- [FwpmGetAppIdFromFileName0](https://learn.microsoft.com/en-us/windows/win32/api/fwpmu/nf-fwpmu-fwpmgetappidfromfilename0)
