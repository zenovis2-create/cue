# Read-only WFP subscription permission diagnostic

2026-09-11. Parent implemented/executed `scripts/reuse/wfp-subscription-preflight.ps1`; `cue_fit` independently reviewed source and the recorded result without repeating the denied operation.

Source SHA-256: `6590ca682461fd9f72c09b1da7662477f6ed98414653c82f68af1e47a17ffcb5`. Matching raw output: `wfp-subscription-preflight.json`.

First and only attempt: engine open 0, `FwpmNetEventSubscribe1` 5 (`ERROR_ACCESS_DENIED`), no subscription handle, engine close 0. The callback never reads its event pointer. No traffic payload, policy/filter/ACL change, elevation or collection-option mutation occurred. The reviewer checked the native subscription struct, P/Invoke signatures, delegate retention and conditional unsubscribe/close. No diagnostic correctness finding.

This checks the distinct subscription right rather than inferring it from the earlier denied collection-option query. Both are unavailable to the current process. It does not establish network blocking or M3 qualification. Official contracts: [subscription structure](https://learn.microsoft.com/en-us/windows/win32/api/fwpmtypes/ns-fwpmtypes-fwpm_net_event_subscription0), [subscribe access requirement](https://learn.microsoft.com/en-us/windows/win32/api/fwpmu/nf-fwpmu-fwpmneteventsubscribe1), [unsubscribe/close semantics](https://learn.microsoft.com/en-us/windows/win32/api/fwpmu/nf-fwpmu-fwpmneteventunsubscribe0).
