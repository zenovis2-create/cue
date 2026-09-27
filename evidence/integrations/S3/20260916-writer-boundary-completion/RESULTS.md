# S3-03 writer boundary completion results

## Kept change

The orchestration driver classifies the complete action vocabulary immediately before adapter launch. Empty, `read`, `list`, and `search` stages retain their read-only route. `file_change` retains the attempt-owned existing-file staging and final-publication route. `command`, `write_stdin`, unknown effect actions, and mixed `file_change` plus an unsupported effect action are rejected before staging registration or candidate launch.

The production change is three lines in `app/orchestration-driver.mjs`. The fixture now declares its stage actions explicitly and four regression cases prove zero launches, zero staging opens, zero staged reads, zero publication writes, and unchanged approved-root bytes for command, write-stdin, unknown shell, and mixed file-change/command stages.

The existing named native publication cases remain in the same focused gate: duplicate/resend publication remains zero, the stale loser cannot overwrite the winner, and reopen reconciliation preserves the winner.

## Measured gate

- Hypothesis 1 pass 1 failed because the parameterized test supplied an array where the test body expected an object. No product failure was involved. Raw output: `batch75_h1_pass1.log`.
- Hypothesis 1 pass 2 passed: 2 files, 30 tests, 0 failures. Raw output: `batch75_h1_pass2.log`.
- The final post-build rerun passed the same 2 files and 30 tests with exit code 0. Raw output: `final-focused-gate.log`.
- The coordinated root TypeScript build passed after source freeze.

This evidence closes the bounded original S3-03 invariant for the default orchestration driver and its native existing-file publication path. It does not claim that legacy standalone execution is staged, that arbitrary shell effects can be isolated, or that S3-01's real-workflow requirement is closed.

## Separate failed-clean investigation

A failed-but-clean staged execution reaches the driver's deferred finalization object. The attempted discard cleanup then fails at durable persistence: migration `047_attempt_staging_authority.sql` permits only create-failed/create-unknown/active-cleanup-verified/active-cleanup-unknown results, and its trigger requires committed publication rows for active-cleanup-verified. A failed execution intentionally has no publication rows.

The sound correction therefore needs a distinct durable discard result with verified/unknown states and corresponding migration trigger and lease-release semantics. The two capped implementation passes and two diagnostic runs are retained in `batch75_h2_pass1.log`, `batch75_h2_pass2.log`, `batch75_h3_diag.log`, and `batch75_h3_diag2.log`. All experimental cleanup API, driver, and test changes were reverted. `daemon/src/orchestration/staging-authority.ts` is byte-identical to its preimage.

## Final pins

- `app/orchestration-driver.mjs`: SHA-256 `1EBC106A7EF14C3B2E1C79A1BA839752BD0FFC9B35C4647F78EC9AE28E80AB73`; Git object `13801bc63c1a210d41a3df1e1b811f9e123d9503`.
- `app/orchestration-driver.d.mts`: SHA-256 `A7081DDE45F57C229CCD763C987B43659872AC642919CFC2035D3F17BBE0D9BE`; unchanged.
- `daemon/test/integration-driver-publication.test.ts`: SHA-256 `F8F0C32E10AAAEA5D6F070FED68653725A6D867504BF93D0385B6ED60A094496`; Git object `4a0adbeaaf9abe020e6e03ca626adbc3128f1eb6`.
- `daemon/test/integration-orchestration.test.ts`: SHA-256 `04AB9851CB1E1168797D51AFFA03D3A612A5BDF98F1A04A22FE148EAC9ADE389`; unchanged.
- `daemon/src/orchestration/staging-authority.ts`: SHA-256 `26D1F0D968785E0613BDC1D2E828C2F85DACDEFA1D481CFA474140D1F336AA57`; unchanged.
