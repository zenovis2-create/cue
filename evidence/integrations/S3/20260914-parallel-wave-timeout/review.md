# Independent review

## Checker contract (recorded before execution)

- Candidate pins: `app/orchestration-driver.mjs` SHA-256 `883F32435493ECDD5F189666C382FCA8567AAFA9D05C084CB1A9436899934FBD`; `daemon/test/integration-driver.test.ts` SHA-256 `8027498D34D1330791FFC640C328C23BDF625248ABC9F187EB69290BBBBDB7DC`.
- Review the final source against the maker's full preimages and verify the root correction is exactly the declared one-line `settled()` expectation change.
- Production must distinguish parallel `taskTimeoutMs` expiry from evidence/control failure without treating it as an absolute retry deadline.
- Timeout must remain the first task reason through cancellation/close. Trusted synthetic completed + clean receipts may leave attempts completed and cleanup verified while the run remains blocked and acceptance unverified. Unknown cleanup must remain unresolved and make `settled()`/`close()` refuse completion.
- Run once: `npx vitest run test/integration-driver.test.ts test/integration-local-driver.test.ts test/integration-driver-core.test.ts test/integration-request-queue.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` from `daemon`.
- Attempt cap: 2. On failure, retry only after a different evidence-based hypothesis and record both attempts. Otherwise issue BLOCKED; do not broaden scope.

## Result

PASS.

- Final SHA-256 values matched `root-final-pins.json` exactly for both changed files.
- Production diff against the full preimage is limited to replacing the parallel wave boolean with `completed | timeout | failed` outcomes and mapping only `timeout` to `orchestration_timeout`. Parallel admission remains non-local, manual recovery, and without retry, so this does not claim an absolute retry deadline.
- Test diff against the full preimage adds two bounded parallel-wave fixtures. The unknown-cleanup case proves two launches, two cancellations, both aborted signals, the exact two unresolved attempt IDs, 20 reserved units, no verifier launch, and refusal by both `settled()` and `close()`. The trusted-clean case correctly records two synthetic completed receipts with `cleanup_verified=1`, while the orchestration task remains blocked for `orchestration_timeout` and acceptance remains unverified.
- The root correction is exactly one line against `root-oracle-fix/integration-driver.test.ts.preimage`: `resolves.toBe(true)` became `resolves.toBeUndefined()`, matching the `settled()` contract.
- First-cause retention is sound: `block()` only updates running/awaiting/queued tasks, so later stop/close cancellation cannot overwrite the already blocked `orchestration_timeout` reason.
- Independent gate attempt 1 exited 0: 4 files passed, 70 tests passed, duration 24.48 s. No retry was used.
- No blocker, security defect, maintainability defect, or material untested regression was found within the assigned scope.
