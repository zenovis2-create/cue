# Independent review — migration 046 registration and packaging

Verdict: **PASS for the corrected registration-definition check and packaging.** This supersedes the earlier name-only registration review. It does not close S3-03 because the current orchestration driver does not invoke the final-publication store and writable runtimes still reach target paths before a publication decision.

## Registration and compiled migration

The source and deployed migration are byte-identical:

```text
C3E413D3C058C6CA800A9ED37CF015B41896290D1CDCE9032767BAED0EB51274  daemon/migrations/046_change_publication.sql
C3E413D3C058C6CA800A9ED37CF015B41896290D1CDCE9032767BAED0EB51274  daemon/dist/migrations/046_change_publication.sql
63D45AF43408EA2F34AC1EF0D5DF95EF7E88392171768D15C6BC908BDE34F7BE  daemon/src/ledger.ts
6A5EEC4A0FC585AC82DAF44DAEF69ED565A66769B4C407E7C787D64792B9ED77  daemon/scripts/copy-assets.mjs
```

`openLedger` checks exactly three named tables:

- `change_publication_migration`
- `change_publication_intent`
- `change_publication_result`

It separately checks the exact 14 named triggers recorded in `guards.json`, plus singleton marker version `cue-change-publication-v1`. It then creates an isolated in-memory SQLite reference, installs the shipped migration against the minimal referenced workspace-lease table, and compares the canonical `sqlite_master` type/name/SQL rows for all `change_publication_*` tables and triggers. This rejects same-name altered definitions as well as partial names or a missing/wrong marker.

The independent evidence-only `review-smoke.mjs` ran against compiled `daemon/dist` and exited 0. It observed:

```json
{"sourceDistEqual":true,"freshTables":3,"freshGuards":14,"marker":true,"populatedUpgradePreserved":true,"reopen":true,"partialGuardRefused":true,"cleanup":true}
```

The populated-upgrade case inserted a pre-existing task row, removed only the migration-046 objects to reconstruct a pre-046 ledger, reopened through compiled `openLedger`, and verified the old row remained byte-for-byte equal while all 3 tables, all 14 guards, and the marker were installed. A second reopen preserved the row. A separate database with one deleted publication guard was refused. All exact owned database, WAL, and SHM files were removed.

The final independent focused gate passed **3 files / 16 tests**, exit 0. In addition to the publication and packaging regressions, it proves an unchanged populated ledger reopens, a same-name no-op lease trigger is rejected with `change_publication_migration_definition`, and an altered publication table definition is rejected. Pins:

```text
F6E9AF1F08728B45137E0859321DF4D51F46D1E5CCF1D207E255F6EB76DAA282  daemon/test/integration-publication-migration-definition.test.ts
9A5422EC57B1AF2B4A7C42364A7F4B692AA9552D85A6478D066BCFDD7F45A60C  daemon/test/integration-final-publication.test.ts
AF1A77E882449F337EA49C0650D1A326488EED238540B4C97D473BF433781349  daemon/test/integration-journal-packaging.test.ts
```

Smoke script SHA-256: `2D8842F863F8B00257B88E0808AE6FE60F28EE51B15C2903AFA8AE5D85CCAC2E`.

## Packaging gate

The root packaging artifacts record final corrected build exit 0 and the earlier four-file packaging/native/publication gate at 24/24, exit 0. `copy-assets.mjs` copies migration 046 into `dist/migrations`. The later independent 3-file/16-test gate above uses the corrected schema and final publication test bytes.

The native helper and final-publication store behavior are owned by their separate reviewers; this review credits only registration, deployed-byte parity, migration startup behavior, and packaging presence.

## Exact remaining driver seam for S3-03

The named original condition requires `integration-orchestration.test.ts` to prove duplicate execution 0 and losing-writer final overwrite 0. Current `app/orchestration-driver.mjs` captures the target preimage before a writable attempt, lets the runtime operate on the worktree, and after reconciliation calls `observeChangeSet`. It never imports or constructs `createFinalPublicationStore`. Therefore the new store cannot prevent the runtime from overwriting the existing target before observation.

The smallest honest integration seam is at the writable-attempt completion boundary, before the attempt is accepted as completed and before run-level acceptance collection:

1. Writable execution must produce replacement bytes in an attempt-owned staging/output boundary while the declared existing target remains at its captured preimage. A callback that reads the already-mutated target is too late and cannot establish overwrite prevention.
2. For every declared change target, the driver binds the exact captured `change_set_id`, target relative path, and staged replacement bytes to a deterministic publication ID, then calls one `createFinalPublicationStore(...).publish(...)` instance configured with the reviewed native executor and authority callback.
3. Only `committed` allows the writable attempt to proceed. `contention`, `unknown`, or durable `pending` blocks completion and keeps the lease. Replay reads the stored publication result and performs no second native call or runtime launch.
4. The driver then performs its existing fresh change observation and acceptance flow against the committed bytes.

The decisive named-suite regression uses two runs/writers sharing one captured preimage and different staged replacements. The first publication commits A; the stale second publication returns contention; the target remains A. Reopening and replaying both driver states must produce zero additional runtime launches and zero additional native publication calls. Until the runtime supplies staged bytes without first changing the target and this driver path is connected, the store remains a bounded backend component and S3-03 remains open.
