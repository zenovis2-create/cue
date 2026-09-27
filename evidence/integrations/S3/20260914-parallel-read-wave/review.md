# Independent final review — S3 parallel read wave

Verdict: **PASS for the bounded injected-runtime SQLite driver scope**.

The stable candidate adds an optional host-prepared `maxParallelReadTasks`, defaulting to 1 and validated as a safe integer from 1 through 8. The immutable approval summary records the selected cap. A cap above one rejects local-invocation, retry, and automatic-recovery configurations before orchestration plan persistence.

The driver forms waves only from the current deterministic ready set, selects only non-implementation roles, and limits each wave to the configured cap. Each attempt record is published in the driver's attempt-keyed active map before `engine.start`; the engine retains its existing synchronous claim, budget reservation, stage binding, launch-intent, admission, and runtime ownership sequence. The real SQLite fixture observes two simultaneous running attempts, two stage envelopes, the summed reservation, and zero writer leases. A mixed ready set proves the implementation task does not join the wave and starts only after both readers finish. The stage binder continues to enforce that non-implementation actions are restricted to `read`, `list`, and `search`.

Wave completion waits for every member before recomputing readiness or entering verification. One failed member blocks the run, cancels its held sibling, and never launches the verifier. Stop during two pending starts aborts both runtime signals and settles driver control before either deferred launch returns; the late adapter executions are each cancelled exactly once, no provider launch is duplicated, both attempts remain unresolved under unknown cleanup, and `settled`/`close` refuse clean completion.

Wait-response delivery now resolves the active handle by exact attempt ID, with the established serial fallback retained. The existing retry, recovery, local, serial, acceptance, budget, admission, writer-lease, checkpoint, and Core composition tests passed unchanged alongside the new cases.

## Evidence

- Independent focused gate: 4 files, **68/68 tests passed**, exit 0. Raw output: `logs/independent-final-tests.log`.
- Root build was not duplicated; `root-build.log` records exit 0 for the stable candidate.
- Final SHA-256 pins matched:
  - `app/orchestration-driver.mjs`: `D455F30F31F95613AB62160DA1FDED13E913977D01E14C37E07436162E4958AB`
  - `app/orchestration-driver.d.mts`: `7EEF6EBE918B2DB2F096CF9BF54DCF140103A5998800F68FF5A775A9869C5507`
  - `daemon/test/integration-driver.test.ts`: `A73B4E608C560F181C23CB572616E778264E1C445D17A00392FF1A88DCC7E8FD`
- Scoped `git diff --check` passed.
- Full original preimages, rollback hashes, reconstructed pass-2 candidate, root correction history, fixture-fix preimage, and failed logs remain preserved. `review-before-root.md` and `logs/review-correction.log` retain the earlier invalid provider-cancel oracle and its correction.

## Limits

This verifies deterministic concurrency, cancellation, failure containment, writer exclusion, configuration guards, budget aggregation, dependency barriers, and exact-attempt wait routing through a real SQLite ledger and injected runtime. It does not establish real-provider overlap or throughput, native/OS process control, restart during an active parallel wave, live Electron behavior, network behavior, or broad S3 qualification. Cap values above two are validated and scheduler-bounded but the overlap fixture exercises cap 2. Deadline fanout uses the same `cancelActive` path as the directly tested stop path; a separate parallel-wave deadline-expiry scenario is not present.
