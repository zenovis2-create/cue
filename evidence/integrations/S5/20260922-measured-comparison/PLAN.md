# Batch95 — durable measured-comparison backend

Direct implementation/self-review. Qwen OFF, subscription4/4 exhausted; no live provider/account/model calls, GUI gates, publication or credentials. Preserve prior dirty work and preimages.

Implement separately versioned measured comparison snapshots in the existing immutable evaluation_comparison_snapshot envelope (no schema migration or upgrade of outcome-only rows). Explicit enrollment membership, one dataset/mode/policy per arm; resolve latest observation and its exact fact, never fall back to an older convertible fact. Preserve every expected evaluation/holdout slot and unavailable/fail/cancel/unknown counts with expected-case denominators. Withhold numeric subset comparison when any slot is missing/nonconvertible; do not cherry-pick successful subsets. Refuse mixed quality metric comparisons.

Only the real stored-fact converter supplies receipts at creation. Save canonical source-bound receipts and result at host clock, bounded1MiB/64cases per dataset. Read historical snapshots without provider/evidence callbacks and recompute trial numeric values/identities from immutable fact/contracts/handoff partition sources; new billing/evidence changes do not rewrite history. Separate inspect operation revalidates saved facts/latest reference identities and returns changed/unavailable separately. Promotion always false, fixture provenance explicit.

Validate before callbacks, ledger-local reentry fence, DB epoch around all capture reads and recheck under final IMMEDIATE writer lock; no callbacks under lock. Workspace-scoped Core APIs; no new UI/IPC or producer configuration in this bounded batch. Retain old snapshots/APIs and parent33/44 count.

Test durable Core/SQLite capture/read/replay/reopen, source tamper, missing facts/observations/enrollments, latest-only selection, partial denominators, default host unavailable, explicit lineage/hostile shapes, concurrency and rollback. Use synthetic complete measurement fixtures, not real qualification. At most two correction hypotheses per blocker before replan.
