# Restart recovery host integration — read-only discovery

2026-09-12. Proposal only; no product edits, build, native process query or model call during this investigation.

## Smallest integration seam

Add `app/native-recovery-host.mjs/.d.mts`, compose it through `app/main.mjs`, and add a protected runtime dependency and two methods to `app/core.mjs/.d.mts`:

- `listNativeIdentities({runId})`: bounded metadata-only list, explicit truncation, no process query.
- `observeNativeRecovery({runId,attemptId,identityRef})`: one explicit identity per observation; derive candidate and subject digest from validated storage, never accept them as caller authority.

Use the already opened actual `daemon.db` and authentic `InstallationGeneration` captured by the guarded entry. Capture these references once. Validate the generation brand and current closure before observation and before returning its result. Do not create a second daemon or reopen a renderer-supplied DB path.

Do not attach this to `createGeneratedJsonHost()` or the existing selection bootstrap. `createStartupOrchestrationFactory()` currently returns unavailable for disabled/missing settings, failed model health or unavailable discovery. A read-only recovery observation must remain useful when production execution is unavailable. It needs no provider health request, qualification, policy reservation or new installation descriptor supplied by the renderer.

Reuse `createNativeExecutionIdentityStore(db).read(ref)` and `createNativeRecoveryObserver(host).observe(...)`. No migration is required. Existing identityStore verifies immutable canonical bytes, indexed lineage and the six persisted session fields; the observer revalidates identity across waits and independently classifies exact process creation FileTimes and protected path provenance.

## Scope lookup

Validate exact own-data input and bounded canonical IDs. Resolve the parent's run/envelope against the Core's current workspace. Join `orchestration_attempt.run_id` to the requested parent, and its attempt ID to `orchestration_stage_envelope.attempt_id`. Require matching workflow_run_id, plan_task_id, stage_run_id and stage_task_id. The native identity's run is the stage run, not the workflow parent. Require candidate equality to that attempt, exact session run/task identity and a unique matching immutable record; derive subjectDigest from the validated record. Recheck the scoped lookup after the awaited observation.

Do not expose arbitrary identityRef lookup across runs. Qualification rows have no orchestration attempt and are excluded from this first workflow Core API. Missing pre-ready identity is explicitly unavailable, never inferred from parent PID, session wall-clock start_time, filenames or an older run.

The safe read-side linkage must validate persisted envelopes/hashes without rebinding. Existing `createStageEnvelopeBinder().read()` calls `bind()` and demands current realpath existence; cleanup inspection must remain useful when the old worktree is absent. Do not reuse that function as a side-effect-free recovery reader. Do not reuse `RecoveryCoordinator`, `fenceInterruptedSessions` or `reconcileInterruptedWrites`: they can terminate processes or change ledger state. This proposal does not modify the separately existing startup reconciliation behavior or claim it is read-only.

Return a frozen observation-only DTO. Core projection may omit protected absolute paths/PIDs; retain sourceKind, lineage references, per-process classification, path status/provenance and observedAt. Do not turn absence into cleanup_verified, ownership released, acceptance or automatic restart. No SQL writes, receipt issuance, file deletion, process termination, relaunch, policy changes or historical repair occur in this path.

## Full guard cost and deadline contract

Current `InstallationGeneration.assertCurrent()` (installation-identity.mjs:109) calls `measure()` again. That traverses the complete app/source/compiled/migration/package/native closure and rehashes the runtime executable. It is synchronous, with file byte/count bounds but **no hard wall-clock preemption**. The current native observer calls its guard in `current()`, and `current()` runs before and after every ancestor lstat. Directly supplying `guard.assertCurrent` would multiply a full installation scan by dozens of path steps inside a five-second deadline.

Recommended explicit, smallest observer API delta:

1. Rename the host contract to `assertInstallationCurrent(phase: 'before-observation' | 'before-publish'): true` and invoke the full authentic generation check exactly at those two boundaries. Do not replace the current callback with a cached `true`, weaken it to brand-only, or silently memoize across observations.
2. Keep lightweight `current()` checks around every await: abort/deadline, open DB/no external transaction, identical validated identity, and the small fixed observation-helper hash. Every invocation still uses the originally captured genuine generation; no new generation is minted after a failure.
3. Start the existing **five-second OS-observation deadline after the initial full guard**. Preserve bounded process-query and path-observation work within that phase. Before publishing, perform the second full guard and reject the observation on any drift. Return separate timing fields for initial guard, observation and final guard if needed for evidence.
4. Be explicit: this provides a five-second observation-phase bound, not a five-second total response SLA. Neither Promise.race nor AbortController can preempt synchronous full hashing or a blocked readSync. A strict end-to-end wall-clock deadline requires a separate worker/child boundary and cancellation contract; that is a larger unit and should not be claimed by this small integration. An elapsed-time rejection after hashing is a cooperative deadline, not hard preemption.

This is a documented cadence change, not weaker source authentication: the complete captured generation must match before OS work and before any result is released. It shares the existing host-exclusive installation / no hostile write-and-revert assumptions. If the required contract is instead full rehash around every lstat or hard total five seconds, this small integration is not viable and must remain unavailable until a separately reviewed isolation/worker design exists.

## Required offline tests before activation

- Reopen temporary SQLite, reconstruct the protected factory, list and observe only a correctly linked workflow identity. No in-memory launch WeakMap is required for this read-only path.
- Cross-run/attempt/reference/candidate/session mismatch, malformed/duplicate lineage, absent identity, corrupt payload and missing old worktree reject or remain unknown without mutation.
- Disabled production settings, unavailable qualification and model health do not cause a provider request and do not disable valid read-only observation.
- Genuine generation wiring and fake/structural generation rejection; initial guard drift means zero OS queries, final guard drift means no returned observation.
- Instrument full-guard callback count: exactly two for successful observation even with many ancestors. Lightweight checks still run on every await. Guard failure is not cached or replaced with a newly captured generation.
- Slow guard fixture demonstrates separately measured pre/post time rather than a false five-second total bound. Hanging query/stat reaches the five-second observation abort; source drift and DB lineage mutation during awaits deny publication.
- DB dump/content hashes before and after are identical across success, unknown, abort and failure. No cleanup receipts, ownership changes, acceptance, inference calls, process termination or file deletion.
- Existing observer offline suite plus new host/Core tests and build. Actual native no-model QA remains a separate authorized verification; this discovery does not perform it.
