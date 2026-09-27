# S3 handoff/activity correction 1 evidence

Date: 2026-09-12
Attempt: 1 of 2
Status: implementation counterexamples resolved; independent review required

## Resolved counterexamples

- Migration 031 and the public handoff API bind handoff attempt, receipt attempt/revision/outcome/bytes, identity attempt/bytes/subject, and launch intent. The exact attempt-A plus attempt-B receipt/identity SQLite probe is rejected, and attempt A cannot transition to `completed`.
- `finish` requires a branded host-prepared handoff for every new clean terminal transition and revalidates the persisted receipt, identity, intent, canonical handoff bytes, and current host-resolved artifact bytes on terminal replay. A clean host boolean without a nonempty verified handoff remains blocked.
- New activity accepts only bounded typed data. Selection history no longer reads or stores the raw `detail` request: it binds the typed request digest to the current attempt claim and exactly one reservation. Typed-journal digest mutation, cross-attempt mutation, and raw-detail replacement are rejected. Pre-typed history is projected as unavailable and cannot create selection/relaunch authority.
- The actual generated-JSON host assembly emits supported output, usage, artifact and terminal facts plus explicit unsupported tool facts through the runtime/driver sink. Its two terminal handoffs bind the generated-output observation bytes; the checker consumes the producer handoff lineage. Activity completes before the result becomes receiptable, so a late callback cannot race terminal sealing.
- Codex controller/runtime facts remain bounded and late terminal callbacks are quarantined. UI projection emits `legacy-activity-unavailable`, handoff availability, and typed unsupported status without raw legacy detail.
- Migration-created legacy membership is closed to later inserts. Every new `completed` or clean `failed` transition requires a handoff even when no launch intent was inserted. Concurrent opens use a bounded SQLite busy timeout so migrations do not break the existing atomic-claim probe.

## Preserved failure evidence and correction path

- Initial correction probe: 38 failures, dominated by invalid path-like engine event IDs and receipt-verifier shape mismatch.
- After those fixes: 34 failures, traced to `attempt-decision-store` hard-coding `engine-request/<attempt>` and raw `payload.detail`.
- After the authorized minimal selection-store scope extension: selection plus engine 17/17 passed.
- First expanded run: 117/118 passed; the sole contract failure was a direct-store test expecting completion without a handoff. The database/store contract and the test were corrected to fail closed.
- Next expanded run: 115/118 passed; two engine fixtures lacked launch identity/handoff authority and one UI fixture attempted a new provenance-free terminal row. The engine fixtures now exercise real intent/identity/handoff lineage; the UI fixture is explicitly historical and non-authoritative.
- Final expanded run first produced 117/118 with a concurrent-open `database is locked` failure. The new hypothesis was migration concurrency; after adding a 5-second SQLite busy timeout, the isolated concurrency probe passed and the final expanded run passed 118/118.

## Measured gates

- `npm run build`: PASS.
- `npx --no-install tsc --project tsconfig.json --noEmit --pretty false`: PASS.
- Ten non-native focused/correction files: 10/10 files, 118/118 tests PASS. This includes the original focused files other than `p3c.test.ts`, plus `integration-attempt-selection.test.ts` and `integration-generated-json-host.test.ts`.
- Generated default-host path: 15/15 PASS, including exact activity order, unsupported tool fact, nonempty handoffs, and artifact fact/handoff equality.
- Migration source/deployed parity: PASS, SHA-256 `c88077fac6c81814e870d21dda92400e1d0d9cf03d11e9601cb319f8b0a9d5a9`.
- Fresh and pre-031 SQLite fixtures: close/reopen PASS, migration marker exact, `foreign_key_check` empty.
- Scoped trailing-whitespace check: PASS. Migration re-list confirms 031 remains the highest and current migration.

`p3c.test.ts` was not executed during correction 1 because it launches PowerShell/AppContainer workers, a local socket, and native processes, while the correction contract explicitly prohibits native execution. The prior implementation run recorded that focused file as passing, but this correction does not claim a fresh native gate.

## Critical file hashes

- `daemon/migrations/031_orchestration_handoff_activity.sql`: `c88077fac6c81814e870d21dda92400e1d0d9cf03d11e9601cb319f8b0a9d5a9`
- `daemon/src/orchestration/handoff-activity.ts`: `7853f555f458a9972ba7cc28a6cfba5d0237eaecf3c790a5279ec4d9d999a3b1`
- `daemon/src/orchestration/store.ts`: `245e4a7f3b473b3c3fd33723327641a29d478570fc3b56bdea619a4e9de27496`
- `daemon/src/orchestration/engine.ts`: `1a064df12955cdf96fc7fee56f5054ad0acb949e90214b53be184cfd19c7a760`
- `daemon/src/selection/attempt-decision-store.ts`: `1d25c998cffed550ada10fd144c2bb35b7ab3c036b478d0496f22a82245255e9`
- `app/generated-json-host.mjs`: `9bee54c79f108547f05bd27f03f5a80e2f66b108e12fea554de7ae9bb43782ed`
- `app/orchestration-driver.mjs`: `7ea2c3159361a320cf95ebf83c8e278d7149074388ac0d497c82d1bf77c27b00`
- `daemon/src/ui/orchestration.ts`: `ea799f3c54a55c4fe0bf26092e7ccb5686653845295a13f2a66bf43f1becee0c`
- `daemon/test/integration-handoff-activity.test.ts`: `afb0581d3d959422095bae58c621360293052ccd6eb6cc32e8cf768313f6d9ac`
- `daemon/test/integration-attempt-selection.test.ts`: `6f10bc318c3cf54466004e844694a2430b923e6d269b68aabce080fadfd74d51`
- `daemon/test/integration-generated-json-host.test.ts`: `9eb3e8cd433f6680ce5074e8a0ca3276ed38b8b068012159da51548a34e28139`

## Limits and review request

No model, provider, network, Electron, worktree, AppContainer, or native worker was executed. Synthetic executor factories exercise the real generated host/runtime/driver/store wiring but do not prove actual OS lifecycle behavior. This evidence does not close either S3 checklist sentence and requests independent review of the original blockers, the cross-attempt SQLite probe, migration upgrade behavior, activity redaction, and terminal replay.
