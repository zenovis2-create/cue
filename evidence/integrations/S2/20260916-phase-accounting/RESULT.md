# Phase accounting result

## Outcome

- The monetary engine accepts an optional, source-evidenced `cue-phase-cost-partition-v1` with its normal host receipts.
- Reconciliation writes final billing, the clean terminal handoff, and the phase attribution in one SQLite transaction. Any invalid or missing lineage rolls the transaction back.
- The producer derives run, request, attempt, final billing receipt, execution receipt, handoff, currency, unit, retry/base/verification class, and digests from the ledger. Host input is limited to exact component units, evidence reference/digest, and observation time.
- Persisted attribution covers base, retry, verification, and handoff components; their sum must equal the provider-final actual receipt. Existing unknown reservations remain committed and produce no attribution.
- The read projection now exposes terminal `success`, `failure`, `cancelled`, or `unknown` alongside each known/unknown phase disposition.

## Gates

- Coordinated root build: PASS, exit 0 (`evidence/integrations/planning/20260916-progress-reconcile-75/build.raw.log`).
- Focused/regression Vitest: PASS, 6 files and 52 tests. Command: `npx --no-install vitest run test/integration-phase-accounting.test.ts test/integration-budget.test.ts test/integration-evaluation-authoritative-accounting.test.ts test/integration-evaluation-measured-facts.test.ts test/integration-handoff-accounting.test.ts test/integration-engine.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`.
- TypeScript: PASS, exit 0. Command: `npx --no-install tsc -p tsconfig.json --noEmit --pretty false`.
- `git diff --check` on the four owned implementation/test files: PASS.

## Final hashes

- `daemon/src/evaluation/handoff-accounting.ts`: `10b9549f947cc7207468ebe95b80821b2afe59d05ca6ff9fecd384f26466f1e4`
- `daemon/src/orchestration/engine.ts`: `de67f4a507f8f928ff0f490338eb585be6ff88695fa38809a5458c8c12e18109`
- `daemon/test/integration-phase-accounting.test.ts`: `aa9a4d953363597c90fe014cc4816a7ddb6d2747426181b03c7380a5242d3ced`
- `daemon/test/integration-engine.test.ts`: `019ebe6581ac26ea80cf8a515a9b72743c33bfc00d78349484c8c9b74ff5e223`

## Limits

- The app orchestration driver must supply the optional `attribution` receipt and `resolveAccountingEvidence` bytes; absent input stays unknown and retains its reservation.
- This proves offline lineage, atomicity, completeness, retry classification, and conservative unknown handling. It does not assert that an external provider invoice is correct.
- No migration, ledger bootstrap, app/Core/UI, provider/model/network, authentication, or live-call changes were made.
