# Frozen grouped regression — 2026-09-26

## Complete inventory, failing baseline (not all green)

All **308 test files** were exercised in **12 sequential groups** against the same source and compiled-artifact snapshot:

- **2,241 passed / 6 failed / 10 skipped** tests.
- **304 passing / 4 failing** files.
- No missing, duplicate or unexpected file paths in the JSON reports.
- Every group exited and wrote its report; no outer timeout or source drift.
- Source digest: `222156dc937d170ae115e4196a8d9a75ed9d34efe64b7d63da2a8c5bbafecf38`.
- Execution: 23:08:36–23:41:01 KST. Group durations are measured execution durations, not product performance evidence.
- Authoritative reconciliation: `audit-1790433662167.json`; allocation: `manifest.json`; frozen source/compiled hashes: `source.json`.

This is **complete grouped file coverage**, not code-coverage instrumentation or a successful single root `npm test`. The 10 skips retain normal suite conditions; no new skips or test timeout increases were introduced. The earlier single-root timeout remains in its own evidence directory.

## Failure classification and subsequent corrections

The complete baseline above remains immutable. Corrections below changed the source generation and were verified separately; do not replace its six failures with the later focused passes.

### 1. Codex pinned binary mismatch — unresolved environmental prerequisite

`group-03`: `p10c-manifest.test.ts` refuses before process launch because the installed binary no longer matches the audited 0.154.0 pin.

Read-only measurement (`correction/codex-pin-observation.json`):

- Installed npm package version: **0.157.0**.
- Observed executable SHA-256: `ed1c7b36e44536809c868864c833af8a857f56599a7a7fe23b908a1ba1093b1f`.
- Required SHA-256: `be96b992178b1e467c225800da0d65f2c86d5eba1ef0b14632f65db381cbdfde`.

No binary was downloaded, replaced, executed for this inspection, or newly trusted. Neither the hash pin nor the test was relaxed/skipped. A hash mismatch establishes drift, not maliciousness. Restoring an independently verified pinned artifact or separately reviewing/qualifying the new version is a prerequisite to clearing this failure.

### 2. Unapproved execution expectation — test-only correction

`group-07`: `p9.test.ts` expected the old `approval required` error. Current session-epoch enforcement rejects earlier with `approval_session_unavailable`. The failed assertion also bypassed fixture closing and produced EPERM on deletion.

Corrected the expected code, asserted zero execution/session rows and unchanged `prepared` state, and guaranteed awaited Core close in `finally`. No product safety behavior was changed for this failure.

### 3. Rejected goal proposal consumed approval — actual product correction

`group-09`: the handoff fixture's cleanup assertion hid its original failure. Moving the cleanup expectation to the successful test path exposed `approval_session_unavailable` at the second execution attempt (`correction/handoff-red.log`: 1 failed / 1 passed).

Root cause: `execute()` committed `approved` → `executing` before `owner.activate()` rejected the tampered proposal. Restoring the exact proposal bytes could not use the still-unexecuted approval because it had already been consumed.

Minimal fix in `app/core.mjs`: call `owner?.assertGoalProposal(runId)` inside the same immediate transaction as the approval transition and planning-source check. Invalid proposal data now rolls back the claim before activation. Existing activation validation remains intact.

Strengthened the fixture to require `approval_state:'approved'`, zero execution events and zero orchestration attempts after refusal, then a successful handoff of the restored exact pinned proposal. The eventual synthetic failed launch still must retain unresolved cleanup; no provider was started. Cleanup assertions no longer mask earlier body failures.

### 4. Quarantined daemon approval expectations — test-only correction (3 cases)

`group-11`: `p11-writer-corrective.test.ts` tried to approve another task after daemon quarantine. Session-epoch enforcement now refuses that approval before the later execute guard.

The three termination variants now explicitly require approval refusal, execute refusal, zero new approval/execution rows and continued ownership of the original writer lease. No quarantine or lease check was weakened.

## Correction verification

- `correction/build.log`: build exit 0.
- `correction/focused.log` / `.exit`: **8 files / 67 tests passed, exit 0**, 34.60 seconds, including all five corrected failing cases and related approval/planning/driver/workspace tests.
- `correction/preimages/` and `correction/change.patch`: exact before-images and scoped changes. Product change is one additional preflight call in `app/core.mjs`; three test files changed.
- `correction/source-final.json` / `changed-paths.json`: only Core, those three tests and their rebuilt compiled test outputs differ from the frozen baseline.
- Targeted `git diff --check`: exit 0; CRLF-normalization warnings only.
- One correction hypothesis per approval-fixture family; handoff investigation first exposed the masked primary failure, then used one atomic-preflight correction. No speculative retry loop.

Previously timing-sensitive native identity and writer-lifecycle tests passed in groups 11 and 7 respectively without changing their timeouts. This does not establish that all timing variability is fixed.

## Boundaries and next work

- The corrected generation has focused validation only, **not** a new complete grouped pass or root pass. One known pin prerequisite remains blocked; original baseline logs remain unchanged.
- No external provider requests, model inference, checkpoint downloads, new qualification or billing claims. Local fake HTTP/native fixture paths remain distinct from live provider evidence.
- No global process cleanup, commits or publication. Test-created failed fixture directories may remain; no blanket cleanup-complete assertion is made.
- Next: resolve the pinned-toolchain prerequisite through an explicitly reviewed artifact/version choice, then freeze a new generation and repeat the complete grouped inventory. Actual input consumption, full measurement/accounting, native user acceptance and other open gates are unaffected.
