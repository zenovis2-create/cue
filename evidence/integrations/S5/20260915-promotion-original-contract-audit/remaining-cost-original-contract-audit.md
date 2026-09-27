# Independent audit: S2-02, S2-03, and S5-03

## Verdict

Keep all three original conditions open. Their storage, classification, reservation, settlement, historical projection, and invoice-partition mechanics are substantial and independently tested, but the workspace still has no authoritative production producer for provider/API billing observations or the final component attribution. Closing them would turn synthetic authority and schema behavior into a claim about actual costs.

## S2-02

Original: `API/구독/로컬 비용과 actual/estimated/unknown/stale를 구분한다.`

Implemented:

- `daemon/src/selection/cost-capacity-observation.ts` canonicalizes provider/API, subscription, and local-resource dimensions; separates actual, estimated, and unknown; derives stale/future from observation time; and preserves unknown price/quota/GPU/billing as fail-closed states.
- `daemon/test/integration-cost-capacity-observation.test.ts` covers the dimension/unit combinations, zero-valued actual final cost, explicit unknowns, stale/future observations, incompatible combinations, and hostile objects.

Missing:

- No production observation adapter supplies current provider API price/usage/finality, subscription quota/value, or local GPU identity/capacity/load with trustworthy source revision and timestamp.
- Consequently the code can classify injected facts correctly, but it cannot establish that current real API, subscription, or local costs have been observed and classified.

The smallest completion seam is a trusted observation producer per supported cost dimension that emits the existing canonical input with pinned source identity/revision and time. A gate must inject real or independently authoritative observations through the production host, prove each dimension lands in the correct state, and prove stale/unknown inputs never become actual.

## S2-03

Original: `호출·재시도·검증·인계 비용을 포함하고 병렬 예산 예약/정산을 검증한다.`

Implemented:

- The budget manager and exploration/orchestration tests cover atomic reservation, final settlement, replay, overrun debt, uncertain-finality retention, rollback, and concurrent/parallel budget exclusion.
- `daemon/src/evaluation/handoff-accounting.ts` binds a stored final actual receipt to exact request, attempt, execution receipt, and handoff lineage. It checks with `BigInt` that base + retry + verification + handoff equals the already billed total, avoiding double counting.
- The independent handoff-cost gate records 8 files / 59 tests and the focused corrected gate 3 files / 21 tests, including historical replay, foreign/duplicate/unsafe/sum/class rejection, transaction rollback, and migration 045 upgrade/reopen.

Missing:

- The authoritative final receipt and its four-way attribution are supplied by a synthetic trusted-host fixture. No production billing adapter emits this receipt/partition from an actual execution.
- Thus reservation and settlement behavior is implemented, but there is no evidence that real call, retry, verification, and handoff costs are all included.

The smallest completion seam is a production billing/measurement adapter that converts the supported provider's final invoice/usage record into the existing exact receipt and attribution batch, binds it to request/attempt/handoff/execution lineage, and calls the existing store. The gate must reconcile the partition to the provider total, exercise overlapping parallel reservations without overrun, keep unknown finality reserved, and replay without another charge or write.

## S5-03

Original: `실패·취소·unknown을 포함하고 인계/재시도 비용을 누락하지 않는다.`

Implemented:

- Authoritative accounting and measured-fact projections preserve terminal outcome/uncertainty and disclose missing handoff coverage rather than inventing zero cost.
- Migration 045 requires every new monetary measured fact to have a projection; exact historical cutoffs keep later receipts from changing old facts.
- Known attribution requires a final actual receipt and exact lineage; absent, foreign, stale, duplicate, malformed, or incomplete attribution becomes rejection or explicit unknown. Components partition the existing billed total instead of adding a second total.

Missing:

- There is no authoritative production producer demonstrating that actual failed, cancelled, and unknown executions, plus retry and handoff phases, enter the final billing and measured-fact path.
- The permanent hostile test's “nonfinal or absent” case uses an absent receipt ID; stored non-final receipt rejection is supported by source validation rather than a separate permanent fixture. This is a test precision limitation, not the main production gap.

The same production billing adapter is the predecessor for closure. A meaningful gate needs four terminal fixtures or authoritative receipts (success/control, failed, cancelled, unknown), at least one retry and one handoff, exact totals and lineage, missing-component refusal/unknown disclosure, and immutable replay. Until that producer exists, the current implementation proves omission resistance for injected authoritative facts, not completeness of real evaluation cost data.

## Existing reproducible gates

- Classification: `npx --no-install vitest run test/integration-cost-capacity-observation.test.ts --fileParallelism=false --maxWorkers=1`.
- Reservation/settlement: the budget manager, exploration engine, and orchestration accounting suites cited by the current checklist.
- Attribution/evaluation: the eight-file 59/59 command and three-file 21/21 focused command preserved in `../20260915-handoff-cost-attribution/review.md`.

No provider, model, credential, local endpoint, native helper, network, or Electron action was used for this audit.
