# Startup fence fixture correction plan

## Done

- Positive startup-fence fixture records the spawned child's observed Windows creation identity before persisting the session handle.
- Reused-PID negative fixture remains unchanged.
- No production matcher, termination timeout, or cleanup behavior changes.
- Focused gate after root GO: `npx --no-install vitest run test/p10c-core.test.ts -t "fences a verified|refuses to kill a reused" --reporter=verbose --fileParallelism=false --maxWorkers=1`.
- Attempt cap: 2 per hypothesis; a failed pass requires a new hypothesis or handoff.

## Exact preimage

- `daemon/test/p10c-core.test.ts`: `b452425820a9ee3e408b2556529abb820700799f703410a2eb419d2f7b8b7d46`
- `preimage-p10c-core.test.ts` is the pre-edit text copy (line endings normalized by apply_patch).

