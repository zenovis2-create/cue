# Maker handoff — S3 parallel wave task timeout

Status: implementation behavior verified through the assigned assertions; maker cap 2 exhausted on a one-line test return-value oracle.

## Change

- `runParallelWave` now returns `completed`, `failed`, or `timeout` so `drive` preserves `orchestration_evidence_unverified` for execution/evidence failures and reports `orchestration_timeout` for actual `taskTimeoutMs` expiry.
- Added unknown-cleanup coverage proving two started/aborted/cancelled readers, no verifier, exact two unresolved attempt IDs, 20 retained reservation units, and `settled`/`close` refusal.
- Added verified-cleanup coverage proving the workflow stays blocked/unverified, both attempts have `cleanup_verified=1`, no verifier starts, and close is permitted.

No retry absolute deadline is claimed: supported parallel configuration has no retry and its general `effectiveDeadline` is null.

## Passes

- Pass 1: build exit 0; tests 69/70. Only failure expected `cancelled` attempts, while this fixture durably records clean cancellation as `completed` with `cleanup_verified=1`.
- Pass 2: build exit 0; tests 69/70. The corrected attempt-state assertion passed. Only failure is `await expect(f.driver.settled()).resolves.toBe(true)`: `settled()` fulfills with `undefined`.

The required root/checker correction is one test-only oracle change: use `resolves.toBeUndefined()` (or await fulfillment without a value assertion) in `closes a task-timeout wave after verified cleanup without verification success`, then run the same full gate. No production correction is indicated by the pass-2 failure.

Raw outputs and exit-code files are under `logs/`. Full preimages and SHA-256 pins are under `preimages/` and `preimage-hashes.json`.

## Observed limits

Injected runtime and real SQLite only. No provider/network/native/OS/live Electron, restart, throughput, retry deadline, or broad S3 qualification.
