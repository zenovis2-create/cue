# S3 parallel wait-response delivery — bounded maker plan

## Measurable done

- Two concurrently held reader attempts receive only their own identity, durable reference, and response bytes through the host delivery callback.
- Replaying either response, including after reopening the driver, does not resend it.
- A stopped, cancelled, closing, or closed driver does not begin a host delivery, including when authorization synchronously stops the driver during the durable claim.
- The durable claim remains unresolved whenever no host delivery was observed; a delivery already sent and positively acknowledged may still be recorded after a later stop.
- Existing serial, retry, local, parallel-wave, and request-queue contracts remain passing.

## Attempt contract

- Maximum implementation passes: 2.
- Every pass: from `daemon`, run `npm run build`, then `npx vitest run test/integration-driver.test.ts test/integration-request-queue.test.ts test/integration-driver-core.test.ts test/integration-local-driver.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`.
- Preserve complete raw build/test output and exit codes under `logs/` beginning with the first execution.
- A failed pass requires a new concrete hypothesis. Roll back a regression or hand off after pass 2; do not repeat the same approach.

## Bounds

- Implementation files owned: `app/orchestration-driver.mjs` and `daemon/test/integration-driver.test.ts`; evidence is confined to this directory.
- Use real SQLite and the injected runtime fixture. No provider qualification, network, native, Electron, local-model/server call, commit, or push.
- Keep claim-before-external-effect ordering and do not redesign the request store.
