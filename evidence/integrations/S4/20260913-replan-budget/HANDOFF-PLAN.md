# Replan budget fixture static audit and correction plan

## Completion contract

From `daemon/`, run one combined gate:

`npm exec vitest run -- test/integration-replan-budget.test.ts test/integration-retry-backend.test.ts test/integration-recovery-policy.test.ts test/integration-recovery-claim-limits.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`

The corrected fixture must use the actual engine, orchestration store, recovery policy, stage binder, budget manager, and SQLite ledger with an inert injected runtime. It must prove cumulative budget exhaustion rolls the revised admission back before runtime start; an affordable revised attempt starts once and exact replay neither relaunches nor reserves again; changed approval and removed requirements are rejected independently without changing revision zero.

This distinct static-audit approach has a correction cap of two. Every pass runs the combined gate. A failure gets one source-supported fixture correction; a second failure is handed back with its exact exception and persisted state. No product source, native helper, model/provider, live runtime, or build is involved.

## Complete static API audit

- `EngineRequest` accepts revision authority only as a paired `revision` and `planDigest`. Because `registerScope` exists before the initial start, the initial request must carry `revision: 0` and the original plan digest; revised requests must carry revision 1, the appended digest, and the recovery decision ID.
- `createOrchestrationEngine.start` places the request revision on the attempt claim, then invokes `prepareExecution` inside the same immediate transaction. The fixture's stage binder must forward `context.request.revision` and `context.request.planDigest` for both initial and revised stages. Any `finish` fallback that creates a missing stage must read and forward the attempt's persisted revision and matching revision digest rather than silently binding an unscoped stage.
- Engine reservations require exact run/request/attempt lineage. `integration_budget_reservation` is unique on both `(run_id, request_id)` and `(run_id, attempt_id)`. The capacity-contention reservation therefore needs a distinct synthetic request ID and distinct synthetic attempt ID. It has no attempt foreign key, so it represents fixture-injected committed capacity, not actual execution or billing, and must be described that way.
- The initial engine reservation commits 40 units. A separate 60-unit synthetic reservation then leaves no capacity; revised admission's attempted 40-unit reservation must throw `budget_limit_exceeded` within the engine transaction, leaving no second attempt, recovery activation, stage envelope, selection, or runtime launch. The successful branch commits 80 total across distinct first/second attempts and requests; exact replay finds the stored claim and reservation and must not relaunch.
- `finish` requires real stage provenance, attempt selection, launch intent, session identity, and receipt/handoff lineage. The fixture supplies each for the already claimed initial attempt; it must not forge revised completion because the tested revised path stops at start/replay.
- `appendRevision` checks approval equality before validating the proposed plan. Changed authority and missing task requirements must therefore be separate calls. Changed approval fails `replan_authority_changed`. A plan using the original approval but removing every requirement assignment is rejected by the earlier nonempty task-requirement validation (`invalid_plan:array-size`) before persistence. Both checks must prove revision zero and the valid revision-one record remain unchanged.
- The prior failed PLAN is retained. No prior RESULT file existed at the start of this handoff. The combined gate is the only execution after this audit.
