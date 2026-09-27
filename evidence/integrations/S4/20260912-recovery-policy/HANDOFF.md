# S4 Unit 1 partial handoff

Date: 2026-09-12

Status: unfinished initial implementation. No correction pass was used and there is no independent PASS. Product ownership has transferred to `/root/sol_s4_acceptance_impl` and `/root/sol_s4_execution_impl`.

## Partial-state SHA-256

These hashes were measured at this handoff. Concurrent continuation work may change them after this record.

```text
edbf687baceb9c158b2af48dc4f5aaf97d82a41c0ffc5d040417d0e679106f84  daemon/migrations/036_s4_recovery_revision.sql
0c50582c1767649aab15a218e36ce69dfb302a5d49cf2e2f7e9b4fb7c52d4b87  daemon/src/ledger.ts
81fd299078cc3cee644f73a52bd5328ec8a99d29eea5d6a28a1de11a8d4f440c  daemon/scripts/copy-assets.mjs
5a01e8147befc5aa34d7a82d2faac9c87b624222d2b0460b7111b0ea5c67f8d6  daemon/src/orchestration/recovery-policy.ts
17f06a53b11e70cee27f85cc413237c317bb2db0a0e1b3a26fea1002866deaad  daemon/src/orchestration/store.ts
fcc3ad531b5aad1a4ee2989f982da663fdbcc6c0a975dfff053baddbc9261c0b  daemon/src/orchestration/engine.ts
e180cad1f416ae977d7751a2c13917bc1c8611fba595655166254dd2514393d2  daemon/src/orchestration/stage-envelope.ts
82ab0a3a78e8d5181588525429dc5436877d8b49e04ea4db50732e7eba883121  app/orchestration-driver.mjs
7fd8fd6606fe4a32bdbfd0f78500a8a3893f9191b69eda179ae90a50cda12647  app/orchestration-driver.d.mts
ee60acd13598dd7fcf386ce05c496bc87884a80ff0a08c18d6ab269df9ea666f  daemon/test/integration-recovery-policy.test.ts
21f0f0a22123936272d379618ef0a53fc66cf341ea059a188be8e728d80e3bbb  daemon/test/integration-evidence-policy.test.ts
```

`daemon/src/verification/evidence-policy.ts` was absent when hashes were collected because the acceptance continuation owner had already begun work; no reliable handoff hash is recorded for it.

## Current partial interfaces

- `ClaimRequest` accepts the explicit pair `revision?: number` and `planDigest?: string`.
- `store.readinessRevision(runId, revision, planDigest)` loads exactly that revision tuple.
- `store.claim(...)` and `store.claimRetry(...)` persist `orchestration_attempt_revision` when the tuple is supplied.
- `StageEnvelopeRequest` accepts `revision?: number` and `planDigest?: string`; `StageEnvelopeBinding.revision` reports the selected ordinal.
- `EngineRequest` carries the same tuple and rejects a plan whose digest differs.
- `createRecoveryPolicyStore(db)` exposes `registerScope`, `observeFailure`, `recordDecision`, `appendRevision`, and `readRevision`.
- `driver.recover(input)` currently records an observation and decision and activates an appended replan revision.

Recommended overlap boundary: acceptance should consume a single immutable `{ revision, planDigest }` context passed by the driver and use it for history/finalization. Execution should own how that tuple is selected and persisted. Acceptance must not query `MAX(revision)`; execution must not decide evidence truth.

## Measured gates

- `npm run build`: PASS before the final schema-detection patch.
- `npx --no-install tsc -p tsconfig.json --noEmit`: PASS before the final schema-detection patch.
- New recovery/evidence policy tests plus full driver: 38/38 PASS.
- Full driver alone: 33/33 PASS.
- Temporary ledger: `PRAGMA integrity_check = ok`; `PRAGMA foreign_key_check` returned zero rows.
- Source/deployed `036` matched at `edbf687baceb9c158b2af48dc4f5aaf97d82a41c0ffc5d040417d0e679106f84` before continuation work.
- Required seven-file focused gate: 58 PASS / 29 FAIL. Acceptance fixtures failed at `task_not_ready` or `retry_previous_not_clean_failed`; retry fixtures also failed on missing current S3 terminal lineage. One legacy retry-helper failure was introduced by querying `orchestration_recovery_scope` before `036` existed.
- The last patch added `recoveryInstalled()` before that query. This exact patch was not retested.

## Required continuation

Acceptance owner `/root/sol_s4_acceptance_impl`:

- Bind evidence policy before approval and invoke it during final acceptance.
- Make acceptance/history consume the exact active revision tuple and preserve original requirement, policy, envelope, checker, target, and parameter bindings.
- Repair only legitimate test fixtures with current S3 handoff/session/selection lineage.
- Coordinate any necessary changes to shared migration `036`.

Execution owner `/root/sol_s4_execution_impl`:

- Replace `driver.recover` caller-supplied observation/facts/requested action with trusted host observations and durable database-derived facts. The current API is not a production authority boundary.
- Enforce switch candidate selection and durable decision-to-attempt linkage.
- Complete retry/switch/replan/stop execution, exact replay, stale/fork rejection, cumulative counts/budget/deadline checks, and a real revision-1 claim/stage/finish test.
- Verify the final schema-detection patch and all required gates.

The five initial module tests prove only pure policy behavior; they do not prove production authority, driver disposition execution, or acceptance integration.
