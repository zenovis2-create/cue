# S2-02 cost observation production bridge results

## Outcome

`createBudgetManager.costObservation` now provides a production-code read surface that projects the latest persisted monetary receipt through the existing `snapshotCostCapacityObservation` boundary. It binds the projection to every denormalized receipt scalar, the requested run/request, budget currency/unit, stored attempt candidate, immutable account identity, provider/tool identity, receipt bytes, and source reference. It returns only observation authority and preserves `actual`, `estimated`, `unknown`, and time-derived `stale` states.

No write contract changed. Existing broad `BudgetReceipt.source` acceptance remains intact because the stricter source-reference validation runs only on the explicit observation read. The bridge labels this path `api` because `integration_budget` requires currency plus `minor`/`micro`, which is the API-only monetary shape accepted by `CostCapacityObservation`; it does not infer subscription or local-resource charges from this store.

## Verification

- Focused source test: 10/10 passed, exit 0.
- Existing budget regression: 9/9 passed, exit 0.
- TypeScript no-emit check: exit 0.
- Shared build was not run; root owns it.
- Canonical payload substitutions for a foreign run, foreign request, mismatched unit, string `providerFinal`, missing field, and extra field, plus direct denormalized kind/finality corruption, all fail with `budget_receipt_integrity`.

Two initial fixture-only failures are retained truthfully: missing verifier coverage (`invalid_plan:requirement-coverage`) and an invalid opaque account fixture (`account_identity_invalid`). A subsequent fixture state error (`run_not_running`) was corrected by matching the established running-task setup. None wrote production data or called a provider.

## Limits

- This is an offline production-code bridge over existing persisted receipts and account lineage. No provider, model, network, authentication, or live-budget call occurred.
- It does not establish invoice truth, provider qualification, quota availability, subscription cost, local-resource cost, or billing termination beyond the imported receipt's existing fields.
- Unknown quota remains an explicit denial reason. Stale and unknown observations are descriptive and receive no budget or selection authority.
- No selection/runtime caller invokes this reader yet; this change connects the snapshot boundary to the existing production persistence API, but does not claim an end-to-end production selection consumer.
