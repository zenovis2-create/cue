# Orchestration regression fixture corrections

Scope: three test fixtures only. No production source, provider, model, native helper, network, credential, or paid operation was changed or invoked.

## Atomic-claim fixture follow-up

The full integrated run intermittently reported `database is locked` while both workers concurrently called `openLedger()`. That startup path replays all migrations through separate write transactions before the test's `ready` barrier, so the failure did not isolate claim contention. The fixture now waits for each worker's explicit ready message before starting the next connection, then releases both already-open independent connections together through the unchanged `go` barrier. Exact results remain one `claimed`, one `task_not_ready`, one attempt, and one writer lease.

This correction does not add sleeps or retries and does not change the production claim transaction. Concurrent `openLedger()` migration startup remains a separate production limitation and is not claimed fixed.

Verification:

- Complete orchestration suite: 11 passed.
- Focused atomic-claim repeat: 1 passed, 10 filtered/skipped.
- `integration-orchestration.test.ts` SHA-256: `413440BADC651F2D502644DECBA10C6E15598C1C6706D4FE89D9F0FB012D8A4E`.

## Result

Focused command:

`npx vitest run --fileParallelism=false --maxWorkers=1 test/integration-execution-ownership-core.test.ts test/integration-orchestration.test.ts test/integration-selection-explanation.test.ts test/integration-stage-envelope.test.ts`

Result: 4 files passed, 28 tests passed, exit 0, duration 7.62 seconds.

The stage-envelope fixture now establishes the real current handoff prerequisites before claiming the dependent verifier: immutable stage binding and selection digest, launch intent, durable session identity, authorized artifact bytes, and verified handoff. The earlier receipt-only fixture correctly remained blocked and could not make the verifier ready.

The selection-history fixture now inserts its historical attempt against the genuine pre-025 schema, then applies migrations 025 through current before invoking the current snapshot reader. It therefore preserves proof that migration 025 seals a preexisting attempt as legacy while supplying the later tables required by today's reader.

The execution-ownership fixture preserves fail-closed display semantics. Raw `cleanup_verified=1` rows without valid terminal handoff integrity remain `unknown`; the assertion instead proves the oldest unresolved attempt is absent from the bounded 50-row history while the unbounded ownership query still reports one unresolved attempt.

The independent-connections atomic-claim test was not changed. Its reported `database is locked` baseline failure did not reproduce in two serial focused runs. Those passes do not establish that timing-sensitive contention is resolved; concurrency flakiness remains uncertain and no claim timeout or atomicity behavior was weakened.

The package `npm test` wrapper was attempted once after the fixture changes but stopped in the concurrent, out-of-scope `src/evaluation/measured-facts.ts` build with TS18049/TS18048 errors before executing tests. Per the joint-source freeze direction it was not rerun.

## Source hashes

- `integration-stage-envelope.test.ts`: `BD2C8AAC8F886F2CB6C4654E49246B6ED91104D791254B5752175B6A71F5C090`
- `integration-selection-explanation.test.ts`: `2FB2112418532CDF0050D81ACFAA93B05C8EAC1FA50953A4DD44F314755DD4FD`
- `integration-execution-ownership-core.test.ts`: `7C54F7D02AB7A5A92B7F4F248D4F0A76374712B0D78D05DEE6024368F3C36C7B`

Independent root/checker review remains required before integration.

## SQLite startup serialization

The former concurrent-startup baseline deterministically failed for a fresh database: one synchronized worker opened the ledger and the other returned `SQLITE_ERROR: table task already exists` from `openLedger`. The initialized-database leg passed, confirming the fresh-schema check/write race.

`openLedger` now enables foreign keys before migration work, reserves the SQLite writer with an IMMEDIATE transaction before any schema reads in phases 001–015 and 017–039, and leaves migration 016 at its existing outer boundary and EXCLUSIVE transaction so its foreign-key pragma changes remain effective. The phase transactions serialize schema initialization without sleeps, retries, timeout widening, or migration SQL changes.

The focused test synchronizes two independent workers before simultaneous `openLedger` calls for both fresh and initialized files. It preserves a durable preexisting task across concurrent reopen, checks `foreign_keys=1`, `busy_timeout=5000`, a clean foreign-key check, and the final migration marker. A deterministic malformed legacy schema proves a later phase-1 failure rolls back tables created earlier in that phase and releases the failed connection so Windows can rename the database.

Final focused gate: 5 files, 42 tests passed, including retry migration legacy/FK restoration, migration 039 reopen, exact-once orchestration claim, failure cleanup, and both concurrent startup legs. The npm pretest build also passed.

- `daemon/src/ledger.ts`: `19BCB46C6C3D0C02B2F6B4CF828C1D277072DEF59FF4E158F2E8535CE394E47E`
- `daemon/test/ledger-startup-concurrency.test.ts`: `AD6DF345A486504652780B76FBE0D2056A60B7A273562535574FC5E193024971`
