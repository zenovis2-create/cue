Done: optional cap defaults to one; capped non-implementation ready tasks overlap; lifecycle cancellation, wait routing, dependency barrier, and failure containment pass focused tests.
Attempt cap: 2.
Every pass (from daemon): `npm run build`; then `npx vitest run test/integration-driver.test.ts test/integration-local-driver.test.ts test/integration-driver-core.test.ts test/integration-request-queue.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`.
Failure: retry once with a new hypothesis; otherwise hand to human.

Ownership mapping:
- app/orchestration-driver.mjs: configuration, wave scheduling, active-attempt lifecycle.
- app/orchestration-driver.d.mts: public configuration and approval types.
- daemon/test/integration-driver.test.ts: real driver/SQLite fixture coverage.
