# S3 real-process wait restart regression

Done is a passing `npm run build` followed by `npx vitest run test/integration-driver-real-restart.test.ts test/integration-request-queue.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`, with the first gate's raw stdout/stderr and exit codes retained under `logs/`.

The implementation budget is two revisions, including fixture corrections. Each pass runs the complete gate. A failure permits one revision only with a new hypothesis grounded in the saved output; a regression is not retained. The test uses two real Node child processes and one temporary SQLite file. It terminates only the exact child process it spawned, awaits exit, and removes only the resolved generated temporary root.

The measured guarantee is narrow: after a public driver commits a wait dispatch claim and enters an injected host delivery callback, process death before acknowledgement leaves one durable claim and no delivery observation; a fresh process reopening the same database returns the same response as `blocked-unresolved` with `newlyClaimed: false` and does not call the delivery callback again. The fixture is synthetic and makes no provider, native-helper, Electron, network, cleanup, recovery, or resume claim.
