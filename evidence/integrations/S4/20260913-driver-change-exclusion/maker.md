# Maker record

The production driver now treats `unknown`, `outside-manifest`, `moved`, and `type-changed` change observations as unsafe and blocks with `change_observation_unknown` before retry or recovery processing.

The actual-driver regressions use the real SQLite ledger, orchestration store, and change-record implementation. The negative case records a real `moved` observation after an owned target is replaced, then verifies one original launch, zero recovery decisions, no added revision, and retained unresolved lease/evidence. The positive control records `modified` after an in-place write and reaches the existing downstream evidence gate, proving the new exclusion does not block that allowed status.

Gate: `npm exec vitest run -- test/integration-change-records.test.ts test/integration-driver.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`

Result: exit 0, 41/41 tests passed. Independent checker review is required before completion.
