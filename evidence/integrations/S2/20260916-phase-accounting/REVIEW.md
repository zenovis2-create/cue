# Independent phase-accounting review

## Verdict

CLEAR. The frozen change supplies a production consumer for phase attribution and preserves the existing conservative budget behavior. The recorded maker gates (6 files / 52 tests, TypeScript, and coordinated build) are sufficient for this review; I did not rerun the shared build or make provider/model calls.

## Production trace

- `createOrchestrationEngine` receives `billing`, `execution`, and optional `attribution` from the same host receipt read. Reconciliation first validates request/attempt lineage, then performs final billing observation, terminal handoff persistence, and attribution persistence inside one immediate SQLite transaction. A bad partition therefore rolls back all three writes.
- `recordAttempt` does not trust host-supplied run, request, attempt, receipt, handoff, currency, unit, or phase class. It captures the current authoritative accounting snapshot, selects the matching request/attempt, requires the latest provider-final actual receipt, requires exactly one clean succeeded/failed handoff, and derives those lineage fields from the ledger.
- The host can supply only the exact component values and evidence reference/digest/time. Exact-key and numeric validation applies; evidence bytes must hash to the supplied digest; base + retry + verification + handoff must equal the final receipt total. Ledger-derived cost class permits only the corresponding base, retry, or verification component, while handoff remains separately represented.
- `persist` is replay-safe. An exact prior row is accepted; any collision by attribution, run/request, attempt, billing receipt, or handoff with different payload/digest rejects. This prevents double counting.
- Missing attribution is deliberately a no-op. Estimated, unknown, non-final, missing-cleanup, and cancellation uncertainty cannot create a phase row or release the reservation. Existing budget tests prove unknown/cancel ACK retention, final settlement, overspend debt, and two independent SQLite writers competing for one remaining capacity.
- Driver receipt data is not dropped by the engine bridge: `receipts(...).attribution` is passed to `recordAttempt`, and `resolveAccountingEvidence` is passed through to the byte/digest verifier. This is an optional host input; absence remains explicit unknown rather than inferred authority.

## Original checklist decisions

- **S2-03 — APPROVE closure.** The original requirement is to include call/base, retry, verification, and handoff cost and verify parallel reservation/settlement. The phase fixture records base 35+handoff 5, retry 43+handoff 7, and verification 8+handoff 2 against exact final totals; the engine test proves the real consumer and atomic settlement; existing budget concurrency proves one of two competing reservations is rejected without overrun. Unknown cleanup/cost releases zero.
- **S5-03 — APPROVE closure.** The original requirement is to include failure, cancellation, and unknown outcomes without omitting retry/handoff cost. The failed retry attempt receives its exact retry and handoff components. Cancellation and unknown/non-final outcomes retain their conservative reservation and cannot manufacture attribution; the projection labels terminal success/failure/cancelled/unknown while missing attribution remains `disposition: unknown`. Thus every outcome is represented either by source-bound final cost or by an explicit retained unknown obligation.

These approvals concern the original backend accounting rows only. They do not establish S2-02 provider truth or S5-05 actual-trial evidence, and they do not claim external invoice correctness.

## Evidence checked

- `PLAN.md` and `RESULT.md` in this directory.
- Frozen source: `daemon/src/evaluation/handoff-accounting.ts`, `daemon/src/orchestration/engine.ts`.
- Focused tests: `daemon/test/integration-phase-accounting.test.ts`, `daemon/test/integration-engine.test.ts`.
- Regression evidence named by the maker for budget concurrency, authoritative accounting, measured-fact integration, and handoff accounting.
