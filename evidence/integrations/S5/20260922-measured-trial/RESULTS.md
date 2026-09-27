# Batch94 — stored measured fact to descriptive trial

2026-09-22. Direct implementation/self-review; independent review pending. Real provider/model/account calls0. Qwen OFF; subscription allowance4/4 spent. No credentials, user-home changes, publication/commit or exhausted actual GUI gate retry. Original checklist33/44 closed,11 open.

## Delivered

- New `daemon/src/evaluation/measured-trial.ts`: `createMeasuredTrialConverter(db,host).convert({factId})`. Reads/revalidates stored facts; caller cannot supply quality, cost, source, outcome, time or authority.
- Shared `readEvaluationTrialOutcome` in `trials.ts` reuses existing validated enrollment/observation/baseline policy logic without writing/upgrading a projection.
- `Core.convertEvaluationMeasuredTrial({factId})` plus declaration; host presence/current workspace preflight before evidence callbacks. No new renderer IPC, no automatic collection, no approval, no migration/table writes.
- Complete input/measurement context, explicit0..1 metric, full queue/execution/cleanup clock scope, known revisions, all planned tasks/verifier execution, settled execution and final monetary billing with exact base/retry/verification/handoff partition are required. Missing/unsupported/unknown measurements return `status:insufficient`, `trial:null`, reasons; corrupt evidence/lineage raises an error.
- Final partitions use BigInt sums, require original total equality and safe integer output. Local dispatch counts are not converted to money. A newer accounting inventory/receipt or changed terminal outcome blocks current conversion of the old fact.
- Preserves fail/cancelled/unknown as those outcomes. Fixture source remains fixture; host-observed is only as authoritative as the explicitly trusted measurement host. Every result has promotionEligible:false.
- Explicit versioned tool/model **combination identity** with full role/candidate/tool/model tuples, instead of selecting a misleading representative model. Digests identify that composition, not a newly measured supplier revision.
- Deep-frozen result tied to fact/enrollment/observation/contracts/handoff partition/identity digests. It is a current derived result, not a persisted immutable trial. Exact stable replay/reopen is deterministic.
- Same-ledger reentry refused. Read stability checked using total_changes/schema_version/data_version before/after synchronous validation; local/second-connection changes reject the result. This is optimistic validation, not atomic OS evidence capture or rollback of external callback side effects.

Existing stored fact trialReady:false, outcome-only trial:null, evidence UI and comparison snapshots retain their original semantics. The converter does **not** automatically insert its outputs into a cohort or upgrade existing descriptive rows.

## Tests and corrections

| Evidence | Result |
|---|---|
| `build-pass1.log` / `.exit` | build0 |
| `focused-pass1.log` / `.exit` |19pass/1fail, foreign-workspace fixture attempted to UPDATE immutable envelope |
| `build-pass2.log`, `focused-pass2.log` / `.exit` | build0,25pass after fixture fix and extra revision/boundary cases |
| `build-final.log` / `.exit`, `regression-final.log` / `.exit` | **build0,32files277pass,0fail/skip,exit0**,120.84s |

The failed fixture was corrected by querying the unchanged ledger from a differently scoped Core, rather than weakening/dropping the production envelope guard. One correction hypothesis; failed log retained. Additional self-review checks reject unresolved writer flag/lease/running task despite completed attempt rows. No test weakening, skip or timeout increase.

28 new tests exercise real Core/SQLite/read-only conversion, unchanged data and no host recapture, cost sum50=base15+retry0+verification25+handoff10, offline replay/reopen, fixed-plan baseline declaration, failure/cancellation/unknown preservation, host provenance label separation, missing quality/time/input/partition/cost/revisions, unsupported domains/incomplete contexts, newer receipts/outcomes, evidence drift/stored tamper, absent host/foreign workspace/hostile shapes, callback reentry, and actual second SQLite connection commits during validation. Positive conversion feeds the existing `createEvaluationStudy(...).record(...)` schema successfully.

All measurement/receipt/activity/native-integrity authorities in the new tests are **synthetic**. Launch/identity/handoff fixture rows deliberately use test-only removed insert guards and a synthetic terminal verifier; this is not native/provider qualification. Positive recorded workflow outcomes tested are fail/cancelled/unknown, not a real provider's successful acceptance. No actual performance/quality improvement or live user choice is asserted.

The final32 selected files are reconciled to executed rows in `summary.json`/`test-files.txt` (missing/unexpected0). Earlier test runs overlap and are not added to277. This is not a new whole npm test; last whole-suite evidence is batch89 before90–94.

## Remaining

[API/semantics](../../../../docs/integration/MEASURED_TRIAL.md).

1. Production execution-input/quality/time/environment/account/price/cost producers and default-app measuredFactHost composition.
2. Explicit cohort membership and durable comparison snapshot/UI integration of conversion results, preserving nonconvertible cases, failure denominators, source distinctions, price freshness and paired holdout coverage. Do not accept a caller-supplied conversion DTO as measurement authority.
3. Representative real user baseline/paired four-mode holdout data, current provider/runtime qualification and authoritative cleanup/final billing after renewed live-call scope/budget where necessary.
4. Fresh full regression, independent review and release acceptance.

This closes a backend code gap, not an original checklist parent or the entire measurement workflow.
