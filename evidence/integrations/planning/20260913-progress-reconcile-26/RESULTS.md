# Integration documentation reconciliation 26

Date: 2026-09-13

## Reviewed evidence

- [WFP lifecycle independent review](../../S1/20260913-readonly-wfp-lifecycle/review.md), SHA-256 `4ECB09B6282B49D68FB8FEEE8998E6FAE10D19A2567356B4580D83ACB3250964`: 17/17 PASS for the offline injected subscription/start/death-observation lifecycle seam. The production before-resume/job-through-death bridge, live WFP/worker execution, and OS-backed death remain open.
- [Readonly terminal-wait independent review](../../S1/20260913-readonly-terminal-wait/review.md), SHA-256 `8615D99841BD011D2BE5D7A5E9B7E06AFADA4BE7EAF73E6EE9F89D2355F2DE70`: six focused tests PASS and maker build0. Cancellation, timeout, and parent death return normally only after exact process-handle `WAIT_OBJECT_0`; this does not prove whole-job death.
- [Existing-generation static integrity review](../../S7/20260912-current-source/recapture-review-20260913-terminal-wait.md), SHA-256 `0EB270164839B1006C5744A0EC3E213615F4DB63D8296E1F9560C418EE86ACA6`: generation `097ef304...` remains current for 164 scoped JS/TS app/daemon files, 371 declared edges, and five artifacts. The changed PowerShell launcher is outside that inventory.
- [Generation attempt receipt](../../S7/20260912-current-source/terminal-wait-generation-attempt.md), SHA-256 `7EAED8299A231D2BFEF3613AEE16715D5FA19F14A632B8D96CA445A254DB3C57`: the attempted duplicate publication failed at rename with `EPERM`; staging was retained and generator idempotency remains unresolved.

The prior output-gate network timeout and access-denied WFP option query remain unqualified. No live WFP query/subscription, worker, policy/setting, model, provider, or Electron action was performed for this reconciliation. The historical full suite remains historical, and the `usageLimited` GOAL remains unfinished.

## Documentation gate

- [Done contract](DONE-CONTRACT.md), SHA-256 `7A51D7020B7514E910A5B91D74C80002A39534DF2CA0D8C602FA978FD4D301DF`.
- Scoped whitespace diff: PASS.
- Four-document local Markdown references: 365 checked, 0 missing.
- `docs/INTEGRATION_SPEC.md`: `EDD8E955E9DA0FED3074B92D7AFD443D6AF9ECE5D1185D76EC5AB6BE149736CD`
- `docs/INTEGRATION_CHECKLIST.md`: `1BB62400C93BB7B6318A62366F128D926368927B724996AACCF8938261C89DAA`
- `docs/INTEGRATION_PROGRESS.md`: `B05A35EC1F7D900B1A919D8BB11A80485CC5A0342035D3FF0E616B74DD3EAC1A`
- `docs/integration/LOOP.md`: `C8FD9C8B189DC1BDC199776C22E872B06086970405141D0D9BCE6B8620D4119C`
