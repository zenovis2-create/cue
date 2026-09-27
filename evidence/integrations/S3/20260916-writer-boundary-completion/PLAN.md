# S3-03 writer boundary completion

## Hypothesis 1: complete action admission

Done means every stage action is classified before adapter launch. `read`, `list`, and `search` remain read-only; an empty action set remains valid; `file_change` requires the existing attempt-owned staging/publication contract; `command`, `write_stdin`, and any unrecognized effect-capable action refuse before candidate launch, staging registration, or native publication. The existing winner/stale-loser/reopen assertions remain green.

Attempt cap: two implementation/test passes.

Every pass runs the driver publication suite and named orchestration suite, then TypeScript `--noEmit`.

## Hypothesis 2: failed-but-clean staged lifecycle

Done requires a coordinator-owned, durable cleanup record for a failed-but-clean staged attempt, with no publication, no retry before verified cleanup, exact execution-root identity checks, idempotent reopen behavior, and no lease release on unknown cleanup.

Attempt cap: two implementation/test passes after the coordinator seam is explicitly owned. If the existing coordinator API cannot express discard cleanup, stop and hand off the required production change rather than duplicating authority logic in the driver.

## Exact preimages

- `app/orchestration-driver.mjs`: SHA-256 `391A3CC59FDBFA73978A6E6991EBA765092AE9C7248497DBC34EE4A3A07057BD`, Git object `8dd87cdc27ddd8a086fa1e5aa4a4519a2789bf02`.
- `app/orchestration-driver.d.mts`: SHA-256 `A7081DDE45F57C229CCD763C987B43659872AC642919CFC2035D3F17BBE0D9BE`, Git object `29ad932d92ca22793398f98a99518fe794ae45fb`.
- `daemon/test/integration-driver-publication.test.ts`: SHA-256 `B9943CB76EC51615C120F9E1CA9E40F843F1F27DE3FFF34E6B890F94B8948E20`, Git object `6e6f1c84375f947e40c677b7e1d59ddfb768acfd`.
- `daemon/test/integration-orchestration.test.ts`: SHA-256 `04AB9851CB1E1168797D51AFFA03D3A612A5BDF98F1A04A22FE148EAC9ADE389`, Git object `a93fa1a86f38d490d3a9f5fa89cd2b0b40112777`.
- `daemon/src/orchestration/staging-authority.ts`: SHA-256 `26D1F0D968785E0613BDC1D2E828C2F85DACDEFA1D481CFA474140D1F336AA57`, Git object `e2b1f968dc6b5ab219542898e18e8bdc6608bd5e`.

Whole-file preimages are stored under `preimage/`. Root owns shared builds and documentation.
