# Fixture correction

Changed only `daemon/test/integration-driver.test.ts` in the test `rejects parallel configuration for local and automatic-recovery hosts before persistence`.

The local-host construction now preserves `f.host.engine` and supplies `maxRequestAgeMs: 1000`, satisfying the `createLocalOrchestrationEngine` constructor contract so `localDriver.prepare` reaches the intended `driver_parallel_read_unsupported` guard. Production source and the assertion are unchanged.

Preimage SHA-256: `DFB87A810B9E42CB709F36287E4E575F4260C3A59D75975A008E3ECD106B7F66`.

Final test SHA-256: `A73B4E608C560F181C23CB572616E778264E1C445D17A00392FF1A88DCC7E8FD`.

Gate (single attempt, from `daemon`):

- `npm run build`: exit 0.
- `npx vitest run test/integration-driver.test.ts test/integration-local-driver.test.ts test/integration-driver-core.test.ts test/integration-request-queue.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`: exit 0, 4 files passed, 68 tests passed.

Raw output is in `build.log` and `tests.log`; exact exit codes are in `exitcodes.txt`. The top-level `final-pins.json` retains the unchanged product hashes and records the corrected test hash.
