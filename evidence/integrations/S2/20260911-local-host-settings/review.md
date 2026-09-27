# Independent local host settings review

Verdict: PASS for the bounded persisted-settings store. No actionable correctness blocker found. Reviewer made no implementation edits and no model calls.

Independent gates, 2026-09-11 21:06:45 KST:
- `npx --no-install tsc -p tsconfig.json --noEmit`: exit 0 (tool ac2229).
- `npx --no-install vitest run test/integration-local-host-settings.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`: exit 0, 6 passed, 364 ms (tool ff8086).

Reviewed exact v1/generated-json-v1 schema, boolean intent, bounded safe integers, canonical UTC timestamps, descriptor-only plain objects and proxy/getter rejection. Settings retain exactly four mode references; each resolves persisted revision, validates its digest through the existing policy store and matches its mode. Snapshots are defensive frozen copies with canonical JSON and identity/revision/settings/timestamp/source digest binding. Missing, altered and wrong-mode references fail before insert.

Save uses an immediate SQLite transaction with persisted expected-revision comparison and rejects an outer transaction. Separate-connection stale writers and reopen preservation are tested; this is sequential interleaving evidence, not a concurrent-worker contention benchmark. SQL triggers reject UPDATE, DELETE, REPLACE and UPSERT even when recursive triggers are off. Historical reads revalidate settings bytes and referenced policy integrity. Safe revision increment rejects the boundary rather than overflowing.

Limits: this stores configuration intent only. Enabled does not admit a candidate, local-invocation does not implement invocation accounting, and monetary sourceRef remains unresolved metadata. It creates no endpoint, secret, price proof or capability evidence. Timestamps are syntactically canonical; no freshness or monotonic clock authority is claimed. The SQL table is not a hostile privileged-DB boundary: application reads detect hash/schema drift, while privileged actors able to replace data and recompute hashes remain outside this store's trust model. Migration 020 is applied directly by these tests; automatic production registration and app/runtime consumption are separate parent work and are not proven here.

Source hashes at review:
- daemon/src/selection/local-host-settings.ts SHA256 76850C3E2602E901786340F6604677BC5E93DA2F4804ADCE3F3EA521388E179E
- daemon/migrations/020_local_host_settings.sql SHA256 3DB8FF78F291AA9868EDD5C886F6F2CD490B3BC91862C146DEEEFCA8AFA39195
- daemon/test/integration-local-host-settings.test.ts SHA256 B9C1C702005A685C64DA705E5DC534A04F3DC1A4E308006C983854968B098BF5
