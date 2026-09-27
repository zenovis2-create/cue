# Independent review: isolated model cleanup observer

Reviewer `/root/broker_review`, 2026-09-11. Product code read-only. **PASS for the corrected cleanup observer and tested runtime composition.** No Qwen request was made.

Final reviewed identities:

- `daemon/src/adapters/isolated-model-cleanup.ts`: `831767EF3E5779DE4AC637BC9526C443B7F495B5EC667366B2C41388E3417DD9`
- `daemon/test/integration-isolated-model-cleanup.test.ts`: `31769D9CB6271959B84D6D70FADA23A3B8D2049819BEAE9F07D0EFAB48CFEDFA`

## Finding and correction history

The initial observer compared mutable context identity only before awaiting the execution result and filesystem observations, then read receipt identifiers from the mutable context after persistence. Independent reproduction used a real SQLite ledger and synthetic trusted-host execution, changed `subjectDigest` during the result await, and produced `verified-clean` with observation digest `aaaa…` but receipt digest `bbbb…`. These synthetic frames were never qualification evidence or an actual model execution. Current integration runtime freezes its contexts, but the wrapper's public drift-defense contract and observation-to-receipt identity were still defective.

The maker used the remaining bounded correction to snapshot requested identity, assert unchanged identity before persistence and again after awaited persistence, and build the receipt from the immutable snapshot. The new test changes context during async persistence and requires rejection. Independent follow-up changes it during the execution-result await and requires rejection **before any observation is persisted**. The original defect is therefore resolved rather than hidden by changing test expectations.

## Independent verification

`npx --no-install vitest run test/integration-isolated-model-cleanup.test.ts test/integration-runtime-contract.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` in `daemon`: exit 0, **20 tests passed** (3 cleanup / 17 runtime), 5.88 s, start 18:11:11 local time.

The cleanup tests use actual Windows PowerShell/AppContainer/client/guardian processes with fixture transport and actual SQLite persistence. They cover both normal completion and cancellation, require all owned process/path observations absent, and verify that missing persistence prevents runtime settlement while a valid independent receipt permits settlement. Copied execution/context objects, changed identity, removed session rows, missing starts and failed evidence references cannot establish clean authority. Runtime admission evidence in this test is explicitly synthetic fixture data, not a real candidate qualification.

A separate reviewer Node stdin probe against the current source checked three failure paths with a synthetic trusted launcher seam: result-await identity drift rejects before persistence, a session query exception returns unknown, and missing/forged native identity returns unknown. Output: `{"status":"pass","resultAwaitDriftRejected":true,"queryErrorUnknown":true,"forgedNativeUnknown":true,"providerCalled":false}`. The maker reported final build exit 0; this review independently reran the tests above, not an additional full build.

## Authority assessment

- A private WeakMap records only executions returned by this wrapper's configured trusted launcher. It binds the exact context object, primitive identity snapshot and copied session identity. A structurally identical object is insufficient.
- The session lookup joins `session_handle` and `run` on matching run/task and checks every captured session field. Database absence or query failure cannot become a clean result.
- Protected native frame provenance comes from the separately reviewed host launcher/adapter. The observer checks distinct launcher/client/guardian PIDs, native child PID and creation-time token shape, AppContainer SID agreement, exact private profile name shape and task/profile paths under configured host bases. Model response text or the adapter's `cleanup` string is not used as cleanup authority.
- Process existence is observed independently with `process.kill(pid, 0)`; only `ESRCH` means absent. Filesystem existence is observed with `lstat`; only `ENOENT` means absent. The observer checks the task root, package `AC` directory and its package root. Any present item produces residual; unsupported/query errors remain unknown. No process is killed and no path is removed by the observer.
- Evidence persistence is mandatory and awaited. Empty/oversized references or persistence failure yield no receipt. Frozen receipts retain the requested run/subject identity; provider stop and billing remain unknown in stored observations.

## Limits and remaining integration

The host supplies the trusted launcher, ledger, base paths and durable evidence writer. This API does not independently audit an arbitrary host callback, establish new provider qualification, or inspect untrusted arbitrary frames supplied as though they came from that host. Native PID creation tokens support provenance; the observer conservatively requires PID absence rather than treating a reused or inaccessible PID as clean.

These tests show the real process observer connected to the integration runtime with fixture admission and model transport. They do not prove default application wiring, real live admission, failed-start cleanup without an owned execution, provider billing cessation or final task acceptance. A start that fails before the wrapper registers a valid execution remains unverified. Earlier native qualification and Qwen canary reports keep their original source/hash scopes.
