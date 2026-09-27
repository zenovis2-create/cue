# P5 migration fixture and failure cleanup — independent review

Date: 2026-09-11. Reviewer: native agent `transport_review`; source edits by parent.
Verdict: **PASS for this bounded regression correction**. No full-suite rerun or release verdict is claimed.

Independent commands from `C:/Users/User/cue/daemon`: `npm run build` exit 0; `npx vitest run test/p5.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` **17/17 pass**, exit 0.

The former upgrade fixture contained only `task(id)` and `run(id)`, omitting the actual base envelope and other tables. That schema could not represent Cue's initial ledger. The replacement uses the actual migration 001 base schema and a retained task row. Review caught that current 001 already contains P5 tables: the final test explicitly drops the three empty P5 tables and asserts they are absent before opening through the migration path. It then checks new P5 tables, reopens idempotently and verifies the old task state/timestamp survived. This exercises migration creation rather than merely testing a prepopulated current schema.

The separate malformed-schema fixture remains and must fail migration; production does not ignore or repair that failure silently. `openLedger` now closes the newly opened DB on an initialization/migration exception and rethrows the error. The test confirms the malformed file can immediately be removed on this Windows host, exercising the leaked-handle failure rather than hiding teardown errors. Successful callers still receive an open database. Migration ordering and SQL constraints are unchanged by the try/catch wrapper.

| Inspected file | SHA-256 |
| --- | --- |
| `daemon/src/ledger.ts` | `49129A7328FF184C655CFE3A09DD63FE33AE414B56EAF63F479EB8D49173CB6F` |
| `daemon/test/p5.test.ts` | `B67F5A9759DF4F95E278E7EF5369671D4650DDAC1EF6A02C6F7E6E606E99F3DF` |
| `daemon/migrations/001_init.sql` | `2CAAE23F0E9B552DB89307FAD5B13E9EE6944C9FDA6343199AFF975A6A44A7C9` |
| `daemon/migrations/002_p5.sql` | `7136014304E30B91B300C144C3AAA0C82D826545350F6C012CCD1097BC0D41F0` |

Limits: this does not make every migration globally atomic or promise to repair arbitrary corrupt historical databases. Existing successful earlier migrations can remain applied if a later migration fails, as before; failure now releases the handle. No live provider execution was tested. Only this review artifact was edited by the reviewer.
