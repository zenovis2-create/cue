# Batch95 — immutable measured-comparison backend

2026-09-22. Direct implementation/self-review; independent review pending. Qwen OFF and subscription4/4 exhausted. Real provider/model/account/service calls0. No credentials/user-home mutation/commit/publication/actual GUI gate retry. Original checklist33/44 closed,11 open.

## Delivered code

- Added `daemon/src/evaluation/measured-comparisons.ts` with explicit enrollment-ID cohort requests, durable create, historical read and separate current inspect. Added corresponding workspace-scoped Core APIs/declarations.
- Uses a separately versioned `cue-measured-comparison-v1` payload in the **existing immutable evaluation_comparison_snapshot envelope**. No schema migration; old outcome-only snapshots/APIs remain unchanged and do not automatically display the new payloads.
- Canonical enrollment membership, one dataset and correct baseline/mode policy binding. Selects each enrollment's latest observation and only its exact fact. Never falls back to an earlier convertible fact.
- Expected evaluation/holdout slots determine outcome denominators; missing enrollment/observation/fact and nonconvertible/failed/cancelled/unknown/unavailable records remain visible. Numeric comparison is withheld unless every expected slot converts and the metric contract matches. No selected-subset performance average masquerades as cohort improvement.
- Only the real stored-fact converter produces creation receipts; no raw trial/quality/time/source authority accepted from caller. Snapshot is bounded to1MiB, dataset64cases and64enrollments per arm. Fixture provenance remains explicit; promotionEligible:false and improvementProven:false always.
- Historical read verifies source row identities/payload digests and recomputes saved trial numeric fields, composition identity and exact handoff cost partitions without capture/evidence/provider callbacks. Later billing or unavailable external evidence does not rewrite the original result. Changed/corrupt immutable source bytes refuse read.
- Inspect returns historical result plus unchanged/changed/unavailable evidence status. It does not replace cohort members or re-run price-age/improvement evaluation at current wall time.
- Preflight before evidence callbacks, module-instance ledger-local reentry fence, data/schema/total_changes checks across capture and again under final IMMEDIATE write lock. Single-row insertion; concurrent callbacks/peer SQLite writes cause refusal. External callback mutations are not rolled back.
- Extracted content-only measured trial data/identity helpers from batch94 for shared current/historical reconstruction; they do not issue authority or bypass converter eligibility.

[API/semantics](../../../../docs/integration/MEASURED_COMPARISONS.md). Exact prior files are in preimages/. Unrelated dirty work was not reset.

## Verification and preserved failures

| Evidence | Result |
|---|---|
| build-pass1.log, build-pass2.log | build0 |
| focused-pass1.log / .exit |2files,43pass/1fail |
| build-pass3.log, focused-pass2.log / .exit | build0,16pass |
| build-final.log / .exit, regression-final.log / .exit | build0,33files296pass before final replay/shape hardening |
| replay-red.log / .exit | targeted1fail;18 filtered cases not executed |
| build-verified.log / .exit, regression-verified.log / .exit | **build0,33files296pass,0fail/skip,exit0**,218.41s |

First failure: a reentry fixture mixed src and dist module factories, creating separate module-local fences. It allowed a separately loaded source factory to create a nested snapshot, after which the outer compiled store correctly rejected concurrent changes. Corrected the fixture to exercise **two real Core instances sharing the production compiled factory**; no production fence weakening. This is not a claim of protection across arbitrary independently loaded code copies or against a host with unrestricted direct SQL access.

Self-review found an actual request bug: JSON.stringify converts NaN to null, so a NaN costLimitUnits could collide with an existing null-limit request hash and replay it. `replay-red-source.ts` plus targeted red log retain the reproduction. Fixed by rejecting nonfinite scalars before hashing. Also bounded request strings and rejected malformed falsy conversion/ref data on historical decode. One correction hypothesis for each bounded issue; no timeout relaxation or permanent skip.

The final19 new tests include:

- Full synthetic paired cohort:4cases (2evaluation+2holdout) ×2arms =8 saved conversions, actual Core→SQLite create, numeric cost/time comparison, exact replay/reopen and no new approvals/captures.
- Missing facts/observations/quality, an omitted enrollment, and different metrics preserve complete denominators and withhold partial numeric comparison.
- Newest observation without a fact does not resurrect the earlier fact; revised final billing leaves historical numbers unchanged but current inspection changes.
- Absent evidence is a retained unavailable slot; absent host/foreign workspace/hostile input/duplicate membership/replay conflict refuse appropriately.
- Recomputed conversion/snapshot hashes cannot conceal a changed numeric trial; source bytes/scalars and malformed references are revalidated.
- Same-connection writes, a real separate SQLite connection, outer transactions and compiled-factory callback reentry cannot silently insert a mixed snapshot.

All new execution/activity/receipt/consent authorities are **synthetic fixtures**, with test-only launch/identity/handoff guard removal and synthetic terminal verification. The paired positive cohort uses recorded failure outcomes, not live successful provider acceptance. Its costs/times are test inputs, not actual quality/efficiency gains. No Electron UI was exercised.

`summary.json` reconciles33 selected files against executed rows (missing/unexpected0). Earlier passing runs overlap and are not added to296. The filtered red invocation's18 nonselected cases are not new permanent skips. Final verification has0skips. This is not a current whole npm test; last whole-suite evidence remains batch89 before90–95.

## Remaining

- Dedicated bounded measured-snapshot listing, safe IPC projection and UI creation/history/current-status rendering. Existing outcome-only UI is not advertised as connected.
- Production executed-input/quality/time/environment/account/price/cost producers and default app measurement-host composition.
- Representative user baseline/paired four-mode holdout observations and current provider/cleanup/final billing qualification with renewed call scope/budget where needed.
- Fresh full regression, independent review and final release acceptance.

This completes the bounded durable comparison backend, not an original parent item, production measurement workflow or proven improvement.
