# S2 persistent budget — independent review

Date: 2026-09-11
Reviewer: native agent `transport_review`; source implementation by `reuse_pure`.
Verdict: **PASS for the trusted-host persistent budget foundation**. No remaining blocking source finding in the reviewed scope. This is not approval of live budget enforcement or completion of S2.

## Independent execution

Working directory: `C:/Users/User/cue/daemon`.

```text
npm run build
exit 0
npx vitest run test/integration-budget.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
9 tests pass; 1 test file pass; exit 0
```

The tests exercised a temporary SQLite database, reopening it, and two independent Worker threads opening separate database handles. When both reserve 60 units against a 100-unit limit, exactly one reserves successfully and one receives `budget_limit_exceeded`; committed exposure remains 60. No real model calls were made. The full repository suite was not rerun and is not represented as passing.

## Reviewed source SHA-256

| File | SHA-256 |
| --- | --- |
| `daemon/src/budget.ts` | `5456F1D265F16D6A9CBFE70F2C399DCD13AF5136383EB3D3991D1163A70E6E03` |
| `daemon/migrations/008_integration_budget.sql` | `AC2C1F6ABD669DFAD1E21EE7E7DBD3CB85B0E8B559E3D4AD16CDAE5565A5DF9B` |
| `daemon/src/ledger.ts` | `FD48D3C999516CB672F132948421C5ECE726DC6C7AAAA0F63AC1BB66DB76DD81` |
| `daemon/scripts/copy-assets.mjs` | `5F1B15AE0962FD94AD430BDB7DDB9B416F044774545064A77A4F42DE21F92C14` |
| `daemon/test/integration-budget.test.ts` | `22690BF25A2C17E8D81515BDDC70CAE8B92B42416ABF23F2991B6D501401A97E` |

Follow-up review: budget policy immutability now also rejects SQL `INSERT OR REPLACE` via a BEFORE INSERT trigger and a regression assertion. Ledger/build wiring includes migrations 009 and 010. Independent current build passed, followed by `npx vitest run test/integration-orchestration.test.ts test/integration-budget.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`: **19/19 pass, exit 0**, including all 9 budget cases. Hashes above reflect this follow-up state.

## Findings and verified invariants

- Reserve and observation changes run in immediate SQLite transactions. Reservation capacity is calculated and inserted while holding the write transaction; summary reads run within a transaction as well.
- Policy initialization is immutable; exact replay succeeds but changed policy data fails. Currency and minor/micro unit must match the policy.
- Reservation and receipt identities are scoped by run. Canonical payload comparison rejects changed requests or receipts under an existing idempotency key. A distinct request cannot reuse an attempt ID within the run.
- Latest receipt revision replaces the previous total rather than being added again. Revisions cannot go backward, and final/actual state cannot regress to nonfinal/estimated state. Late corrected final actuals remain possible through the host verifier.
- Pending exposure is the maximum of original reservation and all historical observed amounts. The worker proactively corrected an earlier draft that only retained the latest amount. Reviewed code and the focused test retain 80 units after a high estimate followed by a lower nonfinal actual, so uncertain updates do not release exposure.
- Unknown/cancel-ack receipts cannot claim finality. Only an actual receipt marked final and approved by the injected host verifier releases unused exposure. Replaying an already accepted receipt does not verify it again or double count it.
- Amount inputs reject negative, fractional, nonfinite and unsafe integers. Cross-reservation totals use BigInt; two late actuals at Number.MAX_SAFE_INTEGER aggregate exactly without overflow.
- Actual overrun is recorded as debt rather than discarded. New reservations, including zero-unit ones, are blocked while debt remains. A verified corrective final receipt can clear the debt.
- The migration is invoked by `openLedger` and copied by the build asset script; re-open tests demonstrate persistence rather than only in-memory accounting.

## Scope limits and required integration

This API is host-owned. The `verifyFinalReceipt` callback is a trust boundary; the test's source-string predicate is only a fixture and is not evidence of provider billing authenticity. Amounts, policy approval, receipt revisions, observed times and conservative bounds must come from trusted host logic. No source/timestamp string alone proves the truth or freshness of a cost estimate.

The module accounts for one run's reservations. It does not enforce global/account budgets, fetch prices, convert currencies, reserve actual model calls, prevent a caller from launching the same request twice, or track provider process death. No live runtime invokes it for admission yet. A launch pipeline must require an accepted reservation before dispatch, distinguish replay from permission to launch again, and reconcile uncertain billing without treating a cancel ACK as final.

SQLite atomicity prevents new reservations from exceeding the supplied available amount; it cannot prevent a remote provider from charging more than its estimate. Such late excess is faithfully represented as debt and blocks subsequent reservations. Provider authenticity, final-bill guarantees, crash/launch integration and current policy freshness need independent integration evidence.

Only this review artifact was written by the reviewer; no application implementation was changed.
