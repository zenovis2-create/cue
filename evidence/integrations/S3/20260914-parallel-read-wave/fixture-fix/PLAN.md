Done: the local-driver fixture supplies the required positive `engine.maxRequestAgeMs`, so the intended parallel-configuration guard is reached; the exact build and four-file Vitest gate passes 68/68.

Attempt cap: 1.

Every pass (from `daemon`): `npm run build`; then `npx vitest run test/integration-driver.test.ts test/integration-local-driver.test.ts test/integration-driver-core.test.ts test/integration-request-queue.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`.

Failure: freeze immediately and hand off with the raw logs and exit codes; make no further edit.
