# S4 Unit 2 production wiring plan

Date: 2026-09-12

This plan wires migration `037_s4_change_recovery.sql` and the new change-record, held-recovery, and integration-verification modules without changing launch authority or permitting automatic recovery execution.

## Approved filesystem targets

The current stage envelope approves a worktree and action classes, while requirement `targetIds` are logical evidence identities. Neither is an approved relative filesystem path. Migration 037 therefore adds immutable `change_target_contract` rows keyed by run, task, and target ID. The host must register each normalized relative path and backup cap before approval and before any attempt exists. `captureChangeSet` requires the launch target list to exactly equal that frozen task contract and rejects aliases, traversal, absolute paths, ADS/device names, hard links, and link/reparse ancestors.

Model-producer, verifier, planner, and checker stages have no filesystem target contract and must not call `captureChangeSet`; their stage envelope remains read-only with no write actions. An implementation stage with write authority must have at least one frozen target row. A missing contract blocks launch rather than treating an empty inventory as success.

## Prelaunch boundary

The minimal hook is `EngineHost.recordLaunchIntent` in `app/orchestration-driver.mjs`, called inside the existing immediate transaction after claim, budget reservation, stage-envelope binding, activity journal, and selection record, and before the first await in `createEngineLifecycle` invokes `runtime.start`.

For an implementation task only, the hook should:

1. persist the existing S3 launch intent;
2. read the already-bound stage envelope and the immutable `change_target_contract` rows;
3. call `captureChangeSet` synchronously using the bound stage worktree, envelope hash, attempt ID, exact target paths, and frozen limits;
4. return `undefined` as today.

The module's nested better-sqlite3 transaction runs as a savepoint when the engine transaction is already active. Any scan, lineage, lease, hash, or target error escapes the hook and rolls back the outer claim/reservation/stage/intent/change-set unit. Replay reads the existing change set and must require exact payload equality; it must never rescan and silently replace the preimage. A direct test should assert `db.inTransaction` inside the hook and zero durable claim/reservation/intent/change rows after an injected capture failure.

No model/checker launch enters this hook's filesystem branch. External effects use `recordExternalEffectIntent` before dispatch in the adapter-specific dispatch transaction; committing an idempotency key is an intent record, not permission to send twice.

## Startup and held reconciliation

`daemon/src/recovery.ts` should replace the orchestration-attempt portion of the legacy Git-only path with these ordered operations:

1. create one `held_recovery` row for each interrupted attempt before process handling;
2. retain its exact workspace writer lease;
3. run the existing installation/native identity and residue observer;
4. after confirmed process death and cleanup, call `observeChangeSet` through the same safe resolver;
5. call registered authoritative read-only external observers using stored operation/account/resource/idempotency identity;
6. call `reconcileHeldRecovery`.

The API has no executor, start, resume, selection, budget reservation, restore, resend, or wait-response callback. Missing observers, observer errors, unknown/conflicting external state, incomplete change observations, missing handoff, or unknown cleanup leave the CAS state at `held`. The final reconciliation transaction rereads attempt cleanup/state, every target observation, every external observation, handoff existence, the current case revision, and final seal after asynchronous observers return. Two connections can advance revision zero only once.

`restoreStoppedChangeSet` remains a separate explicit operation after a Unit 1 `stop` decision and reacquisition of the same canonical writer lease. It requires an OS adapter with atomic `replaceIfExact` and `removeIfExact` semantics. Without that compare-and-replace proof it returns `atomic-race-closure-unsupported`; a Node stat/hash followed by rename is insufficient to close the Windows swap race. Conflict leaves the case held.

## Integration verification and acceptance

Current status: de-scoped to read-only groundwork after independent review. Migration 037 rejects every `pass` with `integration pass authority not wired`, and `inspectIntegrationVerification` can only return `unknown` plus ledger-derived blockers. It accepts no observer boolean and writes no result. The production steps below are required before removing that fail-closed trigger.

`createAcceptanceVerifier.finalize` owns the accepted evaluation object and exact evaluation ID. Immediately after it acquires the writer lease and revalidates the artifact manifest, but before inserting `acceptance_final` or completing the task, it should call `verifyIntegration` with:

- the exact terminal producer/verifier attempt being consumed;
- the owned acceptance evaluation ID;
- the explicit current revision and plan digest already selected by `state`;
- a registered read-only observer that recomputes each latest change observation under the lease.

The future verifier must read the ledger facts and derive its verdict; callers provide identifiers, never verdict or current-state booleans. It must match the acceptance payload's run and revision, require all required outcomes pass, exact terminal handoff and launch identity for every consumed producer/verifier, cleanup, original scope and cumulative limits, current revision, a nonempty complete change set, no open held case, settled nonconflicting external effects, registered checker/current-state observer identities, and no activity after a policy-violation stop. It stores one immutable result. Acceptance consumes only that persisted `pass`; `fail` and `unknown` remain blocked and inspectable.

The current groundwork deliberately returns/records unknown where a current filesystem observer is absent. Wiring must not substitute a cached observation or newest run-wide acceptance row. The observer must fresh-open/re-resolve each target and compare object kind, canonical parent, identity, byte length, SHA-256, and exact bytes when backed up.

Before pass authority is implemented, add a real positive fixture produced through the public generated-output acceptance API, then prove the future verifier consumes that exact owned evaluation and every revision attempt. Negative fixtures must retain incomplete and unknown outcomes. A fabricated acceptance payload or direct SQL `pass` cannot be positive evidence.

## Findings addressed

- Corrected the launch-intent foreign key to the actual `orchestration_launch_intent.attempt_id` key.
- Corrected change-observation and held-case SQL placeholder counts.
- Bounded regular-file reads with fixed chunks; oversized inputs are hashed without allocating their full contents and are non-restorable.
- Empty change inventories no longer pass; launch targets must match immutable preapproval rows.
- Latest observations with unknown, moved, type-changed, or outside-manifest status are not current.
- Acceptance evidence is selected by exact evaluation ID and checked against run/revision, not newest run-wide row.
- Policy-seal ordering uses attempt row order after the sealed prior attempt rather than counting all earlier attempts.
- Held reconciliation rereads authoritative facts in its final CAS transaction after observer callbacks.
- Scalar/payload/hash/lineage trigger checks protect fields consumed as authority.

## Gates after wiring

Run the three direct Unit 2 tests, the focused S4 recovery/acceptance/driver set, TypeScript build, fresh SQLite reopen with `integrity_check` and `foreign_key_check`, and source/deployed migration SHA-256 equality. Then run current-build Windows junction, swap-race, killed-host reopen, parent-death, and seal gates. These OS gates are required before claiming filesystem restoration or checklist lines 162, 178, or 179 complete.
