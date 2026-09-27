# Remaining 21 original-contract audit

## Verdict

The batch-73 accounting is correct: 44 original parents = 23 closed + 21 open. Current source does **not** justify closing R03, R04, R05, or S3-03 under their original wording. The execution map contains some later, broader implementation language, but removing that expansion still leaves a concrete original-condition gap in each row.

The two bounded subscription smoke successes do not remove lifecycle, cancellation, billing, app integration, or acceptance gaps. The approved model-call budget is exhausted at 4/4, Qwen remains OFF, and the unknown older Codex SHA remains deferred. This audit made no provider, model, network, authentication, or local-endpoint call.

## Focused findings

### R03

Original condition: test normal, failure, cancel, restart, duplicate, and boundary behavior, recording why any pure-function case is not applicable.

The selected fixture/tool bytes have deterministic receipts and update invalidation, but the evidence itself says the complete lifecycle matrix is absent for the continuing transport decisions. The current manifests remain `adoptionAuthorized:false`; their lifecycle references are documentation bindings, not executed rows for all six behaviors. This is not merely stale expansion in the execution map. The smallest missing gate is a selection-scoped matrix listing every currently selected R-ID, with an executed receipt or explicit pure-function N/A rationale for each original behavior. Transport rows still require external provider observations; pure fixture/tool rows can be completed offline.

Refs: `docs/INTEGRATION_CHECKLIST.md:29`, `daemon/test/integration-reuse-manifest.test.ts`, `evidence/integrations/S0/20260915-remaining-bom-audit/independent-review.md`.

### R04

Original condition: incorporate adopted components with pinned version/source notice, a thin adapter, and required patch list.

Current selected R-04/R-05/R-06 scope is fixture/tool-only, R-08 reuses principles with zero external bytes, and the manifests explicitly grant no adoption. Therefore there is no adopted product component for which the original incorporation result has been demonstrated. Closing this row vacuously would reinterpret “adopted components”; keeping it open is correct until S1 selects a component. The smallest missing implementation after selection is one product incorporation record binding the immutable revision, redistributable notice, Cue adapter entry point, and an explicit patch list (including `none`) to the shipped bytes, with unpinned loading rejected.

Refs: `docs/INTEGRATION_CHECKLIST.md:33`, `docs/INTEGRATION_SPEC.md:380`, `docs/INTEGRATION_SPEC.md:381`, `docs/INTEGRATION_SPEC.md:382`, `docs/reuse-decisions/manifests/`, `evidence/integrations/S0/20260915-remaining-bom-audit/independent-review.md`.

### R05

Original condition: pass Cue contract/regression and necessary real-boundary verification separately from upstream tests.

The focused Cue suites are real narrow evidence, but there is no separately preserved upstream result plus Cue result and necessary real boundary for an adopted product component. The current subscription smoke is outside the Cue app/runtime path and cannot supply that boundary. The smallest missing gate is produced only after R04: pin one upstream test receipt, one current-source Cue integration receipt, and the required actual-boundary receipt to the same selected revision, while keeping the three authorities distinct.

Refs: `docs/INTEGRATION_CHECKLIST.md:34`, `docs/INTEGRATION_SPEC.md:384`, `daemon/test/integration-runtime-contract.test.ts`, `evidence/integrations/S0/20260915-remaining-bom-audit/independent-review.md`, `evidence/integrations/S1/20260916-subscription-live/LIVE-REVIEW.md`.

### S3-03

Original condition: prove zero duplicate executions and zero final-result overwrite in `integration-orchestration.test.ts`.

The source now has a strong bounded staged-publication implementation. `integration-driver-publication.test.ts` proves winner/stale-loser behavior, replay launch/write zero, and fail-closed staging. The named original suite proves claim replay and independent atomic claim, but it does not contain the losing-writer final-overwrite assertion. More importantly, staging is opt-in and capability-gated; legacy writable adapters can still reach original targets directly. Thus the separate publication suite is sufficient evidence for the bounded seam, not for the original all-orchestration statement. The smallest missing implementation is to make every writable default adapter either use attempt-owned staging or refuse before launch, then place the two-writer winner/stale-loser plus reopen/resend assertions in `integration-orchestration.test.ts`.

Refs: `docs/INTEGRATION_CHECKLIST.md` (S3-03 row), `daemon/test/integration-orchestration.test.ts:53`, `daemon/test/integration-orchestration.test.ts:125`, `daemon/test/integration-driver-publication.test.ts:56`, `app/orchestration-driver.mjs`, `evidence/integrations/S3/20260915-existing-file-publication/driver/final-review.md`.

## All 21 open parents

| ID | Honest current status | Smallest remaining condition | Principal boundary |
|---|---|---|---|
| R03 | implementation + external measurement | Complete the original six-behavior matrix per selected R-ID; run real transport rows. | source/fixture now; provider lifecycle later |
| R04 | implementation blocked on selection/external source facts | Select a product component, then bind pin, notice, thin adapter, and patch list to shipped bytes. | selection and upstream identity |
| R05 | implementation + external measurement | Preserve upstream, Cue regression, and real-boundary receipts separately for the same selected revision. | R04 plus actual boundary |
| S0-01 | external measurement/input | Bind current binary provenance, auth-reference semantics, and stream protocol for Codex and Claude; local endpoint remains deferred while OFF. | installed identities/auth/protocol; unknown old Codex SHA deferred |
| S1-01 | implementation + external measurement | Execute R-01~R-03 lifecycle experiments through the app adapter and record adopt/limited/reject/defer. | qualified transports and provider lifecycle |
| S1-02 | external measurement with app integration gap | Compare current Codex app-server/worktree/events/Stop/reopen/cleanup against the preserved baseline. | qualified current Codex; no old unknown SHA inference |
| S1-03 | external measurement/input | Run the second-agent dedicated route; local route requires a separate decision to turn a local model on. | Claude/current account; Qwen OFF |
| S1-04 | external measurement | Observe cancel request, client acknowledgement, provider terminal state, billing stop, and exact child ownership separately. | provider and billing authority |
| S1-05 | external measurement after implementation chain | Keep current contract suite green and obtain fresh required P13/M receipts for supported targets with no required skip. | S1-01 through S1-04 |
| S2-02 | external input/measurement; schema mostly present | Connect trusted production price/usage/capacity producers without converting unknown or stale values to actual. | billing/usage sources |
| S2-03 | implementation gap | Feed every call, retry, verification, and handoff phase into one attempt-lineage reservation/terminal settlement producer; prove concurrent overrun zero and unknown cleanup releases zero. Existing authoritative projections expose unavailable handoff attribution but do not create the missing producer. | offline implementation; later real values |
| S3-01 | implementation + actual workflow measurement | Route the real planner through read waves and require every writer to hold an exact workspace/worktree lease through integration. | default host/adapter connection |
| S3-03 | implementation gap | Require staged publication or prelaunch refusal for every writable default adapter; add the original named-suite duplicate/overwrite regression. | offline finishable |
| S4-01 | external measurement after integration | Qualify each supported agent/mode/target in a current-source workflow with independent checker, terminal acceptance, and clean ownership. | provider/workflow matrix |
| S4-05 | implementation core + external receipt | Reconcile held attempts against authentic external receipts; unresolved effects must retain held state and launch/resume zero. | external-effect authority |
| S5-03 | implementation + external measurement | Project every terminal outcome and complete retry/handoff cost attribution; reject omissions and reconcile exact totals. Current code deliberately leaves handoff billability unknown without a trusted attribution producer. | shares S2-03 producer |
| S5-04 | external measurement/input | Populate a pinned, disjoint frozen dataset/holdout with a complete paired manual-baseline cohort. | actual trials and dataset authority |
| S5-05 | external measurement | Demonstrate the specified quality floor and improvement objective for all four modes on paired holdout results. | S5-02 through S5-04 |
| S5-08 | external measurement | Run the named evaluation suite plus approved-budget actual trials representing all four modes with final settlement. | new approved call budget |
| A01 | external measurement | Execute one pinned goal/revision in all four modes and show comparable reason, cost, and verification rows. | completed S2/S4/S5 paths |
| A08 | regression evidence + external measurement | Record the current-source stage `npm test`/release-gate result, then attach every required current actual receipt and independent review with open findings resolved. A green local run satisfies only the regression portion. | all applicable open rows; provider/model budget remains exhausted |

## Recommended next units (maximum two)

1. **S3-03 — genuinely finishable without model/provider calls.** Extend the default writable-adapter contract so direct-write legacy paths refuse before launch unless they provide the existing attempt-owned staging capability. Move or duplicate the decisive two-writer/reopen assertions into the originally named `integration-orchestration.test.ts`. Gate: the named suite shows first writer commits A, stale writer cannot replace A, and reopen/resend adds zero launches and native publications.
2. **S2-03 + S5-03 shared accounting producer — finishable implementation, while real monetary truth remains external.** Add one durable host-to-ledger attribution input that partitions final attempt cost into base/retry/verification/handoff units, binds it to the existing authoritative cutoff and receipts, and feeds reservation settlement and evaluation projection. Gate: success/failure/cancel/unknown fixtures reconcile exactly; omitted phase, stale receipt, concurrent excess, and unknown cleanup all fail closed without releasing budget.

R03/R04/R05 should not be selected as an offline “closure batch”: their original wording still depends on a selected incorporated component and, for transport paths, actual lifecycle/boundary evidence. They can gain preparatory matrices and record schemas now, but those artifacts alone cannot close the parents.

## Audit method and limits

This was a read-only source/evidence reconciliation except for this report. No test suite was rerun because the root task owns the full `npm test` gate; existing focused receipts were inspected rather than duplicated. The report does not change the 23/21 overlay and does not treat the batch-73 smoke calls as Cue workflow qualification.
