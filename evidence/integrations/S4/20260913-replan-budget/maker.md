# Replan cumulative-budget maker result

Status: maker gate PASS; independent review pending.

- Exact gate from `daemon/`: `npm exec vitest run -- test/integration-replan-budget.test.ts test/integration-retry-backend.test.ts test/integration-recovery-policy.test.ts test/integration-recovery-claim-limits.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`
- Result: exit 0; 4 files and 24 tests passed.
- Test SHA-256: `27312DA2E900C9DEEF678CF0806F9423E3CC2F28E161A9F45DFB2C6AD6079530`.
- Static audit SHA-256: `BDE6B1BED169E45FD9149070BC78CC473AE93358D95CF2DCD0560B908315FDBB`.

The fixture now forwards explicit revision and plan-digest lineage through initial and revised engine requests, stage preparation, and the finish fallback. The budget-exhaustion case uses a distinct synthetic attempt/request reservation because the reservation schema makes attempt lineage unique. That reservation is fixture-injected committed capacity; it is not actual execution, provider spending, or final billing.

The exhaustion case leaves the initial 40-unit reservation plus 60 units of synthetic contention, rejects the revised 40-unit admission atomically, and records no second attempt, activation, stage, selection, or runtime launch. The affordable case reaches 80 committed units, starts the revised runtime exactly once, and exact replay neither relaunches nor reserves again. Changed approval and removed task requirements are independently rejected, and revision zero plus the valid revision-one record remain readable and unchanged.

## Attempt history

The earlier fixture maker reported three setup failures before this static-audit handoff:

1. Its first pass lost SQL syntax through a PowerShell-generated source edit.
2. Its second pass reached the real store but omitted the initial `EngineRequest` revision and failed with `explicit_revision_required`.
3. Its authorized correction added initial request authority but did not propagate it to the stage binder, producing `stage_explicit_revision_required`; the broader result at that point was reported as 21 related tests passing and all 3 new tests failing.

No raw command receipt for those earlier failures was present in this handoff, so this record does not invent one. The retained `PLAN.md` records the first two failures; this section preserves the reported third failure as well.

The new whole-fixture static-audit approach then used two passes. Pass 1 reached 23/24 tests. The missing-requirements call failed with `invalid_plan:array-size`, earlier than the source audit anticipated because `validateTaskPlan` rejects each empty task requirement array before reaching aggregate requirement coverage. Pass 2 changed only that exact expected error and passed 24/24. No production, native, model/provider, live runtime, or build action occurred.
