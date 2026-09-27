# Startup fence fixture correction results

## Change

The positive startup-fence fixture now observes the spawned PowerShell process through `observeProcessTree` and stores that root process's exact `createdAt` identity. It no longer substitutes a wall-clock timestamp captured before spawn.

Production recovery matching, termination behavior, wait bounds, forced cleanup, and the reused-PID negative fixture were not changed.

## Authorized focused gate

Command from `daemon/`:

`npx --no-install vitest run test/p10c-core.test.ts -t "fences a verified|refuses to kill a reused" --reporter=verbose --fileParallelism=false --maxWorkers=1`

Result: exit 0; 2 passed, 15 skipped, 19.03 seconds.

- Verified live session was terminated before startup reconciliation: PASS, 12.29 seconds.
- Reused PID with mismatched creation identity was refused: PASS, 5.99 seconds.

No broader test, build, provider, model, network, or live-budget call was run for this correction.
