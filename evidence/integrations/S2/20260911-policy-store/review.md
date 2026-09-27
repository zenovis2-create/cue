# Independent S2 policy store review

Reviewer /root/contracts_review, 2026-09-11. Verdict PASS for SQLite policy snapshots/run bindings after one reviewer-requested correction. No remaining blocker in the component scope.

Done gate: focused tests exit 0, independent immutability reproduction resolved, source/evidence hashes match. Artifact write cap 1 followed by readback/hash. Reviewer made no source edits or external/model requests.

Command (cwd daemon): `npx --no-install vitest run test/integration-policy-store.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`

Observed exit 0, 10 tests passed, duration 264 ms. The author records build exit 0 in component-result.json; reviewer did not rerun the build.

## Finding resolved

Initial UPDATE/DELETE triggers did not prevent SQLite INSERT OR REPLACE with recursive_triggers off. Reviewer reproduced an in-memory snapshot identity changing source_version from v1 to v2. Maker added BEFORE INSERT guards for existing snapshot identity and run binding identity. New explicit recursive_triggers=OFF regressions reject REPLACE and UPSERT for both tables and verify original rows remain unchanged. Final focused suite passes.

## Reviewed behavior

- Strict own-data policy inputs, sorted independent frozen candidate lists and production selector validation reject malformed privilege-bearing fields and invalid policy/pin values.
- BEGIN IMMEDIATE plus expected latest revision implements append-only optimistic updates; stale expected revisions from a separate connection are rejected. Tests use two connections but do not claim stress/load coverage.
- Snapshot digest covers policy identity, revision, canonical policy content, creation time and source version. Reads reject noncanonical/corrupted snapshots and inconsistent binding digests.
- Run binding is immutable for exact policy identity and returns the original binding for replay, preserving its first timestamp. Later policy revisions do not change an active binding.
- Real database close/reopen preserves nullable fields and selected policy identity. Update/delete/replace/upsert guards protect existing rows.

## Limits

Tests apply migration009 directly. Production migration registration/build asset wiring, startup upgrade of existing ledgers and dispatch/UI integration are separate gates owned by the parent. Hashes detect corruption, not malicious writes by the database owner (who can drop triggers). No keyed authenticity, live model availability, valid price/performance data, execution admission or cost reservation is established by this store. Policy binding must be invoked by the execution path before use; module presence alone does not guarantee active-run immutability.

## Reviewed SHA-256

| Path | SHA-256 |
|---|---|
| daemon/src/selection/policy-store.ts | B62B2F21AA1E59409E98DDA419E187A6F8B1303E005158E0B00A23E4286B3CF2 |
| daemon/migrations/009_selection_policy.sql | 280D4D37E3F43B02637B93CA70CDF1E5F30634BD5AE09C06F7A0A30A550BD264 |
| daemon/test/integration-policy-store.test.ts | E4AA5B56EEDF543B9372F39D9CC866406F34BBAC0FAF81D29E44A20A417F3BEE |

