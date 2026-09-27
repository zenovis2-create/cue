# Exploration consent driver maker record

## Plan and completion gate

- Done: daemon build exits 0; driver/local/exploration-budget/exploration-engine/initial-default focused gate passes; explicit consent is separate from the budget grant and exact task membership reaches dispatch.
- Attempt cap: 3.
- Every pass: build when production changed, then the focused Vitest gate.
- Failure response: revise only with a new failure-specific hypothesis; hand off after pass 3.

The plan was stated before editing in the task commentary. Full preimage copies were not captured before the first edit; this workflow miss is retained here and no preimage is reconstructed or claimed.

## Result

- Pass 1: build 0; focused 109/111. The new SQL trigger named a nonexistent plan-step table, and a negative test accidentally used sorted valid membership.
- Pass 2: build 0; driver 65/66. Production and consent paths passed; the remaining failure was a test query reading `task_id` from the budget reservation table.
- Pass 3: focused 111/111 across 6 files. The query now joins `orchestration_attempt` by the persisted attempt ID.

The driver accepts only exact frozen host exploration input, binds its budget grant during prepare, exposes a bounded frozen summary, and requires `approveExploration(runId)` inside the Core-owned approval transaction. Migration 042 stores immutable consent bound to run, envelope, policy, plan, authorization digest, candidate, and sorted task membership. Activation requires exact consent. Serial and parallel request constructors attach the engine flag only for approved task IDs; retry preserves that construction, while exploration switch/replan inputs fail before recovery mutations.

Direct new tests cover serial membership, an ordinary unflagged verifier, dual charge once, inert grant, missing consent, transaction requirement, idempotent consent, immutable storage, conflicting initial default, and invalid membership. Parallel and retry propagation are source-covered and their existing engine/recovery regressions remained green, but this unit did not add a driver-specific positive parallel or retry scenario. It makes no live billing, provider, native, Electron, or product-completion claim. The local model remained off and was not called.

## Evidence

- `build-pass1.log`, `focused-pass1.log`
- `build-pass2.log`, `driver-pass2.log`
- `focused-pass3.log`

## Final SHA-256

- `f9156eed56a5ec705d96bbff7ee2778d3cb2ce6093e75fe16372e97b78dc4840` app/orchestration-driver.mjs
- `b7bd7e9d1692b3b8ee059959f16812948a77e698256fc2390c2f837230d991f8` app/orchestration-driver.d.mts
- `7c47ed3bc2144e9c50846941ad3ba81392c3ff07aa692c02a16d7c8cf544d68b` daemon/migrations/042_exploration_consent.sql
- `40d394413320416cdb8ff706077b3edf1f19fef1698f44a9c387b335589d53fc` daemon/src/ledger.ts
- `9d5d61c57118c6f946cb6f59b74e498261445eea43bee338d1d8854ce8e5510b` daemon/scripts/copy-assets.mjs
- `1d3ffdfc5a4e4ae82263ea474d023f4bee044d991e604443f84e91b037556321` daemon/test/integration-driver.test.ts
