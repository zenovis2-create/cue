# Batch90 — use the full frozen workload in the app

Direct implementation requested by user, 2026-09-22. No delegation; self-review only. Preserve existing changes and prior evidence. Qwen OFF and exhausted subscription4/4 unchanged.

Concrete gaps: desktop evaluation enrollment hardcodes exactly two cases, while the packaged workload contains eight. The preparation command also cannot check a prepared workspace for input drift before use.

Implement:
1. Backward-compatible enrollment DTO branch for a complete bounded dataset manifest; descriptor-safe IPC validation, exact shape, distinct IDs/input digests, both splits and explicit selected member. Keep current-run binding and pre-approval guard. No caller-supplied outcomes/time/authority.
2. Explicit renderer manifest import/reset and full split-labelled case picker. Accept JSON dataset or existing preparation receipt's dataset, never auto-enroll/approve/execute. Show claimed-not-verified and keep manual baseline limitations. Ignore late responses after run/approval changes.
3. Pinned workload CLI verify of current seed bytes and supplied goal, with safe bounded regular-file reads and symlink/reparse refusal. Snapshot only, not an execution/input authority or OS race-proof sandbox. No writes on verification.
4. Actual Core/SQLite/IPC reopen regression plus renderer and hostile-input tests, filesystem/compiled CLI tests, build and coupled regression. At most two correction hypotheses per unchanged failure; preserve logs.

Do not upgrade fixture data to real baseline, runtime qualification, performance trial, promotion or parent completion. No live provider/account/model calls, credential copying, commit/push/publication, or historical cleanup. Record any unfinished measurement-source/code requirements as such, not merely blocked by live budget.
