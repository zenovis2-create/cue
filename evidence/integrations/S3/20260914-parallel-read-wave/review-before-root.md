# Independent review — S3 parallel read wave

Verdict: **BLOCKED; no product change retained**.

Scope reviewed: `app/orchestration-driver.mjs`, `app/orchestration-driver.d.mts`, `daemon/test/integration-driver.test.ts`, the orchestration engine/runtime/store and stage-envelope contracts, and the maker's two bounded attempts. I made no product or test edits.

## Disposition

🔴 **There is no stable candidate to approve after the bounded maker rollback.**

Attempt 1 had a real control-path gap: the wave cleanup path awaited each original `startPromise` before obtaining an `EngineAttempt` and calling `cancel()`. During a provider launch that had not returned, this delayed the engine ownership abort until launch release/timeout.

Attempt 2 used the established replay path to obtain a control handle bound to the same attempt ownership. Exact engine/runtime review shows that this is the appropriate prompt-control mechanism: `EngineAttempt.cancel()` aborts the ownership controller immediately; runtime `onAbort` resolves the pending start path while no adapter execution object exists yet; when that deferred launch later returns, runtime observes the already-aborted controller and calls the adapter cancellation path.

The attempt-2 test was therefore wrong to require the injected provider's `AdapterExecution.cancel()` count to become 2 *before* releasing the deferred provider launches. At that point there are no adapter execution objects to cancel. The fixture should instead assert that both runtime context signals are aborted and the engine start/control promises settle promptly before launch release, then release the late launches and assert exactly one adapter cancellation per execution. The preserved 64/65 result at `integration-driver.test.ts:248` is evidence of this invalid oracle, not evidence that attempt 2 lacked prompt cancellation.

Because the maker's two-attempt cap was exhausted and all changes were rolled back, attempt 2 is no longer available for a final independent gate. A fresh bounded plan should restore the replay-based attempt-2 source, replace the invalid early adapter-count assertion with signal/start-settlement evidence, retain the late exactly-once adapter-cancel assertion, and then run the focused driver/local-driver/core/request-queue gate.

## Evidence and disposition

- Attempt 1: build 0, focused 65/65, but its stop test released pending launches before asserting cancellation and therefore missed the defect.
- Attempt 2: build 0, focused 64/65; its sole failure expected 2 adapter cancellations before adapter executions existed. Exact runtime semantics invalidate that expectation.
- The two-attempt maker cap was exhausted. The maker restored all three owned files byte-for-byte from full preimages.
- Current SHA-256 values match `preimage-hashes.json`: driver `D0F1E7835434FB6764CC6583A36EAC5EF19742170D33E40079F91EDF701AAFED`, declaration `053F1138E07705839FF283B8433E5A3E647922E98B12122DA54612489FC9A2A0`, test `34A75701B8857C719CDC0C58FF068B56C7EAE5BCBE28FC5A42D12AD930610534`.
- I did not run an independent focused gate because root never declared a stable candidate and the maker explicitly reported rollback. Repeating the passing baseline build would not validate the rejected feature.

The existing serial retry, recovery, local, wait-response, engine, budget, admission, and stage-envelope behavior remains at its preimage bytes. No product defect is established against the rolled-back baseline, and no parallel-wave implementation is approved. This review makes no real-provider, native/OS, Electron, throughput, or broad S3 claim.
