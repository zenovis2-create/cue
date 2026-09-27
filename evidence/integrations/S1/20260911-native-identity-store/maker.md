# Native identity store — maker evidence

2026-09-11. Store-only implementation; independent review pending in adjacent review artifact.

- `npx vitest run test/integration-native-execution-identity-store.test.ts --reporter=verbose` (daemon): exit 0, 6 PASS, 23:48:50.
- `npm run build` (daemon): exit 0, TypeScript and migration asset copying.
- Actual temporary SQLite via openLedger and reopen; no native process or model execution, no historical DB changes.

## Contract and verified scope

One immutable canonical identity per actual ledger session. Qualification needs no orchestration attempt row. Exact six session fields and run/task join are checked at insertion and read. Reordered identical input is idempotent; conflicting bytes for a session reject. Own immediate transaction commits before returning `cue-native-identity:<sha256>`; external transactions and failed insert rollback yield no reference. Triggers reject update/delete/replace/ignore duplicates. Reads recompute payload hash, canonical bytes and indexed lineage, returning frozen copies or null on corruption/stale linkage.

Input is exact own-data records, without getters, proxies or coercion. Candidate IDs follow catalog syntax; run/session rules remain narrow. FileTime is positive decimal uint64, separately recorded from host wall-clock session metadata. Paths support fully qualified Windows drive paths only, rejecting UNC, device and root-relative forms. Case-insensitive structural basename checks retain original observed path bytes. Path containment and actual native provenance are caller responsibilities.

Correction pass combined independent findings: clientKind String coercion removed; actual lowercase Windows profile path accepted; root-relative/device paths denied. Tests cover these regressions, input bounds, duplicates, linkage, failed transaction, tampering and reopen. No failing runtime test was observed before correction; the initial findings came from static review. Historical source observations must not be represented as an automated RED test.

Storage validates recorded structure and lineage only. It does not measure OS truth, authenticate native frames, authorize execution/deletion, issue cleanup receipts, or grant acceptance/qualification. Adapter integration before service authorization and read-only recovery remain subsequent units.

## Source hashes (SHA-256)

| File | SHA-256 |
| --- | --- |
| daemon/src/native-execution-identity-store.ts | 609BCBBE77FCFC33494800FFF372209D340172507110438744CB50A2E98500A5 |
| daemon/migrations/024_native_execution_identity.sql | 0323B20F90E49C083C51EE4DA1B47D072C697C4F0A8D4AA4031381A79DAB6369 |
| daemon/test/integration-native-execution-identity-store.test.ts | 1C4A750A2AA2A961740C144C2F7F3A8020AE8E8D82596FC6D6E581AAA90695C6 |
