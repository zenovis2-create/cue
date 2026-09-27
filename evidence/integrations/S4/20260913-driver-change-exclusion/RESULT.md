# Driver change-observation exclusion result

Status: independently reviewed PASS.

- Final focused command: `npm exec vitest run -- test/integration-change-records.test.ts test/integration-driver.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`
- Result: exit 0; 2 files and 41 tests passed.
- Production source: `app/orchestration-driver.mjs`.
- Actual-driver regression: `daemon/test/integration-driver.test.ts`, test `blocks retry when the real change journal observes a file identity replacement`.
- Independent review: [`review.md`](./review.md), SHA-256 `C133E7EE31CE88DE57321D9F675129F6F09F4E4063E12AAE7B9CAF4AD329EED1`.
- Shared root build: [`build.json`](../../S7/20260913-recovery-source-refresh/build.json), receipt `74192e`.

The negative regression runs the production driver with the real SQLite orchestration/change stores. Its owned worktree target is deleted and recreated during the failed attempt, so the real change observer persists `moved`. Cleanup is deliberately unverified to preserve the unresolved writer lease. The test proves the driver blocks with `change_observation_unknown`, launches only the original `make` attempt, creates no recovery decision or additional plan revision, retains one writer lease, and retains the persisted observation. A positive actual-driver control modifies the same target in place, persists `modified`, and proves that allowed status reaches the existing downstream `orchestration_evidence_unverified` gate rather than the change-observation block. Existing change-record tests cover the remaining allowed classifications.

Correction history:

1. The first actual-driver attempt failed during preparation with `driver_retry_requires_criteria`; using the established acceptance-enabled fixture supplied the required retry criteria.
2. Replacing a file with a directory produced `unknown`, so the fixture was changed to delete and recreate the file, yielding the intended real `moved` observation.
3. The initial revision assertion expected zero, but preparation creates the approved initial revision. It now captures the pre-run count and proves no additional revision.
4. A verified-clean failure correctly released the writer lease. The final scenario uses unverified cleanup, where the lease must remain; without the new observation gate this path would block later as `orchestration_evidence_unverified` rather than the asserted change-specific reason.

No provider or model call occurred. The subsequent shared root build succeeded and is linked above.
