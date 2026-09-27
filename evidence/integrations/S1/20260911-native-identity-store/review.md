# Independent native identity store review

Reviewer: broker_review, 2026-09-11. PASS for the first structural persistence unit after two diagnosed corrections. Completion criterion: strict snapshot/ledger/transaction review, focused tests, typecheck and source/registration identities. Reviewer made no product changes or live/native/model calls. The historical failed ledger remains untouched.

## Independent gates

From daemon: `npx vitest run test/integration-native-execution-identity-store.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`: exit 0, 6 PASS, 23:49:42 KST, 361 ms. `npx tsc --noEmit`: exit 0.

Root's separately executed [compiled registration check](root-compiled-registration.json) reports source/copied migration hash equality, the table and three immutable triggers, and SQLite integrity ok. Reviewer confirmed the root registration source references 024 in ledger.ts and copy-assets.mjs and their hashes match that receipt. No duplicate build was run; maker build 0 is separately attributed.

| File | SHA-256 |
| --- | --- |
| daemon/src/native-execution-identity-store.ts | 609BCBBE77FCFC33494800FFF372209D340172507110438744CB50A2E98500A5 |
| daemon/migrations/024_native_execution_identity.sql | 0323B20F90E49C083C51EE4DA1B47D072C697C4F0A8D4AA4031381A79DAB6369 |
| daemon/test/integration-native-execution-identity-store.test.ts | 1C4A750A2AA2A961740C144C2F7F3A8020AE8E8D82596FC6D6E581AAA90695C6 |
| daemon/src/ledger.ts | A4EF7D9DB6553EC0412823E1C9BAFFEF58D541A4537F640F25CCE823E5CD1214 |
| daemon/scripts/copy-assets.mjs | 6CE997ED0698D0741D639D54EE12E6806ACB9FD87EE0E866C5DB2DF1E8F19CF6 |

## Corrected findings

1. Initial clientKind validation called String before its primitive type check, permitting caller coercion. Current code checks string type first; adversarial coercion/accessor/proxy tests report zero touches.
2. Initial case-sensitive profile parent comparison rejected the real lowercase Windows package paths observed in qualification. Comparisons now ignore Windows path case while preserving recorded bytes. The related path review also rejected root-relative, device and unsupported UNC forms: this unit supports fully drive-qualified paths only, with dot/dot-dot components forbidden. Known-folder containment is not inferred from these structural checks.

## Contract conclusions

Exact own-data schemas exclude extra prompt/response/command-line/credential fields and avoid accessors/proxies. Primitive field limits plus the 16 KiB canonical payload bound constrain stored data. Candidate IDs match catalog rules; run/session/task IDs retain narrower validation. Three distinct positive PIDs and positive uint64 decimal FileTimes are required; session.start_time remains separate host metadata. FileTimes are structurally validated values, not newly measured OS facts.

Snapshot construction orders keys deterministically and freezes nested records. Same canonical identity replay returns the same reference. One identity per session is immutable; another identity for that session fails. The store joins the session to its actual run/task and compares every supplied session field. Reads revalidate bytes/hash/indexed metadata and current session linkage, returning null if linkage becomes stale. Qualification runs without orchestration_attempt rows are supported through run/session foreign keys.

Record rejects an outer transaction, performs linkage/conflict/insert work in its own immediate transaction, and returns a reference only after that transaction succeeds. The rollback regression leaves zero rows and no reference. SQL triggers block update/delete and duplicate insert including replace/ignore. Reopen, input mutation isolation and stored/indexed tamper checks pass.

## Remaining integration boundaries

This API records host-supplied structure and existing ledger linkage. It does not authenticate native frames, query Windows, compare pinned control bundles, verify known-folder bases, establish FileTime provenance, infer qualification/workflow phase, or authorize a workflow parent/stage. Those are protected caller responsibilities in subsequent units. Multiple sessions may belong to one run; uniqueness is per session, not a universal orchestration attempt claim.

No adapter commit-before-broker/checker hook, native identity frame, bounded cancellation extension, restart OS observation or automatic cleanup is connected yet. Stored identities grant no execution/deletion/cleanup/acceptance/M/P authority. No claim is made that this unit recovers the missing identities from the failed real Electron run. That run stays unverified, and its model allowance remains exhausted.
