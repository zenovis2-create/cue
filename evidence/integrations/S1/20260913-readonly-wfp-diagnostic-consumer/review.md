# Independent WFP diagnostic consumer review

Status: **PASS for the bounded informational consumer.** No native, WFP, provider, model, or database-authority extension was invoked or added.

## Source audit

- `parseReadonlyWfpDiagnostic` accepts exactly one `CUE_READONLY_WFP=` line, exact camelCase frame/event keys, the expected 64-hex nonce and root identity, canonical UInt64 decimal strings, canonical base64, bounded integer fields, at most 64 events, at most 4096 decoded App ID bytes, a 524,288-byte JSON frame, and the worker's existing 1 MiB stdout ceiling. Returned objects, arrays, and events are frozen.
- Missing, malformed, duplicate, foreign-bound, noncanonical, oversized, or accessor/proxy-shaped data returns an empty `unknown` diagnostic. A supplied `captured` state is downgraded to `unknown` when overflow is true or the already-computed worker outcome did not succeed.
- The worker computes its original outcome and creates identity/cleanup records before parsing the diagnostic. The diagnostic is added only to the returned value. It is not written to a database or used by identity, cleanup, acceptance, readiness, denial, or qualification predicates.

## Independent authority and boundary coverage

The checker-owned fixture uses the production worker, identity store, and SQLite ledger with valid session and orchestration lineage. Its OS edges and control snapshot/verification functions are mocked so individual final-control outcomes are deterministic. It proves that exit 0, PID/created time, valid cleanup, process-death observation, and a successful mocked final control check produce `outcome: succeeded` plus exactly one real identity and one real cleanup row. The unchanged bootstrap integration's three cases separately exercise production control measurement, snapshot, and verification.

Against that same successful fixture, a valid frame becomes informational `captured`; missing, malformed, and duplicate frames leave the same success records intact while becoming `unknown`. Conversely, a valid frame cannot promote bad exit, missing PID, bad cleanup, or final control drift: each remains failed with null references and zero authority rows.

Executable boundary cases cover UInt64 zero and maximum/noncanonical rejection, exactly 64 events, exactly 4096 decoded App ID bytes, and acceptance at/rejection above both the 524,288-byte JSON limit and 1,048,576-byte stdout limit.

## Independent gate

From `C:\Users\User\cue\daemon`:

`npm exec vitest run -- test/readonly-wfp-diagnostic.test.ts test/integration-readonly-wfp-bootstrap.test.ts test/readonly-wfp-diagnostic-boundaries.test.ts test/integration-readonly-wfp-diagnostic-authority.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`

Result: exit 0; 4 files passed; 18 tests passed; 0 failed on checker attempt 1 of 2. After adding explicit owned-temp containment checks, the changed authority file alone passed 8/8 with exit 0; the unchanged combined result remains the recorded 18-test gate. Build was intentionally left to root coordination.

Frozen SHA-256:

- parser: `17FEAA78FEDC90DA1E3F6143CA4FA82FE7D096586FEA85508CAD9ABC2B0FFF69`
- worker: `6B2C1083201285179009E5BD87106C592CEC9A47966A1B5BA82F2519196C2206`
- maker parser test: `8E3B78B9E2F89288AC275AF1A1BF39FBBBB0611D72332D4F54172B727B65E5B6`
- bootstrap test: `931D5381432270BA33BBB528018035A5B36D11AC6FE379116F70DC52D10BAD07`
- checker boundary test: `1FB8C98E1B5FB393AE8E50C8A7EFDBFB287CF980DE4A415514DF69CDC78F34F2`
- checker authority test: `1A5E1302445A6A7DE84BF17CF61E7D946F0473F9EC1B5E3355D7E88309E61A6C`

The result establishes TS-side transport parsing and non-authority behavior only. It does not claim that a native launcher emitted such a frame or that the diagnostic proves isolation or acceptance.
