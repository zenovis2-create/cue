# S3 parallel wait-response delivery — maker handoff

## Result

Confirmed and fixed a post-claim cancellation race in `deliverWaitResponse`. The durable SQLite claim intentionally occurs first. Before beginning the host effect, the driver now requires a prepared, non-cancelled, non-closing owner and rejects an attempt whose cancellation control has begun. Claims refused at that fence remain durable and unresolved with no fabricated delivery observation.

The implementation change is one driver condition. Fixture/test changes prove:

- two held readers receive only their own attempt ID, identity ID, durable reference, content reference, digest-bound bytes, and acknowledgement;
- reopening and replaying both committed deliveries does not resend either response;
- synchronous stop during claim authorization commits the claim but invokes the host zero times and writes no delivery observation;
- timed-out parallel attempts with running durable rows and active cancellation controls invoke the host zero times;
- a valid acknowledgement arriving after a host delivery already began is still recorded as delivered even if Stop follows.

## Attempts and evidence

- Pre-fix decisive reproduction: `logs/reproduction-prefx.log`, exit 1. The cancellation oracle observed a host call; a separate routing fixture assertion raced handle publication, and the close oracle incorrectly expected verified cleanup. Both historical failures are retained.
- Focused candidate run: 3 new scenarios passed; this was diagnostic, outside the two full implementation passes.
- A preliminary build before the `active.control` finding is retained as `logs/prepass-build-before-control.log`, exit 0; it is not counted as a completed pass because the candidate changed before its paired full test gate.
- Pass 1: build exit 0; full gate exit 1 with 72/73. The only failure was `wait_attempt_unavailable` because the timeout fixture emitted trusted terminal receipts before creating the wait.
- Pass 2 used the new hypothesis `finish=false` to retain the intended running durable attempt without a receipt. Build exit 0; full gate exit 0 with 73/73.

Required command:

`npx vitest run test/integration-driver.test.ts test/integration-request-queue.test.ts test/integration-driver-core.test.ts test/integration-local-driver.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`

## Limits

This is real SQLite with an injected runtime and synthetic host delivery. It does not qualify a provider, OS/native path, Electron, restart delivery to a reconstructed live handle, or the deferred local model/server. A durable unresolved claim is intentionally not retried automatically after reopen because doing so could duplicate an unobserved external effect.
