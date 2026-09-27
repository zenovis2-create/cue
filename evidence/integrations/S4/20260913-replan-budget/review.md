# Independent review — replan cumulative budget and requirements

## Verdict

**PASS for the backend invariant.** Together with the previously reviewed recovery-claim-limits evidence, this closes the exact checklist row “재계획에도 누적 예산/시도 한도와 원래 요구사항을 유지한다” at the real SQLite/store/engine boundary. Broader S4 and live execution remain outside this result.

## Frozen evidence

- test: `27312DA2E900C9DEEF678CF0806F9423E3CC2F28E161A9F45DFB2C6AD6079530`
- static handoff plan: `BDE6B1BED169E45FD9149070BC78CC473AE93358D95CF2DCD0560B908315FDBB`
- maker result: `8AC63A5A4E0599D09F8FAC70B0D9707D8698AC0C4B5C3F43D6122DF6F871ABD3`

Independent command, from `daemon/`:

```text
npm exec vitest run -- test/integration-replan-budget.test.ts test/integration-retry-backend.test.ts test/integration-recovery-policy.test.ts test/integration-recovery-claim-limits.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
```

Result: **4 files, 24/24 tests passed**. Scoped `git diff --check` passed. No production source changed.

## Findings

The test uses `createOrchestrationEngine`, the production orchestration store, recovery policy, stage binder, budget manager, and a migrated temporary SQLite ledger. Initial and revised engine requests carry exact revision and plan-digest authority, and stage bindings receive the same lineage. The initial engine start commits a 40-unit reservation. The exhaustion case then adds a distinct 60-unit fixture reservation using separate request and attempt IDs, accurately modeling committed capacity without claiming actual execution or billing.

When the revised 40-unit reservation exceeds the original 100-unit budget, `engine.start` rejects with `budget_limit_exceeded`. The surrounding immediate transaction rolls back the already attempted claim and leaves no replacement attempt, recovery activation, stage envelope, or selection; the injected runtime remains at one call for the original attempt. The budget summary remains the original 40 plus the explicit 60-unit contention reservation.

The affordable branch commits 80 cumulative units across the original and revised attempts, starts the revised runtime exactly once, and exact replay reports `replayed:true` without another reservation or runtime start. This proves replan does not reset the original budget.

Changed approval and removal of every task requirement are exercised as independent calls. They fail at `replan_authority_changed` and `invalid_plan:array-size` respectively, add no revision, and leave both revision zero and the valid revision-one record readable and unchanged. A nonempty substitution that omits the original approved requirement was not separately runtime-tested; `appendRevision`'s explicit original-requirement coverage check was inspected in source. The companion recovery-claim-limits review independently established deadline and cumulative attempt-cap enforcement after a persisted decision, including a final callback clock change.

The original fixture approach exhausted its cap on SQL syntax and missing revision/stage bindings. A separately authorized static-audit handoff identified the full fixture contract before edits. Its first pass reached 23/24 because removed empty requirement arrays fail at `invalid_plan:array-size`; the second changed only that expected error and passed 24/24. These were fixture corrections, not production defects.

## Scope

The runtime boundary is injected and inert. The 60-unit contention record is fixture-created committed capacity, not provider spending, actual billing, or a final receipt. No native helper, model/provider, network, live workflow, shared build, or full driver dispatch ran. The checklist closure is therefore specifically the backend persistence and admission invariant; it is not a claim that every S4 workflow is complete.
