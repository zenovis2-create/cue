# S2 cost/capacity observation implementation — 2026-09-12

## Scope and result

Added the pure `snapshotCostCapacityObservation(input, nowMs, maxAgeMs)` boundary and its focused integration test. No existing source, test, documentation, migration, application, adapter, policy, budget, or selection file was edited for this unit.

The boundary copies exact own data into a deeply frozen `cue-cost-capacity-observation-v1` snapshot. It accepts opaque safe candidate/provider/account/source references, a lowercase SHA-256 source digest, safe integer values and times, and a fixed legal dimension matrix:

- API: ISO-like canonical currency reference plus `minor | micro`; remote GPU claims reject.
- Subscription: `currency: null`, `subscription-unit`, unknown price, and no GPU claim.
- Local resource: `currency: null`, `local-resource-unit`, unknown price/quota/billing, with explicit local GPU state.
- Unknown cost requires `units: null`; actual/estimated cost requires safe nonnegative integer units. An estimated zero is rejected rather than treated as free.
- `billing: final` is legal only with descriptive actual cost. It remains observation data and never becomes `providerFinal` or a verified receipt.

Freshness is derived only from `observedAtMs`, `validUntilMs`, `nowMs`, and `maxAgeMs`. Conditional denial reasons have a fixed order. The return always fixes `authority: observation-only` and candidate, budget, and selection authority to `false`.

The module exposes no rank, select, reserve, settle, authorize, retry, fetch, callback, provider adapter, process, persistence, or conversion operation.

## Verification contract

Done was defined before editing as: focused verbose test, selection/budget/capability-admission regression, TypeScript no-emit check, build, and scoped file/status review all exit 0. The attempt cap was two. Every implementation pass ran the full command sequence; a failing pass required a new hypothesis or handoff.

Pass 1 stopped in the focused suite with 8 passing and 1 failing test. The revoked-proxy case reached `Array.isArray` before proxy rejection. The new hypothesis was to put the non-observing `types.isProxy` guard first.

Pass 2 results from `daemon`:

- `npx --no-install vitest run test/integration-cost-capacity-observation.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`: 1 file, 9 tests passed, exit 0.
- `npx --no-install vitest run test/integration-selection.test.ts test/integration-budget.test.ts test/capability-admission.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`: 3 files, 27 tests passed, exit 0.
- `npx --no-install tsc --noEmit -p tsconfig.json`: exit 0.
- `npm run build`: exit 0.

Focused tests cover deterministic immutable output; boundary freshness; API/subscription/local unit separation; ordered unknown/unavailable denials; legal price/quota/GPU/billing combinations; NaN, infinity, fractional, negative and unsafe integers; inverted time; caller-supplied freshness/revision and other unknown keys; symbols; custom prototypes; proxies including revoked proxies; getters and `toJSON` with zero touches; post-return input mutation; exact source digest; and path, endpoint, environment, credential, policy, permission, reservation, and command-looking references.

## Deterministic hashes

- `daemon/src/selection/cost-capacity-observation.ts`: `aa10dc9b637f93937b363f683022a2921a574703920e1443d97690443d67b11d`
- `daemon/test/integration-cost-capacity-observation.test.ts`: `5c50708f1c256bf3bb201ffa68f9008a73419dae097ecfd654bb0a9e15b6cbfd`

## Limits retained

This unit validates and snapshots caller-supplied data; the digest and source reference do not prove the observation true. Actual provider price, quota, billing authenticity/finality, subscription entitlement and throttling remain unknown. Actual local GPU identity, memory/load, allocation, valuation, and termination also remain unknown. An input labelled `actual` is not independently verified by this pure function.

No observation is connected to candidate admission, selection, a budget reservation or settlement. Retry, verifier, handoff, cold-start and exploration accounting remain outside this unit. A later trusted host producer and separately reviewed adapter are required before any fresh observation can inform those authority paths.
