# S2-02 cost observation production bridge plan

## Done

- `createBudgetManager.observe` consumes the existing account/attempt lineage and validates the persisted API receipt through `snapshotCostCapacityObservation` when that production lineage exists.
- The same manager reads the latest persisted receipt as a source-bound observation that preserves `actual` / `estimated` / `unknown` and derives `fresh` / `stale`, with observation-only authority.
- Existing unbound/legacy budget behavior remains compatible; no receipt, cost, invoice, quota, or provider truth is invented.
- Focused gate from `daemon/`: `npx --no-install vitest run test/integration-cost-capacity-observation.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` exits 0.
- Regression gate from `daemon/`: `npx --no-install vitest run test/integration-budget.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` exits 0.
- Typecheck gate from `daemon/`: `npx --no-install tsc -p tsconfig.json --noEmit --pretty false` exits 0. Root owns the shared build.

## Loop contract

- Attempt cap: 2 per hypothesis.
- Every pass runs the focused gate and typecheck gate.
- On failure, retry only with a new hypothesis; otherwise hand the failure and evidence to the root owner.
- Keep a change only when both measured gates pass.

## Exact preimages

- `daemon/src/selection/cost-capacity-observation.ts`: `aa10dc9b637f93937b363f683022a2921a574703920e1443d97690443d67b11d`
- `daemon/src/budget.ts`: `5456f1d265f16d6a9cbfe70f2c399dcd13af5136383eb3d3991d1163a70e6e03`
- `daemon/test/integration-cost-capacity-observation.test.ts`: `5c50708f1c256bf3bb201ffa68f9008a73419dae097ecfd654bb0a9e15b6cbfd`
- Text copies are retained beside this plan as `preimage-budget.ts`, `preimage-cost-capacity-observation.ts`, and `preimage-integration-cost-capacity-observation.test.ts`; `apply_patch` normalized their line endings, while the hashes above identify the original byte preimages.

## Limits

- No provider/model/network calls, authorization, local-model work, or use of the exhausted live-call budget.
- Existing smoke evidence is not treated as an invoice or authoritative production bill.
- This bridge describes imported persisted receipts. It grants no budget, candidate, selection, or provider qualification authority.
