# S3 parallel wave task timeout — bounded maker plan

## Measurable done

- An actual `maxParallelReadTasks: 2` wave with two running readers exceeds `taskTimeoutMs`, cancels both attempt controls, launches no verifier, and reports `orchestration_timeout`.
- Unknown cleanup preserves the exact two unresolved attempts and summed budget reservations; `settled()` and `close()` refuse.
- If the existing fixture supports it without broad production change, verified cleanup permits terminal close while never producing success or verification.
- Existing serial, retry, local, automatic-recovery, and parallel-wave contracts remain passing.

## Attempt contract

- Maximum implementation passes: 2.
- Every pass: from `daemon`, run `npm run build`, then `npx vitest run test/integration-driver.test.ts test/integration-local-driver.test.ts test/integration-driver-core.test.ts test/integration-request-queue.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`.
- Preserve complete raw build/test output and exit codes under `logs/`.
- A failed pass requires a new concrete hypothesis. Roll back a regression or hand off after pass 2; do not repeat the same approach.

## Bounds

- Files owned: `daemon/test/integration-driver.test.ts`, optionally `app/orchestration-driver.mjs`, and this evidence directory.
- No retry absolute-deadline claim: general parallel configuration has no retry contract and `effectiveDeadline` is null.
- No local model/server probes, network, native provider, live Electron, commit, or push.
