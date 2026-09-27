# Independent review — staged initial-selection baseline

Verdict: **PASS as a prerequisite fixture only**.

The new fixture uses the current real selection policy/run binding, monetary budget manager, orchestration store, orchestration engine, and a valid implementation/verifier plan with requirement coverage. It establishes a usable starting point for later bounded layers:

- First start selects the existing eligible candidate, claims the attempt, reserves 40 ordinary units, writes immutable `attempt_selection`, performs one concrete preparation artifact write, retains the engine-owned writer lease, and launches once.
- Exact replay returns `not-relaunched` and does not repeat candidate observation, authorization, reservation calculation, preparation, durable artifact insertion, or launch.
- Injected synchronous preparation failure occurs after the artifact mutation. The surrounding real engine transaction rolls back the claim, ordinary reservation, activity, attempt-selection row, preparation artifact, and writer lease; launch remains zero.
- An unavailable candidate is denied before authorization, reservation, preparation, or launch.

The revision-1 fixture passed but its preparation rollback assertion was partly vacuous. Final revision 2 adds a concrete in-transaction preparation mutation before failure and an explicit reservation callback count. This is the measured improvement retained for review.

## Pins and gates

- Fixture SHA-256: `b900703c03718b24e4efd90734282cad879599ed98a4764b9a9bdff2f196b949`.
- Baseline test SHA-256: `430700fb5eb898fa61d89226975f0042591ba457d3167cee9b04ed845fb5687f`.
- All final maker source/log pins matched. Maker revision 2 build exited 0 and its three-file gate passed 22/22.
- Independent command: `npx vitest run test/integration-initial-selection-baseline.test.ts test/integration-engine.test.ts test/integration-budget.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`.
- Independent result: exit 0; 3 files passed; 22/22 tests passed.
- Raw independent log SHA-256: `5c6aa2a55d6a636d0d49d385461bb29536a6bf90a2284f7ccb6800309f3dee47`.
- Independent exit receipt SHA-256: `c1e97067c5f479a44a6f57297a0a8f87a59d181c3c529910f8bf059094bc3abb`.

## Scope boundary

No product file changed in this prerequisite. The fixture does not implement or prove a cold-start default, trusted baseline ingestion, no-statistics observation, exploration authorization, exploration subcap, dual accounting, new migration, historical provenance, UI, or production host behavior. It grants no provider/model/native/Electron/server/network qualification and does not complete the still-open checklist item.
