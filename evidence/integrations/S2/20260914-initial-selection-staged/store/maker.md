# Initial-default store maker receipt

Status: maker PASS on revision 1; source frozen for independent review.

The store persists one immutable `cue-initial-default-v1` configuration per run. It binds the exact existing selection policy and monetary budget identity, an allowed default candidate, a complete conservative verified-completion estimate with known cost/time bounds, trusted provenance, and a preapproval timestamp. API and SQL guards enforce policy currency, quality, cost/time limits, freshness, numeric ranges, canonical payload hash, and binding before any approval event or first attempt. Reads revalidate every column, canonical bytes, hash, policy and budget. Pre-040 absence is compatible; a partial or invalid migration marker fails closed.

Migration 040 also defines an unwired immutable attempt-provenance table and same-transaction read/write helpers for the later engine layer. It records either `legacy-observation-absent` or `no-statistics` and cannot grant exploration authority. The engine and v1 policy/decision formats were not changed.

Gate: daemon build exit 0; 4 files, 31 tests passed, exit 0. Tests cover fresh/reopen, frozen snapshots, exact replay/conflict, foreign/stale/incomplete/unsafe estimates, hostile objects without traps, raw preapproval policy bypass, postapproval/first-attempt denial, UPDATE/DELETE/REPLACE/UPSERT, corruption, pre-040/partial migration behavior, and attempt provenance.

This is a store-only unit. Default selection, engine provenance wiring, UI/IPC controls, live price/statistics ingestion, and paid exploration dispatch remain unqualified.
