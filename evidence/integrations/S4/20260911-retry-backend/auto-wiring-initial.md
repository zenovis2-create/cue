# Retry migration automatic wiring — initial focused check

2026-09-11 17:20 KST. Parent added `applyOrchestrationRetryMigration(db)` after015 in openLedger outside nested migrations, and changed the legacy upgrade fixture to create actual001–015 directly. This keeps the compiled-helper upgrade test meaningful after automatic016 installation.

Build exited0. Command from daemon:

```text
npx --no-install vitest run test/integration-retry-backend.test.ts test/p5.test.ts test/integration-acceptance.test.ts test/integration-acceptance-history.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
48 passed / 1 failed, 4 files, exit1, 8.58 seconds
```

Failure: acceptance timeout test at line190 expected the host `aborted` marker true but observed false. The acceptance maker is diagnosing the timeout/callback ordering. Backend9, P517 and history7 passed. This run is not rewritten as success; a corrected focused result belongs in the connected review after source stabilization.
