# Maker closeout: cap exhausted, restart proof unproven

Scope was limited to the new real-process regression test, its synthetic child fixture, and this evidence directory. No existing driver, store, request-queue test, provider, native helper, Electron path, network path, recovery path, or cleanup authority was changed or exercised.

## Intended measurement

The first real Node child was intended to prepare, activate, and start an orchestration through the public driver, record a wait request and response through the public driver, commit a dispatch claim, enter an injected host callback that writes one append marker, and remain unresolved before acknowledgement. The parent would verify one claim and zero observations, terminate that exact owned child, await its exit, then start a fresh Node process against the same SQLite file. The second child would replay the exact response and assert `blocked-unresolved`, `newlyClaimed: false`, no callback invocation, one marker, one claim, zero observations, exact lineage IDs, and different PIDs.

## Revision ledger

Revision 1 created the test and fixture. The complete gate produced build exit 0 and test exit 1. All nine `integration-request-queue.test.ts` cases passed. The new restart case failed because the child closed before readiness; teardown also raced the already-closing process.

Revision 2 added the synthetic session-handle record required by the advertised durable reference and removed the teardown assertion on `child.kill()` while retaining exact owned-process termination and awaiting close. The complete gate again produced build exit 0 and test exit 1. All nine request-queue cases passed. The restart case again failed before readiness with `fixture_attempt_not_started`.

After the two-revision cap, source and checks were frozen. Subsequent read-only diagnosis identified the concrete mismatch: `app/orchestration-driver.mjs` requires runtime candidates to advertise `typedActivitySource: 'host-codex-controller-v1'` and `durableExecutionRef: 'session-handle-v1'`, while the child fixture advertises synthetic literal values. The driver rejects the candidate before launch, so it creates a running orchestration attempt but never records `orchestration_attempt_identity`.

## Verdict and handoff

The real-process restart guarantee is **UNPROVEN**. No successful callback, crash-window marker, process restart replay, or no-redelivery observation occurred. The preserved passing request-queue tests substantiate only their existing in-process store behavior.

A separately authorized correction should change the fixture's advertised runtime contract to the exact accepted source identities, rerun the full build and focused test gate, and retain evidence under a new correction contract. This capped run must not be relabeled as passed evidence.
