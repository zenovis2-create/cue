# S4 Unit 1 execution progress

Date: 2026-09-12

The targeted driver gate passed forced host-selected switch, authoritative quota not-before dormancy/resume, and revision 1 claim, exact stage binding, terminal finish, completed revision-step state, and acceptance.

The initial combined baseline ran build, the seven required Vitest files, and TypeScript. Build and TypeScript passed; 81/90 tests passed. All nine failures were the stale retry-backend requirements fixture rejecting the newly required frozen evidence policy.

Correction pass 1 updated that fixture only. The expanded combined gate (including S3 handoff integrity and the migration-035 request/checkpoint suite) passed 98/103 tests. Five retry-backend failures remained: one legacy schema lookup and four boolean-only terminal fixtures rejected by the S3 integrity boundary.

Correction pass 2 added the recovery schema guard, repaired the in-process retry fixture with launch intent, durable identity, artifact, and handoff evidence, and moved the trusted clock observation ahead of final terminal, lease, attempt-count, and budget reads. The final combined gate ran build, TypeScript, ten test files including generated revision-1 acceptance, S3, and migration-035: build and TypeScript passed; 108/111 tests passed. The remaining failures were:

- generated revision-1 acceptance: `generated_checker_response_missing` because generated-output remains bound to the original target digest while the checker requests the exact revision-1 stage digest;
- legacy retry migration: `states()` queries absent `orchestration_handoff` after the recovery-scope guard;
- concurrent retry fixture: the final run reported `database is locked` (the preceding focused run deterministically reported both worker hosts missing trusted artifact resolution as `retry_task_not_ready`).

`git diff --check` passed for the execution-owned files. Migration 036 source and built SHA-256 both equal `82FFCA12C48C65D17D5A48DEAB7A7377A2877A868F147817CC021AF6D8809826`. A fresh built ledger reported `integrity_check=ok`, `foreign_keys=1`, and an empty `foreign_key_check`.

No provider, model, native helper, Electron process, network request, paid call, filesystem restoration, or Unit 2 behavior was run.
