# Cold-start discovery and revised next unit

1. `docs/INTEGRATION_SPEC.md:52` requires a conservative default when statistics are absent and separately authorized paid exploration. Checklist line 112 remains open.
2. `daemon/src/selection/policy.ts:106-107` treats `estimate:null` as `unknown-estimate`; no fallback exists.
3. `daemon/src/selection/policy-store.ts:33-82` has no immutable run-bound conservative-default authority.
4. `daemon/src/orchestration/engine.ts:139-152` stops on `no-eligible-candidate` and otherwise reserves only through the ordinary run budget.
5. `daemon/src/budget.ts:89-108` already supplies the correct atomic ordinary-budget upper-bound gate and must remain mandatory.

## Precise estimate distinction

A `CompletionEstimate` remains a ranked, measured `verified-completion-total` tuple: quality, expected cost/time, conservative cost/time bounds, source, and observation time. It alone may produce a ranking score. `estimate:null` supplies none of those performance statistics and must never be converted into zero, a synthetic score, expected cost, or measured quality/time. The new conservative-default binding is a separate execution cost authority: it contains only a trusted maximum reservation for one named candidate. It can bound an ordinary budget reservation but cannot become a `CompletionEstimate` or ranking input.

## Smallest implementation unit: conservative fallback only

Persist one immutable `cue-selection-conservative-default-v1` record bound to a run and its exact selection policy identity. Its allowlist is exact: `runId`, `candidateId`, `policyId`, `policyRevision`, `policyDigest`, `currency`, `unit`, `maximumReservationUnits`, `source`, `sourceDigest`, `observedAtMs`, and `expiresAtMs`, plus canonical payload digest. Binding occurs before engine start and permits one named candidate only.

Add a narrow `conservative-default-store.ts` with strict plain-data validation, immutable bind/read, run/policy/candidate/currency identity checks, and current-time validation. It grants no execution, admission, price, observation, or budget authority beyond the stored per-attempt upper bound.

In the monetary engine, run the existing selector first. Any usable ranked estimate wins unchanged. Only after `no-eligible-candidate`, load the run binding and allow fallback when the bound candidate is currently allowed and its assessment exclusions are exactly `['unknown-estimate']`; all host eligibility checks therefore still pass. Record a new decision reason `conservative-default` with `score:null` and explicit `performance-unmeasured`, without calling it ranked or pinned. Extend historical decision validation for that exact shape.

After normal `authorizeExecution`, require the host's ordinary reservation to match run/attempt/request, policy currency and binding currency/unit, and to have `upperUnits <= maximumReservationUnits`. Then execute the existing claim plus ordinary `integration_budget.reserve` inside the same immediate transaction. Ordinary-budget exhaustion still denies dispatch. Preparation failure rolls both claim and reservation back. Replay validates the stored conservative decision, exact binding identity, and the existing ordinary reservation; it performs no new selection or reservation.

Missing, stale, expired, foreign-run, policy-mismatched, candidate-mismatched, currency/unit-mismatched, over-bound, exhausted, proxy/accessor, or noncanonical bindings fail before execution preparation. No estimate, price, quality, trial, provider, or local fixed-pair claim is created.

Exploration is explicitly outside this unit and checklist line 112 stays open. A later design must define candidate scope, reserved-versus-settled consumption, revisions/refunds/debt, and atomic co-reservation with the ordinary budget.

Ownership: one new migration; `daemon/src/selection/conservative-default-store.ts`; the monetary path in `daemon/src/orchestration/engine.ts`; the minimal decision type/snapshot changes in `daemon/src/selection/policy.ts` and `attempt-decision-store.ts`; focused store/engine tests. No Core, UI, provider, observation producer, trial, local-engine, or exploration ledger changes.

Done command: focused conservative-default store and monetary-engine tests; existing selection, attempt-selection, integration-budget, and monetary-engine regressions; `npm --prefix daemon run build`; scoped `git diff --check`. Cases: all-unmeasured bound default succeeds; ranked estimate takes precedence; mixed/failed checks do not fallback; missing/stale/expired/foreign/policy/candidate/currency/unit/upper-bound/ordinary-budget failures occur before preparation; hostile input is untouched; preparation rollback is atomic; exact replay uses the stored decision and ordinary reservation.

Attempt cap: 2 diagnosed correction hypotheses. Maker and checker remain separate; unresolved second failure returns to root.
