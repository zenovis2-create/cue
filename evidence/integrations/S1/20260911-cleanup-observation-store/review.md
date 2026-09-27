# Independent review: durable cleanup observation store

Reviewer `/root/broker_review`, 2026-09-11. Read-only product review. **PASS for the observation persistence unit and migration registration.** No blocking defect found in scope. No native process/model tests were repeated during concurrent native pin changes.

## Source identity

| File | SHA-256 |
| --- | --- |
| `daemon/src/cleanup-observation-store.ts` | `E995688B4228BF633AC944763D785DEA19C31ED9F3D03376E44191C939E34D69` |
| `daemon/migrations/018_cleanup_observation.sql` | `DFB1D319DAE38926B497C76468B6BA155CC7BD36B310480EEAC6ABE41B21F6B0` |
| `daemon/test/integration-cleanup-observation-store.test.ts` | `8E7D468EDE0B52CC2D0943A1A0B58C93192801F416B9E5689EA761B6F2F137F5` |
| `daemon/src/ledger.ts` | `24E03AE8BE6576720D1EBA722DC6684ED76D7E648ABC2D89EE6D8FEDD6F9C2D2` |
| `daemon/scripts/copy-assets.mjs` | `111CA388B24C4A80D38B8187AE8555B657B0750D23B0E6A044334A8767A863E3` |

Copied `daemon/dist/migrations/018_cleanup_observation.sql` matches the source SQL hash exactly. Ledger loads it in a transaction after migration 017; copy-assets registers the deployment copy. Root-owned ledger/copy files contain concurrent work beyond this registration; this report does not re-review every unrelated change in them.

## Independent tests

- `npx --no-install vitest run test/integration-cleanup-observation-store.test.ts test/p5.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`: exit 0, **22 passed** (store 5 / P5 ledger and recovery 17), 1.08 s, start 18:47:03 local time.
- `npx --no-install tsc -p tsconfig.json --noEmit`: exit 0.
- Store tests use real SQLite transactions and a real file reopen. They cover canonical stable references, isolated read copies, exact run/session linkage, immutable UPDATE/DELETE/REPLACE/IGNORE denial, offline row/index corruption refusal, accessor/proxy/cycle/toJSON/exotic-array rejection, input bounds, outer transaction refusal and rollback before reference return.

## Persistence and shape assessment

- `persist` rejects `db.inTransaction` before serialization, then commits through an immediate top-level transaction before returning `cue-cleanup:<sha256>`. An enclosing savepoint cannot later roll back an issued reference. An insert trigger abort is observed as failure with no returned reference and no persisted row.
- Canonical serialization snapshots descriptor values without invoking supplied accessors or `toJSON`. Plain/null-prototype objects and plain arrays are supported; proxies, symbols, exotic prototypes, holes, cycles, unsupported numbers and oversized structures fail. Bounds are 65,536 serialized bytes, depth 8, 4,096 traversal nodes, 256 keys/items per container. Sorted object keys and content hashing make reference identity independent of property insertion order.
- Top-level run/candidate/role/digest/time/result/reason and unknown provider/billing metadata are validated. A supplied session must contain exactly the expected six fields and match both its stored session row and the run's task ID. An absent session is permitted for an unknown/unavailable observation; the store does not invent an owned session or OS evidence.
- Source comparison with `isolated-model-cleanup.ts` confirms its emitted `session`, `nativeIdentity`, `processes`, `paths` and top-level fields are representable as these bounded plain JSON values. Native boundary strings/booleans/nulls and process/path presence strings introduce no unsupported types. This is a shape compatibility audit, not a new live observer/store integration test.
- SQL guards preserve append-only observation rows, including duplicate INSERT OR REPLACE/IGNORE attempts. API-level repeated persistence validates identical content and returns its existing reference without attempting a second INSERT.
- `read` checks reference syntax, blob size/type, raw SHA, canonical form and indexed run/subject/session identity, then returns a fresh byte copy. Corrupted/missing/error cases return undefined. It returns historical bytes only and intentionally does not require a currently live session or re-run OS checks.

## Scope limits

The store is a trusted-host evidence sink. It does not prove that a host-supplied `verified-clean` string is true, require a new probe, establish cleanup freshness, or itself produce a CleanupReceipt. OS cleanup truth remains the separately reviewed observer's responsibility; the callback must use this sink in the actual host composition. A durable reference is only as durable as the host-provided ledger's storage configuration; in-memory test ledgers are not restart persistence.

These results do not qualify a candidate, settle provider billing, prove default app wiring or accept a user's task. Native identity pin work and real model canaries remain under their own evidence scopes.
