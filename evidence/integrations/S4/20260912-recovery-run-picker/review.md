# Historical recovery run listing — independent backend review

Reviewer `/root/broker_review`, 2026-09-12 KST. PASS for the bounded host/Core/IPC unit; no renderer picker or actual native observation claimed. No source edits, rebuild, helper/model calls or historical ledger writes.

Independent gate in `daemon`:

```text
npx vitest run test/integration-native-recovery-host.test.ts test/integration-recovery-run-picker-ipc.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
npx tsc --noEmit
```

Exit 0: two files, 13 PASS, start 01:18:46 KST, duration 32.42 seconds. Typecheck exit 0. These tests perform genuine installed-generation hashing with explicit OS fixtures; they are not native/helper evidence. All eight file hashes in maker `result.json` independently matched during the frozen review.

No unresolved blocker found:

- Exact `listRecoveryRuns({})` and existing-channel `{operation:'runs'}` only; no renderer-provided scope, path, limit or executor options. Existing trusted-mainframe registration and unavailable-service behavior remain in place.
- Reads recent parent workflow metadata joined to a plan, excludes known stage runs, examines the first 1000 bounded candidate rows using a 1001st-row sentinel, filters against the canonical current workspace and returns at most 50 matches. Output truncation and scan truncation are distinct; an empty scan-limited result does not establish absence of older workspace records.
- Listed counts are structural metadata, not verified identities or cleanup facts. Missing identity and stage-link counts remain visible. `lineage-incomplete`, `recorded-unverified` and `no-recorded-identities` are not execution or cleanup authority. Selecting a run still requires the existing strict identity resolution before observation.
- IPC output checks exact own-data fields, enum states, safe integer counts, duplicate IDs, sparse/getter arrays and count/status consistency. It exposes no goal text, filesystem path, PID, session, raw error or new ownership action. Responses are frozen; backend errors become generic unavailability.
- Reopened same-DB listing preserves bytes and total_changes, starts no OS query/stat and rejects closed DBs, outer transactions, hostile input and foreign scopes. No new table, receipt, acceptance or execution-state mutation is introduced.

The 1000-row limit bounds host metadata candidates, not total database index work or a wall-clock guarantee. Ordering is latest insertion (`rowid`), not a new assertion about historical event time. Renderer selection/restart behavior remains a later unit.

Principal SHA-256 values (complete eight-file set in `result.json`):

| File | SHA-256 |
| --- | --- |
| app/native-recovery-host.mjs | 341482058EE4F4B3CB7D1BEAB0F67903752834AB504AA3088A20EA18BFA7B40C |
| app/core.mjs | 9DC11E077C958F97B1548BACA993C9AF2B4BFFDE5549C1BE51C9B88A234F2438 |
| app/ipc.mjs | 736B265D22EB70A350C606762CA6757D41524A04B3645C17805F2B2D27F9F36B |
| daemon/test/integration-native-recovery-host.test.ts | 6B8969F18DE21BAE30EA28DF5BC2AEE277BDAB54A3B33E8155985811CFDBFDF7 |
| daemon/test/integration-recovery-run-picker-ipc.test.ts | 4DAC4133E72FCF3875DF59E22DE01E158A3CDE56F304FC6E0A203CB0C79BD91E |
