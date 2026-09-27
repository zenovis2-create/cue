# Independent original contract closure audit

Date: 2026-09-15

Verdict: **CLOSE S2-01, S2-04, S5-02, and S5-06 as implemented offline contracts. KEEP OPEN S2-03, S5-03, and A06.** This verdict does not assert provider prices, quota, GPU capacity, billing finality, account entitlement, statistical qualification, or live execution.

## Verification

The one permitted focused run passed: 10 files, 100 tests, exit 0. The exact command and runner output are preserved in `focused-test.log`. The root-provided independent current driver gate (95 tests) is cited for automatic switch and concurrent driver behavior and was not rerun. A separate checker reported the current-source build exit 0; this audit did not rerun it.

## Definitive item decisions

### CLOSE — S2-01

Original requirement (`docs/INTEGRATION_CHECKLIST.md:112`): automatic selection and switching inside policy are recorded without another question, while out-of-scope actions are blocked.

`selection/policy.ts` filters allowed candidates before deterministic selection; `selection/attempt-decision-store.ts` persists the immutable attempt decision. `orchestration/recovery-policy.ts` restricts a switch to another task candidate also present in the approved plan candidate set, and the actual driver records/applies the store-derived decision in `automatic-approved` mode. Stage binding rechecks task, candidate, policy, parent scope, actions, egress, and worktree containment before execution.

Focused evidence includes `four modes use different objectives with the same quality floor`, `manual pin never silently falls back`, the attempt-selection rollback/replay cases, `rejects scope-specific privilege, worktree and symlink expansion`, and `host denial, disallowed candidate and early dependency claims are refused`. The independent driver gate covers `automatically switches only to the store-derived approved alternate` and the quota-switch lineage case.

Claim limit: policy-bound offline/store and injected-runtime behavior. It does not qualify a provider or grant an account.

### OPEN — S2-03

Original requirement (`docs/INTEGRATION_CHECKLIST.md:119`): include invocation, retry, verification, and handoff costs and verify parallel reservation/settlement.

The budget manager correctly reserves every engine attempt, retains uncertain obligations, settles only provider-final actual receipts, and handles concurrent writers. Selection estimates use the broad `verified-completion-total` scope, and tests show a caller-supplied total can reverse a cheap first-call choice. The independent driver gate also covers summed concurrent wave reservations.

The missing behavior is structural handoff accounting. `evaluation/authoritative-accounting.ts:7` defines only `base | retry | verification | unclassified`, and `roleAndClass` at line 104 cannot derive a handoff class. The selection completion estimate has no required component inventory proving that handoff cost was included. Therefore an actual producer can silently omit handoff cost while satisfying the current total estimate/reservation shape. Parallel attempt reservation is implemented, but the complete four-phase cost contract is not.

Needed to close: derive and persist handoff cost from authoritative runtime/billing lineage, or prove it is inseparable from a named reserved attempt with a fail-closed invariant; then test parallel final settlement with all required components represented.

### CLOSE — S2-04

Original requirement (`docs/INTEGRATION_CHECKLIST.md:121`): test unknown price, exhausted quota, insufficient GPU, and uncertain billing termination.

`selection/cost-capacity-observation.ts` has explicit `price`, `quota`, `gpu`, and `billing` states and deterministic fail-closed denial reasons. Focused tests cover explicit unknown/unavailable states, exhausted quota, insufficient GPU, illegal price/GPU/billing combinations, unknown/stale selection estimates, and budget retention when stop/cancel or billing remains uncertain.

Claim limit: state modeling and offline denial behavior only. Actual provider price/quota/billing and local GPU observations remain unknown.

### CLOSE — S5-02

Original requirement (`docs/INTEGRATION_CHECKLIST.md:291`): record performance and uncertainty by task type, tool, model, and revision.

`evaluation/measured-facts.ts` validates complete stored execution-subject coverage and binds role, state, retry lineage, candidate digest, launch/identity/handoff digests, tool/model IDs and revisions, quality, timing, accounting, environment/account-limit/price contracts, and sorted uncertainty reasons. Focused measured-fact tests prove immutable host capture, exact replay, authoritative dependency validation, and fail-closed incomplete monetary inventory.

Claim limit: recording contract and fixture verification. Facts remain `trialReady:false`; no empirical performance conclusion follows.

### OPEN — S5-03

Original requirement (`docs/INTEGRATION_CHECKLIST.md:292`): include fail, cancel, and unknown outcomes without omitting handoff/retry cost.

Outcomes and retry costs are covered: `evaluation/comparison.ts` retains all four outcomes; real-ledger outcome tests preserve failed retries; authoritative accounting derives retry and verification classes from lineage. But `handoffUnits` exists only in the caller-populated in-memory `EvaluationTrial` structure. The authoritative producer has no handoff cost class or derivation, so a trial can set zero and silently omit a real handoff cost. A validation rule for an arbitrary field is insufficient evidence that the actual producer records the cost.

Needed to close: connect authoritative handoff activity/billing lineage to a required handoff cost component, reject missing or unclassifiable handoff obligations, and test the real measured-fact/trial projection rather than manually filling `handoffUnits`.

### CLOSE — S5-06

Original requirement (`docs/INTEGRATION_CHECKLIST.md:295`): record sample count, variance, environment, and price time.

`evaluation/comparison.ts` records environment and account-limit digests, observation time, price observation time/source digest, reports `n`, and computes descriptive sample variance. Focused tests cover both split counts/variance, insufficient samples, stale/missing price evidence, and environment mismatch. Measurement contracts and measured facts bind authoritative environment and price snapshots before a fact is stored.

Claim limit: descriptive recording/calculation. Statistical qualification is explicitly `not-performed`, promotion remains false, and no live sample exists.

### OPEN — A06

Original requirement (`docs/INTEGRATION_CHECKLIST.md:354`): out-of-scope model, account, task, or budget increase is never silently executed.

Task, candidate/model binding, subject digest, child scope, and budget limits have strong refusal paths. `integration-catalog.ts` binds a candidate to endpoint/model IDs, the driver records the catalog subject digest and model binding, stage admission rechecks the candidate, and the focused tests prove task/scope/budget denials.

The required account identity is absent from the execution approval/admission chain. A candidate string or catalog model binding is not an account entitlement. The only `accountLimitsDigest` here belongs to evaluation comparability, not launch authorization. Consequently this audit cannot prove refusal of an out-of-scope account.

Needed to close: bind an approved account identity/entitlement reference into policy, attempt selection, stage/runtime admission, and immutable launch intent; reject changed/missing/foreign account identities before external effects; add an end-to-end refusal test alongside the existing model/task/budget cases.

## Source pins

- `docs/INTEGRATION_CHECKLIST.md` — `5a22dc867efbe6c4574b9297a94b4c8bf5dab89cae3f11405b4325d7298f416d`
- `daemon/src/selection/policy.ts` — `93ee50a166bca25441ff2c8aabe0c0fb0dbf44c496ced165cf76f0f375dddeaf`
- `daemon/src/selection/attempt-decision-store.ts` — `1d25c998cffed550ada10fd144c2bb35b7ab3c036b478d0496f22a82245255e9`
- `daemon/src/orchestration/stage-envelope.ts` — `c141d5341da5cb716054f2c947e7311dbde1575a2a59fb7b310d28ee5d5acc89`
- `daemon/src/budget.ts` — `5456f1d265f16d6a9cbfe70f2c399dcd13af5136383eb3d3991d1163a70e6e03`
- `daemon/src/selection/cost-capacity-observation.ts` — `aa10dc9b637f93937b363f683022a2921a574703920e1443d97690443d67b11d`
- `daemon/src/evaluation/measured-facts.ts` — `6e3d27e123ec24835612f44dd7a1db8a6e3b534aef7b5ed3273b6936846a20ce`
- `daemon/src/evaluation/comparison.ts` — `94a952572e584b61eee69f72d585c90fad0c21284f80d5f72ba17326fbd54342`
- `daemon/src/evaluation/authoritative-accounting.ts` — `a6668c3d20d6b8fb963b4957c488197f7918a62088478246532f8831823a5935`
- `app/orchestration-driver.mjs` — `8a92d9592f1da09c7b701944c682c89ed7eb5a0e28bf26f72e3f9add47b2a479`

No production, test, or checklist file was edited. No native, provider, model, network, or live probe ran.
