# Durable failed-clean staged discard results

## Outcome

Failed-clean staged execution now uses a distinct durable lifecycle:

1. `store.prepareFinish` runs the existing receipt descriptor, lineage, revision, running-state, launch-intent, identity, authoritative verifier, and handoff preparation checks.
2. It writes an immutable pre-clean authorization bound to the exact attempt, receipt ID, revision, receipt payload SHA-256, and normalized verification SHA-256.
3. While the attempt remains running, a recreated store over the same durable database reuses the exact authorized receipt before invoking the verifier again; any receipt mismatch refuses.
4. The staging coordinator resolves that authorization, rechecks the exact coordinator-owned execution-root identity, removes the isolated root, and records either `discard_verified` or `discard_unknown`.
5. Only `discard_verified` permits the write lease to be released. Unknown cleanup retains the lease and no terminal receipt is persisted.
6. After verified discard, ordinary terminal persistence consumes the same durable normalized verification instead of reclassifying with a drifting callback.

Migration 048 preserves historical 047 and installs separate immutable authorization and discard tables. It replaces only the three lease guards. Fresh databases, exact 047 upgrades, reopen, partial installs, weakened definitions, and packaged migration bytes are checked.

## Hostile cases

- Verifier false or throw: no authorization, no physical cleanup, no discard record, no receipt, lease retained.
- Interrupted window/recreated store on the same running attempt: exact durable authorization works with a now-throwing verifier; altered revision refuses.
- Cleanup unknown: immutable `discard_unknown`, no terminal receipt, lease retained, lease deletion refused.
- Verified failed cleanup: no publication intent or native publication, approved-root bytes unchanged, exact isolated root removed, failed receipt persisted, lease released.
- Publication-success cleanup continues using `active_cleanup_verified`; no historical state is reused for discard.

## Recovery boundary

This batch does not automatically finish discard after `store.recover(runId)` changes the attempt to blocked. Crash recovery conservatively keeps the blocked attempt, isolated root, and write lease held for a separately admitted recovery disposition. The reopen proof covers migration/database reopen and store reconstruction while the attempt remains running; it does not claim automatic crash completion.

## Gates and chronology

- Initial batch75 failed-clean experiment failed because schema 047 could not represent discard; those original logs remain under the prior evidence directory.
- Batch76 parser pass 1 found unmatched lease-trigger parentheses; `batch76_parse.log`.
- Corrected parser smoke passed; `batch76_parse2.log`.
- The first driver pass exposed the missing pre-clean authoritative verification boundary; `batch76_pass1_driver.log`.
- Independent review required durable verifier authorization and reopen reuse before callback replay. Intermediate failures and diagnostics are retained in `batch76_pass2.log`, `batch76_diag2.log`, and `batch76_final.log`.
- TypeScript no-emit passed; `batch76_tsc2.log`.
- Final post-build focused gate passed **31/31 tests in 2 files**, exit 0; `batch76_final2.log`.
- Root's coordinated final build passed before the final focused gate.

## Final pins

- `daemon/migrations/048_attempt_staging_discard.sql`: SHA-256 `C8410A26159D15BC1284BD40ED54F7D166272B8019599D4996ECC347C9821058`; Git object `0a166152e927ba6b5e005a9d0f86f5a3ae7ebd1c`.
- `daemon/src/ledger.ts`: SHA-256 `10ACD6895B6C23A98B1E694CC335115BFA1C30090E185CA3551B42448BA5F242`; Git object `08accb574fdff1935513283fb3d6c60af45c674a`. This shared final pin includes root-owned migration 049 bootstrap additions, which were preserved.
- `daemon/src/orchestration/store.ts`: SHA-256 `4EDB83F33460BDBC6BFFEE424D9BDD20109623C2E4EC6A801400E6C6C57F7F32`; Git object `a010bc458698bdaca3e0855ec3a749a83faeae82`.
- `daemon/src/orchestration/staging-authority.ts`: SHA-256 `DECCF9710F2EF36CB50374D92419F977C49D279E46AD55DEB71C9FFF990B0873`; Git object `cac9a6c0f4191386d3aeb2c4d0ace83f4e08420d`.
- `app/orchestration-driver.mjs`: SHA-256 `23C90FFE9155D0EB6108861F023BCB92DCAF90A9EB0A802AAA9D6E98C307C38C`; Git object `4b9e9d33259b70dbc52c7d401c83bcd7f127bdda`.
- `daemon/test/integration-staging-authority-migration-definition.test.ts`: SHA-256 `85742637A96E2769FB1E46EE387452E44AE8E6F132BDAA04156648E8D08826A1`; Git object `fa9224d4db8301c18b492e43435cf6688bebda7b`.
- `daemon/test/integration-driver-publication.test.ts`: SHA-256 `A8DE8EEB11C5139095CD37A537D8964D8653307667EAA2BB75BD7FC5470248D0`; Git object `f3c828fe60da00c349869966294ddbac50f96eed`.
