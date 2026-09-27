# WFP event diagnostic matcher result

## Focused gate

Command: `node --test scripts/reuse/readonly-wfp-event-evidence.test.mjs`

Result: exit 0 on the final attempt 2 of 2 after independent-review corrections; 6 tests passed, 0 failed, 0 skipped, duration 83.3732 ms.

The cases cover the exact positive inference; disabled collection; subscription timing/lifetime assertions; loss and overflow; protected profile, sealed executable, and job-process cardinality; every required header-presence flag; byte-exact App ID and package SID; IPv4/TCP loopback endpoint; UINT64-bounded FILETIME interval; missing capability, loopback, and UINT64 filter fields; zero/multiple matches; malformed, sparse, oversized, accessor, and hostile proxy values at every nested boundary without invoking their traps; and forbidden PID/admission vocabulary.

## Boundary

This module is pure and offline. It performs no WFP registration or query, does not accept a PID, and returns only `package-drop-inference` or `unknown`. Its positive association text explicitly says the match is inferred from the unique package/application and exclusive one-process interval. No result field grants readiness, permission, acceptance, or qualification.

## Primary sources

- `FWPM_NET_EVENT_HEADER3`: https://learn.microsoft.com/en-us/windows/win32/api/fwpmtypes/ns-fwpmtypes-fwpm_net_event_header3
- `FWPM_NET_EVENT3`: https://learn.microsoft.com/en-us/windows/win32/api/fwpmtypes/ns-fwpmtypes-fwpm_net_event3
- `FWPM_NET_EVENT_CAPABILITY_DROP0`: https://learn.microsoft.com/en-us/windows/win32/api/fwpmtypes/ns-fwpmtypes-fwpm_net_event_capability_drop0
- `FwpmNetEventSubscribe3`: https://learn.microsoft.com/en-us/windows/win32/api/fwpmu/nf-fwpmu-fwpmneteventsubscribe3
- `FwpmEngineGetOption0`: https://learn.microsoft.com/en-us/windows/win32/api/fwpmu/nf-fwpmu-fwpmenginegetoption0
- `FwpmGetAppIdFromFileName0`: https://learn.microsoft.com/en-us/windows/win32/api/fwpmu/nf-fwpmu-fwpmgetappidfromfilename0

## Frozen hashes

- `daa91273fb5fd668bf2e4cf23c9c85607b0d880502ecb020b17f243f5bc4c660  scripts/reuse/readonly-wfp-event-evidence.mjs`
- `7b0546044a2b533c3aef12adefe8a3d99bfec4ae00eafc56a99091c1633d1363  scripts/reuse/readonly-wfp-event-evidence.test.mjs`
- `2c94224e116dd9f8a17680cebab9e722ce78ff2d352cb6d603252b7192fd0b5a  evidence/integrations/S1/20260913-readonly-wfp-event-evidence/PLAN.md`
