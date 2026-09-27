# Batch89 — current regression/release gate

Date: 2026-09-22. Direct execution by current assistant; self-review only.

Scope: remaining release checklist prerequisite, current-source whole default `npm test` after batches86–88. Preserve existing dirty work (504 status entries before this batch), historical failed receipts and all existing skips. No new feature/authority, independent-review claim, commit or publication.

Environment: Windows host; Node v24.18.0, npm12.0.1. 296 current test files. Root npm test forwards to daemon pretest build and Vitest serialized verbose runner. Disable inherited opt-in flags for installed-provider/Orca and crash-restart actual gates. Do not restart/probe Qwen or make real provider/account/model service calls. Existing tests include owned local Windows processes, temporary SQLite/Git/filesystem/AppContainer fixtures and loopback-only fake provider requests (the manifest test uses pinned CLI bytes with a temporary unauthenticated loopback provider); these are not production model qualification. Retain normal denial probes and strict cleanup assertions.

Commands/evidence:
1. `source-before.sha256`, `status-before.txt`, document preimages.
2. `npm test` once with verbose stdout/stderr captured and exit recorded; default existing skips unchanged.
3. Diagnose any failure from actual trace/source. Save precise preimages for every changed file. At most two correction hypotheses per unchanged blocker; no silent skip, weaker semantic assertion, credential copy or arbitrary timeout increase.
4. Build and focused corrected regression, then complete current-source coverage or report explicitly incomplete. Do not relabel reruns/partitions as a single clean invocation.
5. Current result, source hashes, skips, limitations and checklist/progress overlay. Parent counts remain33/44 unless all original gates are established; no new paid/live authority is granted.

Full test output may take tens of minutes. Test-owned teardown only; do not broadly delete historical retained folders or terminate unrelated processes. Stop/replan on unresolved ownership or unsafe test behavior.
