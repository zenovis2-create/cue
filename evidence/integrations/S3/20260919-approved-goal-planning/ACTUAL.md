# Approved goal planning Core handoff: actual result

Core now has an opt-in planning owner on its existing ledger. `preparePlanningGoal` stores the exact goal-bound planning input before first approval; `approve` and `execute` route to that owner. The accepted-output reader requires a completed planning run, two distinct completed clean producer/verifier attempts, a passing final acceptance receipt, exact generated-output manifest provenance and bytes, and the trusted structural contract. `prepareGoalFromPlanningRun` then prepares a separate execution run and approval with the accepted proposal and pinned source tuple. The execution driver checks the Core-owned source at persistence checks and immediately before candidate launch. Deleted/changed source is denied. Core stop, close, completion, and report integrity route by owner; both owners must settle before the shared ledger closes.

The synthetic offline integration used the real SQLite ledger, admission/budget/orchestration/cleanup/acceptance code, and the host worker's two-stage planning producer/checker. It proved planning approval, generated observation and final acceptance, second execution approval, exact per-task instruction at an offline launch boundary, and the immutable output-observation trigger. A separate fresh-ledger case accepted a second planning run with identical proposal bytes but distinct producer receipt, then rejected swapping its source tuple both before second approval and after execute at candidate resolution. A third case persisted an `unknown` cleanup observation and rejected conversion before creating an execution run or launching the verifier. No fabricated cleanup was inserted. The earlier combined-case failure came from a tampered run holding the writer, so the cases use separate ledger instances.

Focused final command from `daemon/`: `npx vitest run test/integration-approved-goal-planning-core.test.ts test/integration-goal-planning-host.test.ts test/integration-goal-proposal-handoff.test.ts test/integration-driver-core.test.ts --reporter=verbose --no-color`. [focused-final-negatives.log](focused-final-negatives.log) records 4 files, 14 tests passed, exit 0. Root's build [build-final.log](../../planning/20260919-progress-reconcile-84/build-final.log) exited 0. Independent review is recorded separately by reviewer/root.

Frozen SHA-256 source/test pins:

| File | SHA-256 |
| --- | --- |
| `app/core.mjs` | `f4a94bc21d71bd4ba3985759416ba2394394a6071b39335fbb7a1392bdeba674` |
| `app/core.d.mts` | `dfed10881af408bb08974dbf15c514a595a9e2ec46219cfb52e0767207a1bc30` |
| `app/orchestration-driver.mjs` | `e2cb6fc8b5715cec416d9bd8357c5f2cea6cac6a25f50e10385795bd363af117` |
| `app/orchestration-driver.d.mts` | `d86c3c47ee862f1163e3a520be15a9361a10ece43c3ec7466c55242c3c4b4880` |
| `app/accepted-goal-planning-output.mjs` | `43d4f5ff6ef9cd13070543570eee41c7b8fb5b637f90fc06e02a6eb65c0d6bed` |
| `app/accepted-goal-planning-output.d.mts` | `44a62f260019f407baa68cc6bfbf6b9c2fad257066861a6cd20fb625d99a1e16` |
| `daemon/test/integration-approved-goal-planning-core.test.ts` | `87d38be4fff243c0ec725858f6ca47a932a685220babcc020b749532a9c8d67a` |

Limits: The default startup does not yet configure a qualified general execution host and planning host together. This offline fixture used explicitly synthetic lowest executor/admission inputs; no live model/provider/network call or cost qualification occurred. Valid execution dispatch deliberately stopped at the forbidden provider callback, so it does not prove an accepted implementation result or final publication. The planning structural checker accepts a bounded proposal for a second user approval, never claims the goal itself completed.
