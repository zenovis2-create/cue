# Independent correction-1 review: S5 authoritative accounting

Date: 2026-09-12 KST  
Verdict: **BLOCKED — correction improves the design, but boundedness remains incomplete**

## Review done contract

Done means rechecking every prior finding against the corrected source, verifying current-disclosure membership with a normal-path append, running the focused accounting, budget, local-budget, Core-containment, type, and diff gates, and recording concrete counterexamples for any remaining blocker. Maximum review-writing attempts: 3. Every pass rechecks source/test hashes, cited source behavior, focused results, typecheck, and diff check. Only this correction review is owned.

## Resolved findings

The correction resolves the six findings in the first review for the historical snapshot path:

- Receipt IDs, kinds, provider-final values, and nullable-unit combinations are now validated before aggregation (`authoritative-accounting.ts:133-136`).
- The cutoff checksum now includes policy, plan, bounded attempts, retry authority, attempt revisions, plan revisions, and revision steps (`43-61`, `120-122`). The corrected tamper tests demonstrate that bounded budget-policy and retry-link mutations reject with `cutoff_integrity`.
- Retry classification validates the retry contract digest/payload, link request, authority receipt, prior attempt, failed outcome, and clean cleanup (`78-90`).
- Monetary remaining/debt values are decimal strings derived with budget-manager parity; debt makes total unavailable and completeness false (`145`).
- Local monetary fields intentionally remain null. That is value unavailability, not accounting incompleteness: a valid bounded local inventory now returns a separate `{limit, committed, remaining}` count and may be `completeAtCutoff:true` (`146-153`). The normal-path local test proves this distinction.
- Historical reservations/receipts/local rows are count-gated before `LIMIT 4097` materialization (`108-119`).

Revised attempts deliberately remain `lineage-unavailable:s4-revision-unverified` and `unclassified`. The narrow migration-036 prerequisite independently passed in `S4/20260912-claim-clock/INDEPENDENT-CHECK.md`; retaining the quarantine is conservative and within this correction's stated scope.

The new disclosure test is a concrete normal-path counterexample to the prior omission: it captures a monetary cutoff, reserves request `later` through `createBudgetManager.reserve`, and proves `projectAt` keeps the historical snapshot byte-for-byte equal while adding `{requestId:'later', currentLatestRevision:null, newerThanCutoff:true}` to `currentDisclosure`. This requirement now passes.

## Remaining blockers

1. **High — current disclosure bypasses every inventory and output bound.** `projectAt` uses an unrestricted `UNION ... ORDER BY` followed by `.all()` at line 163. It does not count-gate to 4,096, use `LIMIT 4097`, or apply the 2 MiB output check used only by `build` at line 158. Concrete tamper reproduction: after capturing a valid cutoff, disable fixture guards/foreign keys and insert 4,097 post-cutoff `integration_budget_reservation` rows for the run with distinct request IDs; `projectAt` materializes and returns all 4,097 disclosure rows instead of throwing `authoritative_accounting_inventory_limit`. Increasing request IDs toward 128 bytes can also make the returned projection exceed 2 MiB without `output_limit`. The plan's reservation and output limits apply to the store result, including the separately queried disclosure.

2. **High — dependency payload bounds are incomplete and occur after materialization.** `dependencies` count-gates only attempts and the reservation/receipt/local payloads. It fetches the original plan, retry contract, retry links, retry authority receipts, revision plans, and revision steps at lines 45-58 before checking their payload sizes; most of those rows never receive a size check at all. Concrete tamper reproduction: replace a bounded `orchestration_revision_step.payload` with a multi-megabyte BLOB while keeping the row under `planRevisionRowid`; `captureCurrent` reads it, converts the whole BLOB to base64 at line 60, hashes it into the cutoff, and can return successfully because revised role payloads are quarantined and the 2 MiB historical-output check does not include dependency bytes. This violates the explicit per-payload 1 MiB fail-closed bound and recreates the pre-allocation problem for dependency tables.

## Gate evidence

- Corrected source SHA-256: `EEC92B001FECB0CAB292B0261DE2E195BDA62099A141C5EAF449521519F90B31`.
- Corrected test SHA-256: `BC4AE98DD3225BBDA2356EBCFEDE8A752BE219690F486A67F683D033564326AC`.
- Focused accounting + budget + local-budget + measured-facts Core containment: **22/22 passed** across four files.
- `npx tsc --noEmit --incremental false -p tsconfig.json`: **passed**.
- Owned/evidence `git diff --check`: **passed**.

The five focused accounting cases still do not execute the plan's full tamper/bounds matrix, including 4,097 current disclosure rows or oversized dependency BLOBs. Core remains quarantined and has no accounting wiring. This review does not claim integration or measurement completion and authorizes no provider, model, native, network, Electron, credential, or paid activity.
