# Driver fixture correction results

The production writer-admission guard remains unchanged. The full suite originally reported 41 failures in `integration-driver.test.ts`; they cascaded from a common synthetic candidate that only persisted handles but declared `file_change` and a change target without attempt-owned staging.

The corrected common fixture remains an implementation-role orchestration fixture, including writer lease, reservation, identity, cleanup, retry, recovery, acceptance, and wait-delivery assertions. Its target-free stages now declare no file-writing action. Three tests that actually exercise writes use `enableWritableTarget`: writer serialization, file-identity replacement, and modified-file observation. Those cases use isolated per-attempt roots, native root identity checks, the real staged existing-file publication host, and the required candidate capability. No assertion or test was removed.

The real-restart child was the same handle-only mismatch. It now declares an empty stage action set and no synthetic change target; the parent restart/delivery assertions are unchanged.

Pass 1 repaired 76 of 77 tests. It exposed one local scope-isolation override that reintroduced `file_change` despite testing only plan-digest and envelope-path isolation. Pass 2 changed that local handle-only override to an empty action set and passed all tests.

## Gates

- Driver plus real restart, pass 1: 76 passed, 1 failed. Raw output: `pass1.raw.log`.
- Driver plus real restart, pass 2: 77 passed. Raw output: `pass2.raw.log`.
- Publication plus named orchestration: 26 passed. Raw output: `supporting.raw.log`.
- TypeScript `--noEmit`: exit 0 with no diagnostics. Raw output: `tsc.raw.log`.

## Final SHA-256

- `daemon/test/integration-driver.test.ts`: `00E53341E6F27A58967A2D586D1A190C98D525B197E495EBBF88DE42451FF821`
- `daemon/test/fixtures/integration-driver-wait-crash-child.mjs`: `A2E015538EACFF84771A4FA3CA927C2615E065540C17A9CC972CEEEDC2E15846`

Both whole-file preimage copies match the Git object hashes captured before editing: `36a1e7906f2ac9b73bdd7da400e6972483beb223` and `5a1c38dd5ed933bb605df166588be658e5678045`.

## Remaining production boundary

The admission guard classifies writable work from the stage envelope's `file_change` action. Command-capable writes outside that declaration remain unclassified. Also, the current staged cleanup/publication path finalizes succeeded clean receipts; failed-but-clean staged execution lifecycle needs separate production design and tests. This fixture correction does not claim either gap closed.
