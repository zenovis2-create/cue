# Independent A03 driver targeted-Stop preflight

Verdict: **BLOCKED before the first OS run.** The fixture reaches the intended public driver path, but its identity oracle and cleanup guard do not yet satisfy the plan.

## What is startable

The test prepares and separately approves two immutable run/envelope records, activates both through the public driver, and calls `start` for each. The injected runtime adapter is reached through candidate resolution and creates one real Node controller plus one real grandchild per run. The two executions are keyed by the binding's run ID. `driver.stop(firstRunId)` routes through the public per-run Stop API; the adapter cancel callback uses `terminateVerifiedTree` for that execution's controller. The test then checks the first run is cancelled, the sibling is not cancelled, its heartbeat advances, and finally stops the sibling through its own run ID. No provider or model is invoked, and the fixture does not assert billing cessation.

## Blocking defects

1. **Creation identity is not preserved across the stop boundary.** The child reports `createdAt: new Date().toISOString()`, which is application-generated after spawn rather than the OS process creation timestamp. The pre-stop calls to `observeProcessTree` do obtain real `createdAt` values, but those values are not retained as the identity oracle. After stopping the first run, `verifyProcessesDead` checks PID liveness only. For the sibling, the later observation checks only that the same numeric PIDs are present; it does not require their post-stop creation timestamps to equal the pre-stop OS timestamps. PID reuse could therefore satisfy the asserted result, contrary to the PLAN's “originally observed processes” and exact PID-plus-creation requirement.

   Required correction: retain the pre-stop `ObservedProcess` records for both explicit controller/grandchild identities. After first Stop, require each target PID to be absent or to have a different creation timestamp and treat a replacement as original-instance death; require both sibling records to remain present with exactly equal OS `createdAt` values. The session-handle fixture should bind an observed OS creation value rather than the child-authored wall-clock string if that field is intended to represent process identity.

2. **The primary worktree cleanup lacks the PLAN's complete path guard.** The fixture cleanup checks only that the resolved parent equals `tmpdir()`, then recursively removes the path. It does not require the exact `cue-local-driver-` basename prefix or reject a symlink/reparse root. The sibling guard rejects a symbolic-link root but uses full-path substring matching rather than an exact basename-prefix check. The test also does not explicitly verify removal afterward.

   Required correction: for each owned root, resolve the path and OS temp base, require direct-parent equality, exact basename prefix, and `lstatSync(root).isSymbolicLink() === false`; then remove only that root and assert it is absent. Cleanup must still cancel/await every launched child on assertion failure before directory removal.

## Non-blocking observations

The test's two real launches, per-run cancellation count, blocked/cancelled snapshot, sibling heartbeat, and final sibling Stop are useful A03 evidence once identity and cleanup are corrected. It should continue to describe accounting/provider billing as unknown. The test-local admission records are synthetic and should not be cited as actual qualification or provider evidence.

No test, product source, build output, provider, model, or OS process was run or changed during this preflight.
