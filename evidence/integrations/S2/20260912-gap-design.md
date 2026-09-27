# S2 remaining-gap design — 2026-09-12

Scope: read-only source, test, documentation, and evidence review. No tests, builds, external/provider calls, migrations, or product edits were performed. This is a design record only. It excludes `node_modules`, `.git`, `dist`, and `build`, and it avoids the active S3/S4 implementation surfaces.

## Verdict

The next two smallest independent units are:

1. **Close the R-04–R-06 reuse disposition and authority-boundary bookkeeping from existing evidence.** This is a documentation/evidence unit with no product code or migration.
2. **Introduce a pure, host-owned cost/capacity observation contract before changing the selector, engine, or ledger.** This is a source-and-test unit with no migration. It supplies the missing vocabulary and trust boundary for later price/quota/GPU/billing and cold-start work without colliding with S3/S4.

Do not combine either unit with automatic retry/handoff execution, provider adapters, the active 031 handoff work, or the planned 032–033 migrations. If later durable provenance needs a table, reserve the next schema number at **034 or higher** after reconciling the migration inventory.

## Current truth by unchecked checklist row

| Checklist row | Existing evidence | Remaining truth |
|---|---|---|
| R-04–R-06 disposition | `docs/reuse-decisions/R-04.md` through `R-06.md`; `evidence/integrations/S0/20260911-baseline/reuse-review.md`; R-05 independent review | The bounded native experiments passed, and external adoption remains deferred. The decision documents still say product adoption is deferred and the checklist does not state the direct-implementation disposition. This is closable as documentation without another package experiment. |
| External transform/calculation authority | `selection/policy.ts` rejects extra policy/candidate fields, labels checks host-observed, and returns `executionAdmissionRequired` plus `budgetReservationRequired`; `orchestration/engine.ts` independently narrows allowed IDs, calls host authorization, reserves, prepares, and only then launches; attempt decisions are historical explanation only | The structural boundary is already present and reviewed. A role serializer or usage normalizer is not imported into these authority paths. This can be closed with an exact evidence reconciliation; it does not prove provider facts are true. |
| Automatic choice/transition in envelope | Bound run policy, allowed-candidate intersection, atomic attempt selection, and replay-without-reselection are implemented. Retries create separate attempts and retain prior cost. | Initial automatic selection is recorded. A distinct transition fact linking old candidate/reason to new candidate and proving “no re-ask” is not represented as an S2 contract. Outside-envelope candidate IDs are blocked, but outside-envelope actions/account/limit increases are broader approval/stage-envelope concerns. Keep the checklist row open until a transition unit is designed against the post-S3/S4 engine shape. |
| Cost kinds and provenance | `budget.ts` persists `actual | estimated | unknown`, source, observation time, finality, reservation and settlement; `policy.ts` rejects missing/future/stale estimates and missing conservative bounds under a strict limit; local invocation accounting is explicitly nonmonetary | API, subscription, and local monetary/resource dimensions are not discriminated. `stale` is derived only for selection estimates, not a durable receipt status. Source strings are labels, not verified provenance. Keep open after Unit 2 because Unit 2 is deliberately pure and not yet wired to the ledger/host. |
| Retry/verification/handoff plus parallel reserve/settle | Estimate scope is `verified-completion-total`; reservation scope is `verified-completion-attempt-total`; retry tests reserve each new attempt; SQLite worker tests prove competing reservations cannot exceed the run limit; unknown and nonfinal receipts retain the conservative obligation | Atomic reserve/settle and retry retention are real. The host has no implemented estimator proving its supplied total includes verifier and handoff work, and actual handoff/provider receipts are absent. The row remains open until trusted observations feed the contract and an end-to-end run accounts for every attempt. |
| Unknown price/quota/GPU/billing | Unknown/stale estimate, `quotaAvailable`, `resourceAvailable`, and unknown/nonfinal billing all fail closed or retain reservation | Quota/resource are booleans supplied by the host; GPU capacity has no typed amount or provenance; prices are not fetched or verified; a cancellation cannot prove remote billing termination. Offline hostile fixtures can prove fail-closed behavior only. Actual availability/finality stays a provider or local-host observation blocker. |
| Cold start and exploration budget | No implementation found. The selector excludes a candidate with no estimate. Local fixed-pair mode is a separately approved invocation-count path, not a monetary cold-start rule. | A verified conservative default and a separately authorized exploration allowance need explicit policy semantics. Do not smuggle exploration through `costLimit: null`, the main run budget, or a fabricated zero-cost local estimate. This should follow the observation contract and likely needs durable policy/budget lineage at migration 034 or later. |

## Unit 1 — reuse disposition and authority-boundary closure

### Exact files

- Modify `docs/reuse-decisions/R-04.md`.
- Modify `docs/reuse-decisions/R-05.md`.
- Modify `docs/reuse-decisions/R-06.md`.
- Modify `docs/INTEGRATION_CHECKLIST.md` and `docs/INTEGRATION_PROGRESS.md` only after the disposition language and cited hashes agree.
- Write a new implementation/review record under `evidence/integrations/S2/<run-id>-reuse-disposition/`; do not rewrite the historical experiment artifacts.
- No daemon/app source, dependency, lockfile, migration, provider, or user-home change.

### Contract and dispositions

- **R-04:** choose **direct native implementation, bounded adoption** for the strict in-memory RoleSpec formatter contract. Reject adoption of TeamAI's transformer as a product dependency for this scope because the strict Cue wrapper already supplies the required smaller behavior, while TeamAI extras and serializer dependencies add authority-bearing ambiguity. The result may format inert role data only. It cannot select a model, add tools, grant permissions, write files, or launch.
- **R-05:** choose **direct native implementation, isolated component accepted; production connection deferred** for `scripts/reuse/usage-normalization.mjs`. The independent 26/26 review supports the OpenAI-chat/Ollama fixture contract only. It cannot set price, candidate eligibility, reservation size, settlement finality, or provider-stop truth.
- **R-06:** choose **direct native guards for the current bounded contracts; Ajv/Zod deferred until schema scale requires them**. The reviewed strict native guards reject unknown/prototype/accessor inputs for their tested boundaries. This is not a declaration that every runtime DTO has been validated.
- The shared authority statement must cite the actual call chain: external/fixture-derived data can become inert role content or an untrusted observation candidate; only bound Cue policy plus current host admission plus the atomic Cue reservation/claim transaction can authorize a selected attempt. Historical `attempt_selection` output has `historical-explanation-only` authority.

### Hostile cases to verify from current artifacts

- `permissions`, `tools`, `model`, `candidateId`, `allowedCandidateIds`, price, or budget fields injected into a role/normalizer payload cannot appear in a policy, candidate checks, reservation, or launch context.
- Prototype, proxy, getter, symbol, unknown key, path-like role ID, invalid counter, overflow, partial counter, and duplicate/cumulative usage fixtures preserve the reviewed fail-closed results and do not invoke getters.
- A transform result naming a disallowed or pinned-unavailable candidate cannot cause fallback, admission, reservation, or launch.
- A normalizer result marked complete cannot make a receipt `actual`, `providerFinal`, or verified; cancel/EOF/transport completion cannot release a reservation.
- Documentation must not say TeamAI, Anthropic SDK, Ajv, or Zod was installed, adopted, compatibility-tested, or used live.

### Done gate

Run from repository root:

```text
node --test scripts/reuse/role-contract.test.mjs scripts/reuse/usage-normalization.test.mjs
cd daemon
npx --no-install vitest run test/integration-selection.test.ts test/integration-engine.test.ts test/integration-budget.test.ts test/integration-attempt-selection.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
npx --no-install tsc --noEmit -p tsconfig.json
```

Then verify all cited artifact hashes still match, review the documentation diff for the exact dispositions above, and obtain an independent read-only review. The unit closes checklist rows **R-04–R-06 disposition** and **external transform/calculation authority** only. Provider compatibility, product usage integration, current price/capacity, and live billing remain explicitly open.

## Unit 2 — pure cost and capacity observation boundary

### Exact files

- Add `daemon/src/selection/cost-capacity-observation.ts`.
- Add `daemon/test/integration-cost-capacity-observation.test.ts`.
- Do not modify `selection/policy.ts`, `budget.ts`, `orchestration/engine.ts`, `ledger.ts`, `copy-assets.mjs`, migrations, app/UI, adapters, or docs in this unit, except its own evidence record.
- Record implementation/test hashes and independent review in `evidence/integrations/S2/<run-id>-cost-capacity-observation/`.

### Input/output contract

Export a pure `snapshotCostCapacityObservation(input, nowMs, maxAgeMs)` boundary. It accepts exact plain-data fields only and returns a deeply frozen snapshot plus deterministic denial reasons. Suggested version is `cue-cost-capacity-observation-v1`.

Required identity and provenance fields:

- `candidateId`, `providerId`, `accountRef` as opaque canonical references; no secret, endpoint, path, or credential payload.
- `costDimension: 'api' | 'subscription' | 'local-resource'`.
- `costState: 'actual' | 'estimated' | 'unknown'`; `units` is a safe nonnegative integer only for actual/estimated and null for unknown.
- `currency` and `unit: 'minor' | 'micro'` for API monetary cost. Subscription/local resource observations must use their own declared unit and must not masquerade as currency. Do not convert across dimensions in this module.
- `sourceRef`, `sourceDigest`, `observedAtMs`, and `validUntilMs`; freshness is derived as `fresh | stale | future`, never accepted from the caller. A label alone confers no trust.
- `price: 'known' | 'unknown'`, `quota: 'available' | 'exhausted' | 'unknown'`, `gpu: 'sufficient' | 'insufficient' | 'not-applicable' | 'unknown'`, and `billing: 'open' | 'final' | 'unknown'` with exact legal combinations. `billing: final` is descriptive input only and does not satisfy `BudgetReceipt.providerFinal` or its verifier.
- `authority: 'observation-only'`, `candidateAuthority: false`, `budgetAuthority: false`, and `selectionAuthority: false` are fixed output literals.

The function must not rank, select, reserve, settle, authorize, retry, fetch, estimate missing values, infer a GPU from a model name, infer unlimited quota from a subscription, infer free cost from local execution, or invoke provider/user callbacks. A later host adapter may translate an independently verified fresh snapshot into selector checks or a conservative reservation. That integration requires a separate unit and regression review.

### Hostile cases

- Unknown price with a paid API dimension; stale/future price; currency/unit mismatch; zero presented as “free” without an actual source; estimated data presented as actual.
- Subscription with unknown remaining quota; exhausted quota; local execution with GPU unknown/insufficient; remote API with fabricated GPU capacity; local resource marked monetary zero by omission.
- Cancel acknowledgment or process exit marked billing final; lower revision/fresher label with older observation time; caller-supplied `fresh`; source label without a 64-hex digest.
- NaN, infinity, fractional/negative/unsafe units and times; inverted validity interval; excessive strings/arrays; duplicate fields; unknown fields; symbol keys; custom prototype; proxy; getter/toJSON traps with zero getter/toJSON calls.
- Mutation after return cannot change the snapshot or denial list. Candidate IDs or embedded fields resembling permissions, policy revisions, reservations, commands, file paths, environment variables, or credentials are rejected rather than forwarded.

### Done gate

Run from `daemon`:

```text
npx --no-install vitest run test/integration-cost-capacity-observation.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
npx --no-install vitest run test/integration-selection.test.ts test/integration-budget.test.ts test/integration-capability-admission.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
npx --no-install tsc --noEmit -p tsconfig.json
npm run build
```

Require deterministic source/test hashes and an independent read-only review. This unit establishes the missing vocabulary and guards but **does not close** the broad checklist rows for API/subscription/local cost, retry/handoff cost, price/quota/GPU/billing, or cold start. Closing those requires a trusted host producer, integration into selection/reservation, and live evidence where truth depends on a provider or GPU.

## Sequencing after the two units

After S3/S4 stabilize, the next S2 unit should consume the pure observation through a host-owned adapter, re-admit at execution, and atomically record an explicit transition relation between prior and new attempt decisions. It must show that an in-envelope candidate change uses the already bound policy without a new user approval and that any candidate, account, action, scope, deadline, concurrency, or budget increase outside the bound envelope is blocked before claim/reservation/launch. Reuse `attempt_selection`, retry lineage, and the post-031 activity/handoff contract rather than creating a parallel authority ledger.

Cold start should follow that integration. A default is eligible only when its identity/capability evidence is current and its conservative bound fits the main budget. Exploration needs a separate approved allowance and lineage; every exploratory attempt reserves against that allowance as well as applicable main/account constraints, and replay consumes neither twice. If durable fields cannot fit existing immutable policy payloads without changing historical meaning, use migration **034 or later**, never 032/033 by assumption.

## Actual provider blockers that offline work must preserve

- Current API price and billing receipt authenticity/finality.
- Subscription included usage, remaining quota, throttling, and account concurrency.
- Local GPU identity, free memory/load, allocation success, electricity or other local-resource valuation, and actual inference termination.
- Provider-side work after client cancellation, delayed charges, corrected invoices, currency conversion source/time, and global/account exposure outside one run.
- Empirical quality, completion-time, retry, verifier, and handoff estimates for a specific qualified candidate revision.

Unknown values remain unknown. The pure contracts may reject, retain a conservative reservation, or mark a candidate unavailable; they cannot turn absence of evidence into price, quota, GPU, billing, authority, or qualification facts.
