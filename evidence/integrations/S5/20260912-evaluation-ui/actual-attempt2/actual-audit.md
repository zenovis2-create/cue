# Evaluation UI actual attempt 2 — independent final audit

Verdict: **FINAL FAIL — actual Electron UI attempt cap 2/2 exhausted**.

This audit distinguishes the previously passing source/component gate (7 focused files, 31 tests, plus typecheck and syntax checks) from actual Electron QA. The source/component result remains PASS; the actual UI gate is FAIL. No execution, retry, product edit, deletion, or cleanup was performed by the reviewer.

## Aggregate and process evidence

- `final-verdict.json`: `passed:false`, `childPassed:false`, exit code 1, child closed, backup verified, owned root removed, and no parent errors.
- `owned-state.json`: PID 70432, exit code 1, `closed:true`, `backupVerified:true`, `removed:true`. Independent process lookup found PID 70432 absent. Independent filesystem lookup confirmed `D:\Temp\User\cue-evaluation-ui-itLHyG` absent.
- Attempt-2 intent is preserved with timestamp `2026-09-12T01:06:10.880Z` and the immutable/no-automatic-retry policy.
- `process.log` contains no runtime diagnostic beyond whitespace. The authoritative child diagnostics are `failure.json` and `result.json`.

## Main scenario failure

The renderer loaded through the actual profile, guard, Core, IPC, preload, and renderer path. Guard receipts show exactly three successful checks before failure: post-dynamic-imports, primary prepare before the DOM event, and `cue:prepare` IPC dispatch. `failure.json` then records `assert(policy)` at `evaluation-scenarios.mjs:24`, phase `renderer-load:after`.

Independent read-only inspection of the preserved SQLite backup confirms the cause:

```text
task=1, run=1, local_selection_run_policy=0,
approval_event=0, orchestration_attempt=0, session_handle=0,
native_execution_identity=0, evaluation_enrollment=0,
evaluation_observation=0
```

The sole task is `awaiting_approval`. The scenario assumed the ordinary prepared run would have a row in `local_selection_run_policy`, but this actual preparation path did not create one. The proof stopped before fixture creation, evaluation enrollment, observation, replay, coverage, screenshots, or acceptance checks. `fixture.json`, `scenario.json`, `checks.json`, `after.json`, all three PNGs, and timeout evidence are correctly absent.

## Independent cleanup failure

`result.json` also records `ReferenceError: guardCheck is not defined` during phase `manifest`. This is a separate proof-scope defect: `guardCheck` is declared with `const` inside the child `try` block and referenced from `finally`, where it is out of lexical scope. Consequently cleanup manifest verification cannot succeed even if the main scenario reaches the end. No `after.json` was produced. The three preserved guard tags are genuine pre-failure checks, but the planned final cleanup tag was never possible on this code path.

## Backup, cleanup, and side effects

The backup SHA-256 is independently confirmed as `15C4F63EBB048EC6F18506192BC6FDC35B2DF811392907B99BB3442DD9778624`, matching `result.json`. Independent `PRAGMA integrity_check` returned `ok`.

The parent correctly verified the backup, observed normal child termination, validated the proof-owned temporary root, removed that exact root, and observed its absence. Unlike attempt 1, preservation of the owned runtime root was unnecessary because a verified backup and child result exist; immutable attempt artifacts and intent remain.

No approval, execution, Stop, model, native helper, provider, or evaluation operation occurred. The database has zero approval events, attempts, sessions, native identities, enrollments, and observations. The only product operation was a pending `prepareGoal` against the isolated proof-owned ledger/workspace. No repository/product file mutation is evidenced. The renderer web-request hook denied non-file requests and the main-process fetch guard was active before readiness; the failing path contains no model/provider/network call. Because `checks.json` was never reached, there is no completed zero-request counter receipt, but there is no evidence or reachable scenario action indicating a successful network operation.

## Final disposition

The actual UI attempt cap is exhausted: attempt 1 failed in selected-manifest setup, and attempt 2 failed after actual renderer preparation. **No further execution or retry is allowed in this unit.** The static READY review and both failed actual attempts must remain preserved.

Potential follow-up work belongs to a separate future unit: derive or establish the evaluation policy binding from the actual preparation semantics instead of assuming a `local_selection_run_policy` row, and move the cleanup guard wrapper into a scope visible to `finally` while retaining fail-closed receipt behavior. Those are code/proof design candidates, not authorization to modify or rerun the current gate.
