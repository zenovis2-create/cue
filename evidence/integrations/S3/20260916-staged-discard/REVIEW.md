# Staged discard independent review

Date: 2026-09-16 (Asia/Seoul)  
Reviewer: `provider_installation72`, independent of maker `writer_boundary74`  
Initial verdict: **NOT CLEAR — discard cleanup precedes authoritative receipt verification**

## Scope

Reviewed migration 048, its ledger bootstrap/definition checks, `staging-authority.cleanupDiscarded`, the orchestration driver's deferred finish order, and focused schema/driver tests. Source remained read-only. No shared build, full test run, provider/model/network/local action, or cleanup command was run by this reviewer. Root's separately owned migration 049 work is outside this verdict and must preserve the exact immutable 047/048 definitions.

Current reviewed identities at the initial verdict:

- `daemon/migrations/048_attempt_staging_discard.sql`: `BB24DE4462A6B9E10EA0ABBBA2857439DFF7AD9AE033A46925283B416AB712A4`
- `daemon/src/orchestration/staging-authority.ts`: `F0B8213E048077E18D9282C4A42996D377043FA5EB2CA117927B4342DF298926`
- `app/orchestration-driver.mjs`: `9B480F4FCED7E6B97B35C5F00CC45F8050DA533BC8693BE01293727309C5EFCE`
- `daemon/test/integration-staging-authority-migration-definition.test.ts`: `769E9A91DBCCF811EF18074F19B71F1AB56421D27985BAC9A07CCAEF7885D69A`
- `daemon/test/integration-driver-publication.test.ts`: `A4BC6D137F1DE99C5320B3C802891D17F68F16790C6F13E852565ADFF8341DC9`

The maker plan records exact pre-edit hashes and byte copies for existing owned files under `preimage/`. At initial review time no maker `RESULTS.md` or root-coordinated focused gate was yet present.

## Stop-ship finding

The implementation can irreversibly clean an isolated execution root on a host-supplied receipt object before the existing receipt authority has verified it.

The driver wraps the orchestration store so that every staged clean receipt, including a failed one, is returned as a deferred in-memory object instead of calling `store.finish` (`app/orchestration-driver.mjs:275-279`). When reconcile returns that token, the failed branch passes the original object to `stagingCoordinator.cleanupDiscarded`; only after physical cleanup and the discard insert does the driver call `store.finish` (`app/orchestration-driver.mjs:598-601`).

`cleanupDiscarded` requires the strings `outcome='failed'` and `cleanup='clean'`, bounded receipt metadata, current factory identity, and exact coordinator-owned execution-root identity. It then calls `factory.cleanup` and records `discard_verified` when the root and metadata are absent (`daemon/src/orchestration/staging-authority.ts:170-186`). It never invokes the orchestration store's `verifyReceipt` authority or checks a durable verified receipt classification.

Migration 048 cannot fill that gap. Its insert trigger binds the payload to the exact running attempt, setup, authority root, factory, absence proof, and lack of publication/change-set rows. It checks that receipt-shaped fields exist, but no `orchestration_receipt` row exists by design at this point. The trigger therefore proves which root was deleted and that deletion was later inspected; it does not prove that the provider outcome/cleanup claim authorizing deletion was authentic. A host `receipts()` implementation can return a structurally valid false `failed/clean` object, cause physical cleanup plus an immutable `discard_verified` row, and then have `store.finish` reject the same object during authoritative verification.

The focused positive fixture does not distinguish these authorities: its receipt callback supplies the desired fields and the later store verifier accepts them. Required correction evidence is a hostile test where an exact-shape failed/clean receipt is rejected by the authoritative receipt verifier and produces zero factory cleanup, zero discard rows, and a retained lease. The correction needs a durable pre-clean classification bound to exact run/task/attempt/receipt/revision/evidence and verifier authority, while the attempt is still eligible for cleanup. Requiring a normal terminal receipt after cleanup or merely adding more host JSON fields would not resolve the ordering problem.

## Contracts that pass source review

- Migration 048 defines only immutable `discard_verified` and `discard_unknown` outcomes and verifies canonical payload bytes and hashes.
- The insert trigger binds the exact setup/run/task/factory and coordinator-owned execution path plus volume/file identity, and rejects prior cleanup, change-set entries, or publication intents.
- Physical cleanup first re-observes the exact root identity, then inspects both root and metadata absence. Any exception or incomplete absence becomes immutable `discard_unknown` and throws.
- Reopen/idempotency is conservative: an existing verified row returns without a second cleanup, while an unknown row remains blocked.
- The replacement lease guards allow release only for verified discard; unknown, missing, publication-incomplete, and ordinary cleanup-unknown states retain the lease.
- Schema bootstrap tests cover exact 047 upgrade, fresh/reopen behavior, partial install, weakened trigger, altered table, and packaged migration parity.

These properties accurately prove cleanup identity and outcome once cleanup is authorized. They do not supply the missing authority for deciding that the failed-clean execution receipt permits cleanup, and they do not close broader S3 or live-provider behavior.

---

## Correction re-review

Final verdict: **CLEAR for the bounded failed-clean staged-discard lifecycle described below**

The initial stop-ship finding above is retained as review history. The frozen correction closes it by moving authoritative receipt classification ahead of physical cleanup and persisting that authority independently of the host receipt object.

`store.prepareFinish` now applies the existing exact receipt descriptor, lineage, revision, launch-intent, attempt-identity, verifier, and handoff checks while the attempt is running. It persists an immutable authorization bound to the attempt, receipt ID, revision, canonical receipt SHA-256, and normalized verification SHA-256. A verifier false result or exception cannot create that authorization. The hostile focused cases demonstrate zero cleanup, zero authorization/discard/terminal-receipt rows, and a retained lease.

Before touching the root, `cleanupDiscarded` resolves the durable authorization and compares the exact receipt ID, revision, and canonical receipt hash. It re-observes the coordinator-owned root path and filesystem identity. Migration 048 independently requires the same authorization at discard insertion and rejects publication/change-set evidence, the wrong root identity, malformed canonical payloads, weakened definitions, and partial schema installation. Complete absence records `discard_verified`; an exception or incomplete absence records immutable `discard_unknown`, refuses terminal receipt persistence, and retains the lease.

After `discard_verified`, `finish` consumes the same stored normalized verification rather than asking a drifting callback to reclassify the receipt. Exact store reconstruction over the same database can reuse the authorization while the attempt remains running; a changed receipt revision/hash refuses. This is database/store reopen idempotence within the running attempt. It is not automatic crash recovery: `store.recover(runId)` marks the attempt blocked, after which cleanup remains conservatively held with the isolated root and write lease intact for a separately admitted recovery disposition. No automatic write or cleanup occurs in that state.

The positive path proves the exact isolated root is removed, the approved workspace is unchanged, no publication intent is created, a failed/clean terminal receipt is stored only after verified discard, and the lease is then released. The existing publication-success path remains separated under `active_cleanup_verified`. Exact 047 upgrade, fresh/reopen installation, immutable schema verification, and packaged migration parity are covered.

Reviewed final identities:

- `daemon/migrations/048_attempt_staging_discard.sql`: `C8410A26159D15BC1284BD40ED54F7D166272B8019599D4996ECC347C9821058`
- `daemon/src/orchestration/store.ts`: `4EDB83F33460BDBC6BFFEE424D9BDD20109623C2E4EC6A801400E6C6C57F7F32`
- `daemon/src/orchestration/staging-authority.ts`: `DECCF9710F2EF36CB50374D92419F977C49D279E46AD55DEB71C9FFF990B0873`
- `app/orchestration-driver.mjs`: `23C90FFE9155D0EB6108861F023BCB92DCAF90A9EB0A802AAA9D6E98C307C38C`
- `daemon/test/integration-staging-authority-migration-definition.test.ts`: `85742637A96E2769FB1E46EE387452E44AE8E6F132BDAA04156648E8D08826A1`
- `daemon/test/integration-driver-publication.test.ts`: `A8DE8EEB11C5139095CD37A537D8964D8653307667EAA2BB75BD7FC5470248D0`
- Maker `RESULTS.md`: `7846EFF8070248E270F38A286DBCBBB4B4A2454E98F721B4411A3E643E04E87B`

Evidence records the root-coordinated build passing, TypeScript no-emit passing, and the final post-build focused gate passing **31/31 tests in 2 files**, exit 0 (`batch76_final2.log`). Earlier parser, driver, and review-discovered failures remain preserved in the same evidence directory.

This verdict covers only the bounded original failed-clean staged execution and its exact durable rows. It does not close broader S3 behavior, automatic crash completion, or live-provider qualification.
