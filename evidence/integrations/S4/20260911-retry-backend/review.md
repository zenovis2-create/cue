# Independent retry backend review

2026-09-11 · `/root/contracts_review` · **PASS for the explicit retry backend**. Maker `reuse_pure`; parent owns migration asset copying. Reviewer changed only this artifact. App retry driving, approval UI, acceptance after multiple attempts, and automatic migration activation are outside this review.

Completion gate: actual compiled migration helper plus focused retry/store/engine tests, build before worker tests, and current source hashes. Correction cap: two diagnosed findings; both resolved. No live model/native boundary probes or broad baseline were run.

## Independent gates

From `daemon`, `npm run build`: exit 0. Then `npx --no-install vitest run test/integration-retry-backend.test.ts test/integration-orchestration.test.ts test/integration-engine.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`: exit 0 at 17:17:13, **28 tests passed** across 3 files (retry 9, orchestration 10, engine 9). Building first ensures concurrent worker connections import current compiled code.

## Resolved findings

1. Contract binding originally required host time to equal the captured `boundAtMs` exactly. An ordinary clock tick could reject a valid preparation. The corrected check permits `boundAtMs <= now < deadlineMs`, while retaining immutable terms and preapproval authority. A regression verifies 1 ms advancement succeeds and future/elapsed timestamps reject.
2. Compiled `retry-migration.js` resolves SQL under `dist/migrations`, but migration 016 was initially absent from build asset copying. Parent added its copy; the upgrade regression now invokes the actual compiled helper. This fixes backend packaging without claiming automatic app activation.

## Reviewed guarantees

- Migration must run outside an existing transaction. It saves FK/legacy-alter settings, checks preexisting FKs, performs an exclusive transactional table rebuild, checks FKs again, and restores settings in finally. Existing attempt IDs and receipt/activity/stage references survive upgrade and reopen. Reapplying is idempotent; a legacy run gains no retry authority automatically. Failed migration restores FK enforcement and does not install its marker.
- Retry terms bind exact criteria, envelope, plan and policy before approval. Immutable SQL guards prevent replacement/update/delete of contracts and retry links; existing approvals cannot be retrofitted. Normal claims also enforce an installed contract's total/per-task caps, host-clock deadline, approval and future-observation rejection.
- A new retry requires an exact previous failed, cleanup-verified attempt and its latest matching clean-failure receipt. The step must still be failed with completed dependencies. A trusted host classifies that receipt as transient with source/digest/time fields; model input cannot grant the classification. These checks run again after authorization before mutation.
- One previous attempt may be consumed only once. BEGIN IMMEDIATE and a unique previous-attempt link enforce this across separate worker connections. Exact replay returns the prior fact without relaunching; mismatched replay references reject. Unknown cleanup, blocked attempts, mismatched receipts, unclassified failures, expired terms and exhausted caps do not retry.
- The engine includes retry references in its exact request journal. Claim, writer ownership, cumulative budget reservation, stage preparation and journal insertion share a transaction. Stage-preparation failure or insufficient budget rolls back the newly claimed retry/link/lease. Earlier unknown cost stays committed and counts toward the next reservation. Replay does not reselect, reserve again or relaunch.
- Existing ordinary claim, receipt, activity, crash quarantine and partial-launch/cleanup regressions remain passing. Historical failed attempts are retained, rather than overwritten by retries.

## Source snapshot

| Path | SHA-256 |
| --- | --- |
| daemon/migrations/016_orchestration_retry.sql | 3DA6DCB7ACEA53D6C3EC76EC95DD4C9F00BB6F37A3882529F0B444BF93C1F3BB |
| daemon/src/orchestration/retry-migration.ts | D21B09759F1D62D338A20156A72DF6B10825198266B4C9C4656F57C7B563FBBA |
| daemon/src/orchestration/store.ts | 0188554A852501CF6C6E2EE70D3F4C78205B85605622F66493240F67D9C14C21 |
| daemon/src/orchestration/engine.ts | 9B09E5CCCFA70F8071764A9B2479A075262A5D945F3701F4D32AE292BA90CE1C |
| daemon/test/integration-retry-backend.test.ts | 0C899C720C805E079AFEAE657EC6950A00E12CE61754AE28BE29E2020C2CE9CF |
| daemon/scripts/copy-assets.mjs | 68117C7B9B019659AF819111A2844427BA04385A6DCF34C1CE57FBFC7D118493 |

## Limits

Tests use real SQLite, upgraded legacy fixtures, separate worker connections, and synthetic trusted host callbacks. Semantic truth of transient-failure classification and cleanup/billing observations remains the host's responsibility. Integrity hashes are not authentication against a hostile full-database rewrite. The backend exposes explicit bounded retry admission; it does not itself implement automatic driving, backoff, approval display, final acceptance with multiple attempts, or a wall-clock execution kill at the admission deadline. No actual tool/model permission, provider stop/billing guarantee, whole S4 checklist completion, or whole-project completion is granted by this PASS.
