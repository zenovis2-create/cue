# Batch71 remaining-contract audit

Verdict: **one coherent two-part production hardening unit is startable offline; none of the reviewed open parents can honestly close yet.** R06 remains the only newly closed reuse parent, limited to the selected fixture/tool update contract.

## Audit contract

This is a read-only source/evidence audit except for this report. Done means: distinguish unavailable real facts from missing production code for R03-R05, S1-01..05, S4-01 and S4-05; propose at most two non-duplicative units with exact gates; do not call a provider/model, inspect credentials, enable Qwen, resolve the unknown Codex SHA, or duplicate Git deployment/cleanup work. One authoring attempt. Verification: `git diff --check -- evidence/integrations/planning/20260916-progress-reconcile-71/contract-audit.md` and the path/command checks listed below. Failure requires a changed hypothesis or handoff, not repetition.

## Facts that code cannot supply

- **R03-R05 / S1-01..05:** no qualified selected transport is available. The selected R-04/R-05/R-06 bytes are Cue-authored fixture/tool functions and explicitly have no product/provider authority (`docs/reuse-decisions/upstream-source-catalog.json`). Current lifecycle receipts label the historical transport cancel/restart/duplicate rows unqualified (`scripts/reuse/reuse-fixture-receipts.mjs`). Real provider success/failure/cancel/reopen behavior, account entitlement, provider terminal finality, billing stop, and supported-target P13/M receipts remain external facts. Codex provenance remains deferred and Qwen remains OFF.
- **S4-01:** a general current-source workflow pass still needs a qualified provider and an actual workflow checker/final acceptance receipt for every supported matrix cell. Existing Windows/native evidence cannot establish provider behavior.
- **S4-05:** actual4 proves native held state and zero automatic resume after a separate-process restart, but it has no authenticated provider/external receipt. The remaining fact is a provider/account-authoritative observation of whether the intended external transition occurred.

## Implementable production gaps

### Unit 1 — authenticate provider lifecycle terminal and billing evidence

Current production flow accepts `recordLifecycle` input from a resolved candidate and stores `provider-terminal` / `billing-finalized` digests (`app/orchestration-driver.mjs:143-163`, `daemon/src/orchestration/provider-lifecycle.ts:115-137,234-249`). Sequence and byte integrity are strong, but no deployment-owned verifier authenticates the referenced receipt bytes before those statuses are recorded. The projection deliberately grants zero authority, so this is not presently unsafe promotion, but it leaves S1-04/S4-01 without a production evidence-admission seam.

Bounded change: add a host-supplied lifecycle-evidence verifier at driver composition. For terminal/billing events it must resolve immutable evidence bytes, verify provider/account plus run/task/attempt/candidate lineage and receipt digest/finality, and return a copied plain-data verdict. Missing, timeout, stale, mismatched, malformed, proxy/accessor, or changed evidence must be stored/projected as unknown or rejected without appending a terminal/final event. Client cancel ACK must remain distinct and must never imply provider terminal or billing finality. Existing reference hashes alone must not authenticate a receipt.

Owned production paths: `app/orchestration-driver.mjs`, `daemon/src/orchestration/provider-lifecycle.ts`; focused tests: existing `daemon/test/integration-provider-lifecycle.test.ts` plus new `daemon/test/integration-driver-provider-lifecycle.test.ts` for the composition boundary.

Completion commands, from `daemon/`:

```text
npx --no-install vitest run test/integration-provider-lifecycle.test.ts test/integration-driver-provider-lifecycle.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
npx --no-install tsc --noEmit
```

Required cases: authenticated terminal then matching final billing; missing verifier/evidence; wrong account/attempt/candidate; digest mismatch; non-final receipt; cancel ACK without terminal; verifier mutation/throw/timeout; replay and reopen; append count zero on every invalid case. This advances S1-04 and S4-01 but cannot close either without an actual provider receipt.

### Unit 2 — authenticate held-recovery external-effect observations

`reconcileHeldRecovery` currently accepts an `ExternalEffectObserver` result and persists a decisive `confirmed-applied` or `confirmed-not-applied` observation after checking only account/resource/time (`daemon/src/held-recovery.ts:5,29-38`). It stores arbitrary `details`; it does not bind immutable receipt bytes, evidence digest, provider revision/finality, idempotency key, or expected transition digest through a deployment-owned verifier. A fixture observer can therefore move a held case to `reconciled-stop` or `eligible-for-disposition`. This is the clearest locally implementable remainder of S4-05.

Bounded change: require each decisive observer result to carry an immutable receipt reference/digest and pass a host verifier bound to the exact persisted intent (`intentId`, operation, account, resource, idempotency key, expected transition digest) plus observer identity/revision. Copy and validate plain data before callbacks; resolve and hash evidence once; fail closed to held on absent, stale, conflicting, mutated, malformed, timeout, or unauthenticated results. Persist the verified receipt binding in the canonical observation. Keep `unknown`, zero auto-resume, CAS, handoff, cleanup, and change-set gates unchanged. A migration is required if new receipt fields are stored in dedicated columns; otherwise preserve canonical payload integrity and explicitly document the compatibility choice.

Owned production paths: `daemon/src/held-recovery.ts`, the next numbered migration if needed, and the native recovery host composition in `app/native-recovery-host.mjs`; focused tests: `daemon/test/integration-held-recovery.test.ts`, `daemon/test/integration-native-recovery-host.test.ts`, `daemon/test/integration-recovery-handoff.test.ts`.

Completion commands, from `daemon/`:

```text
npx --no-install vitest run test/integration-held-recovery.test.ts test/integration-native-recovery-host.test.ts test/integration-recovery-handoff.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
npx --no-install tsc --noEmit
```

Required cases: verified applied/not-applied receipts; wrong intent/account/resource/idempotency/transition digest; evidence digest mismatch; verifier absent/throw/timeout/mutation; conflicting revisions; replay/reopen; held revision and writer/resume/send counts unchanged on invalid evidence. This can close the **offline production authenticity seam**, while original S4-05 remains open until one actual external receipt passes it.

## Parent closure assessment

- **R03:** keep open. Pure-function N/A rationales and deterministic negative cases exist for selected fixture/tool bytes, but the retained R-03 transport lifecycle explicitly lacks current cancel/restart/duplicate qualification. Another fixture matrix would be redundant.
- **R04:** keep open. The catalog records pins, source notice, empty patch lists and seams, yet `adoptionAuthorized:false` and the selected bytes are not product adapters. Calling fixture inclusion production adoption would exceed the exact scope.
- **R05:** keep open. Cue fixture/manifest regressions pass, but no adopted transport boundary exists and upstream-vs-Cue results for such a boundary cannot yet be produced.
- **S1-01..05:** keep open. S1-05's named current-source test can be run, but it is an aggregate gate whose required target receipts depend on S1-01..04; a green local suite alone cannot close it.
- **S4-01:** keep open after Unit 1; authenticated real workflow/checker/acceptance evidence is still missing.
- **S4-05:** keep open after Unit 2 until an actual authenticated external receipt is observed. Existing actual4 already establishes the native/no-auto-resume half.
- **R06:** closure remains legitimate only for the exact selected fixture/tool update invalidation/fallback/refusal scope established by `evidence/integrations/S0/20260916-reuse-lifecycle/correction/R06-closure-review.md`. No broader adoption follows.

No additional parent closure is supported by the current evidence. These two units are related but independently reviewable: Unit 1 admits provider lifecycle truth; Unit 2 prevents held recovery from treating an unauthenticated observer assertion as external truth.
