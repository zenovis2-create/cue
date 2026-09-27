# Initial-default engine maker receipt

## Result

The real orchestration engine now reads the immutable run-bound initial default, snapshots candidates and the optional host observation before callbacks can mutate them, and substitutes the configured conservative estimate only when the trusted observation says `no-statistics` and the configured default has an exactly null empirical estimate. A non-null empirical estimate with that disposition is rejected as contradictory. With no configuration, the old selection path remains unchanged and the initial hook is not called. With configuration and no observation, ordinary selection continues and an explicit `legacy-observation-absent` marker is stored.

The marker is written in the same immediate claim transaction as the ordinary reservation, preparation artifact, activity, and attempt decision. Configured replay validates the marker and lineage and performs no observation, authorization, reservation, preparation, or launch callback again. Synchronous preparation failure rolls all of those durable writes back.

Paid exploration and migration 041 remain unwired and unqualified by this receipt. The packaged 041 asset does not mean its schema is registered or used.

## Revisions

- Revision 1: build exited 0. The five-suite gate reported 37 passed and 1 failed because the test fixture's `eligible` truth source overrode the per-candidate check used by the denial oracle. Full candidate bytes are preserved under `preimages/revision-1`; raw logs are retained.
- Revision 2: fixed the eligibility oracle, rejected contradictory non-null empirical/no-statistics declarations, and completed candidate own-data validation before the hook. Build exited 0. The first compiled smoke command failed with a PowerShell quoting `SyntaxError` before opening a database; its raw log is retained. The corrected continuation exited 0 and opened a compiled ledger containing `initial_default`.
- Revision 3: no source changes after the checker found no blocker. The exact five-suite gate passed 39/39 with exit 0. Source is frozen at the pins below.

## Gate evidence

- `logs/revision-2-build.log`: `npm run build`, exit 0.
- `logs/revision-2-smoke.log`: preserved failed invocation, exit 1 (`SyntaxError` caused by command quoting).
- `logs/revision-2-smoke-continuation.log`: compiled `openLedger` smoke, queried `initial_default`, exit 0.
- `logs/revision-3-tests.log`: exact five-suite gate, 5 files and 39 tests passed, exit 0.

## Frozen source pins

- `daemon/src/orchestration/engine.ts`: `9e3d4edd2e6bf208f124418b283a2e0dcbe09b9c13cf7e155150ba82cf614cdd`
- `daemon/test/fixtures/initial-selection-ledger.ts`: `74a5b342605ad4b906b05624bca1e834d87db4955f7a22a442ee19ca41ac7856`
- `daemon/test/integration-initial-default-engine.test.ts`: `e5dd4dc0c674ed77a8261934eb6bed266ce0764deafe05235928dda11dd212b0`

The full original engine and fixture bytes, plus the new-test absence record, are under `preimages/` with the hashes declared in `PLAN.md`.
