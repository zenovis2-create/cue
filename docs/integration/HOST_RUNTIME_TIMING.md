# Host runtime timing observation

`daemon/src/host-codex-runtime.ts` records a bounded, host-local duration for Codex runs that reach asynchronous settlement. It uses `process.hrtime.bigint()` rather than wall-clock subtraction.

## Boundaries

- Start: entry to `launchHostCodexRun`, before admission checks and controller setup.
- Phase boundary: entry to the ordered `finally` teardown, after execution and local goal-verification work (or its failure).
- End: return from `settleHostRuntimeTeardown`, including attempts that report errors.
- `executionAndVerificationMs` includes startup, native identity wait, execution, and local verification. It is **not** model latency.
- `localTeardownMs` is the remainder after subtracting the rounded-down first phase from the rounded-down elapsed duration. The two phases sum exactly to `elapsedMs`; phase rounding can differ by less than one millisecond.
- `localTeardownStatus` is `settled-without-errors` or `errors`. It reports the teardown procedure's result, not independent proof of process absence or credential erasure. Authorized retained homes need not be deleted.

The observation explicitly carries `queueIncluded:false`, `remoteCleanupVerified:false`, and `endToEndVerified:false`. It excludes orchestration queue/admission outside this function, post-teardown identity/evidence issuance, activity persistence, publication, remote settlement, and billing. It is **not** queue-through-final-cleanup completion time or a measured quality/performance claim.

## Identity and storage

A frozen `cue-host-runtime-timing-v1` object is retained in a private WeakMap keyed by the actual runtime result. `readIssuedHostRuntimeTiming(result, runId, sessionHandle)` returns it only for the matching result identity and binding. Copies, fabricated results, proxies and wrong bindings return `null`; no caller timing properties are evaluated. Compiled and source module instances have separate issuance maps.

The Codex executor reads this observation after the result settles and projects its bounded JSON into the existing `progress` activity (`progress:0`). With the orchestration activity sink installed, the existing ledger path handles ordering and persistence. A rejecting sink prevents successful adapter completion; the raw backend result remains unchanged. No new renderer IPC, migration, provider event, or model authority is added.

Absent observations are **unknown, never zero**: synchronous launch/admission failures, process death before settlement, legacy/injected backends, and an absent activity sink do not yield durable timing facts. Timing is also retained for settled failed/interrupted runs; consumers must preserve outcome denominators. Raw ledger activity alone is not an independently qualified timing receipt.

## Still required

No `measuredFactHost` is composed from this observation. Input consumption, independent verifier quality, full queue-through-cleanup timing, qualified environment/account/pricing and final accounting remain separate gates. Local fixture tests exercise Windows containment with a synthetic app-server, not a provider or model.
