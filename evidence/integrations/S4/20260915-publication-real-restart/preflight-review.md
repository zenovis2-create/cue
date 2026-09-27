# Independent preflight review

Verdict: **BLOCKED before the single environment-gated actual attempt** at fixture SHA-256 `006b1ec0e7f7e8b46f12c3c67a3b9856143876fd77b254ca745ee59de9bc3f82` and test SHA-256 `2cf43fdd9a333134b8c15d85fc5604720fa4dccec8420ca6dc68360c22a576f3`. No OS test was run in this review.

Two failure-path defects must be corrected before consuming the actual cap:

1. Both children are inserted into the owned `children` map only after `nextJson` returns the effect/reopen frame. `nextJson` has no bounded timeout and does not race child close/error. If seed, identity observation, native execution, or reopen fails or hangs before stdout, the test can wait until its outer timeout without having registered an identity for exact cleanup. The fixture needs an immediate pre-effect identity handshake, and the parent must register the child plus exact PID/creation pair before awaiting later frames. Each bounded frame wait must reject on timeout, error, or premature close while preserving the registered identity for `afterEach`; cleanup must retain the root when exact termination cannot be proved. No PID-name sweep is acceptable.
2. The reopen path passes `()=> ' M final.txt'` to `reconcileInterruptedWrites`. This proves the production reconciliation state transition under a fabricated status string, while the actual file hash independently proves the native effect. It does not prove default `captureGitStatus` or a real repository status observation. If the intended closure includes that boundary, create an owned repository, establish the tracked preimage, and call `reconcileInterruptedWrites` without the injected reader. Otherwise the result must remain explicitly limited to reconciliation with synthetic status capture.

## Ordering and crash boundary

The production `createFinalPublicationStore.publish` implementation inserts `change_publication_intent` in an immediate transaction before invoking `execute`. The fixture's execute callback calls the real `compareWriteExistingNative`, reads and hashes the resulting file, emits PID plus creation time and intent/result counts, and then blocks indefinitely inside `Atomics.wait`. Consequently, receipt of the first frame with `intentCount:1`, `resultCount:0`, committed native outcome, and replacement bytes proves the intended durable-intent / completed-native-effect / absent-publication-result window before the parent kills the child.

The parent independently reopens the SQLite file before termination and checks intent 1/result 0. It re-observes the exact first-child PID and creation time immediately before `terminateVerifiedTree`, awaits child close, and then checks that the same identity is absent. This avoids PID-only termination. Missing or changed identity fails closed.

## Fresh reopen and no-resend oracle after correction

The second child is a distinct process and opens the same database. It calls production `reconcileInterruptedWrites` with a fabricated deterministic status reader. The expected assertions are coherent with that implementation: root and running attempt become blocked, cleanup remains unverified, and the workspace lease remains held.

The exact publication replay encounters the already persisted intent and returns pending before authority or execute. The test requires `authorizeCalls:0`, `executeCalls:0`, one original attempt, zero replacement attempts, zero publication results, zero receipts, zero acceptance rows, one `blocked_no_auto_resume` recovery row, and unchanged replacement bytes/hash. These checks reject silent resend, acceptance, replacement, result fabrication, or lease release. The second child must exit 0; stderr participates in the exit assertion.

## Ownership and cleanup

The actual is disabled unless Windows and `CUE_ACTUAL_PUBLICATION_RESTART=1`. Once an identity has been registered, forced termination is guarded by the captured exact PID/creation pair and failure cleanup repeats that check. Registration currently occurs too late, which is the blocking gap above. Temporary deletion is restricted to a resolved direct child of the resolved OS temp directory with the exact unique prefix and a non-symlink root, followed by an absence assertion. The fixture and test contain no provider, model, Electron, local endpoint, or network operation.

The preimage manifest is `preimages.json` (both new source files recorded absent); the PLAN's prose reference to an “absence manifest” is satisfied by that file name. Offline receipts report `node --check` and TypeScript `--noEmit` exit 0. I did not rerun either gate.

## Proof boundary

This test does **not** enter through the public orchestration driver. It synthetically seeds the minimum task/run/envelope/attempt/lease/handoff/change-journal lineage through direct SQL and store helpers, then exercises the production final-publication store, native existing-file compare/write helper, SQLite persistence, and production interrupted-write reconciliation directly. After the ownership blocker is fixed, a passing actual could close the narrow existing-file publication crash/reopen and zero-resend boundary for this synthetic seed. With the current injected status reader it would not prove actual Git status capture. It cannot qualify driver construction of that lineage, real adapter/provider behavior, session reconnect, power-loss durability, new-file or rename publication, Electron, billing, or broader S3/S4 completion.

One non-blocking limit remains: the second child's emitted creation time is durable evidence from `observeProcessTree`, but the parent only requires its PID to differ from the first and does not re-query that second identity after its normal exit. No termination decision depends on the second identity, and exit 0 plus the complete reopen frame is the relevant completion proof.
