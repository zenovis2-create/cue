# S5 evaluation observation revisions and cohort coverage contract

## Concrete APIs and scope

- `createEvaluationObservationStore(db).observe({ enrollmentId, observationId, expectedPriorRevision }, recordedAtMs)` validates the immutable enrollment in the same ledger, reads `readRunOutcome` outside any transaction, then atomically appends revision `expectedPriorRevision + 1`. The host supplies `recordedAtMs`; callers cannot supply outcome, measurements, prices, success, or timestamps.
- Exact `observationId` replay returns its immutable original receipt before any outcome reread. Reuse against another enrollment is rejected. A stale expected revision fails atomically.
- Every receipt states that its outcome is a historical separate committed read. Missing, unavailable, running/unknown, failed, and cancelled states remain stored as observed.
- `coverage({ datasetDigest, arm, policyDigest, cutoffId })` accepts a previously recorded cutoff observation ID from that exact cohort and lists every currently enrolled matching slot, selecting its latest observation by persisted append sequence at or before that cutoff. Equal or backwards host-clock values cannot admit later appends. Membership is disclosed as `current-enrollments-at-read`, not represented as cutoff-time membership. Unobserved slots have `observation: null`; expected dataset cases and enrolled slots are reported separately.
- Core exposes `enrollEvaluation`, `readEvaluationEnrollment`, `observeEvaluation`, and `evaluationCoverage`. It validates run and enrollment workspace ownership against the configured canonical worktree and sanitizes unavailable observations. No IPC, preload, renderer, trial generation, metric fabrication, report mutation, or promotion is in scope.

## Done gate and attempt cap

- Attempt cap: two correction hypotheses.
- Every pass: focused real-SQLite enrollment/outcome/observation tests, focused Core tests, daemon typecheck/build, and source/dist migration equality.
- Required cases: immutable replay, monotonic CAS and rollback, late state change, recorded cutoff, unobserved plus failure coverage, workspace denial, outer transaction denial, reopen integrity, and bounded oversized/count failure.
- Keep changes only when these gates improve. On failure, retry with a new hypothesis; after two correction hypotheses, report the blocker to root. No native helper, Electron, provider, model, download, or pricing call.
