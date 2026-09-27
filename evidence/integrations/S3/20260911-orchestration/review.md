# S3 durable scheduling — independent review

Date: 2026-09-11
Reviewer: native agent `transport_review`; source implementation by `reuse_pure`, ledger/build wiring by parent.
Verdict: **PASS for the host-owned durable scheduling foundation**. No remaining blocking finding within this store's contract. Live unified orchestration and S3 product completion are not approved by this review.

## Independent evidence

Reviewed store source, migration 010, focused tests, plan API dependency, migration wiring, existing writer lease schema and generic recovery interactions.

Working directory `C:/Users/User/cue/daemon`:

```text
npm run build
exit 0
npx vitest run test/integration-orchestration.test.ts test/integration-budget.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
19 pass, 2 files pass, exit 0
```

The current run includes all 10 store tests and 9 budget regressions. Before the final lease guard, the reviewer also ran the 10 store cases independently; current evidence is the post-change combined run above. No real models were called and no full-suite claim is made.

| Source | SHA-256 |
| --- | --- |
| `daemon/src/orchestration/store.ts` | `453D9F8B9A2DCD3DE13528B36A5C8507B2C9935024A1BE63D3E2258B71A185EB` |
| `daemon/migrations/010_orchestration.sql` | `AF1CF0915272B4922D32C7896EE0C0BD391DFE0B4904CF5D205EE8D16104797A` |
| `daemon/test/integration-orchestration.test.ts` | `B60E5622687E5A759EAA1DF7788B0C3E833B365F893CAB8032ED77DD07E1B923` |
| `daemon/src/ledger.ts` | `FD48D3C999516CB672F132948421C5ECE726DC6C7AAAA0F63AC1BB66DB76DD81` |
| `daemon/scripts/copy-assets.mjs` | `5F1B15AE0962FD94AD430BDB7DDB9B416F044774545064A77A4F42DE21F92C14` |

## Review outcomes

- Only a new atomic claim returns `launchRequired:true`. Exact replay returns false for running, completed and recovered-blocked attempts. Changed payload under an existing attempt ID fails. Finish always returns false. The parent identified the initial replay hazard; current source and tests resolve it.
- Claim checks running parent state, candidate membership, dependency readiness and a host authorization callback within an immediate transaction. A unique task attempt prevents duplicate claims; separate SQLite connections in Worker threads produce one claim and one `task_not_ready` result.
- Implementation tasks acquire the existing `workspace_write_lease`, rejecting both same-run and other-run ownership. There is no second writer registry. Read-only role safety still depends on host admission, not role names alone.
- Lease release requires verified clean evidence and matches worktree, run and acquisition timestamp. Unknown cleanup retains ownership. A later clean receipt releases the retained lease while keeping the blocked attempt blocked; it does not retry or promote it to success.
- Review identified that DELETE/UPDATE triggers alone leave a SQL REPLACE path. A BEFORE INSERT collision guard was added and independently tested: both REPLACE and INSERT OR IGNORE against unresolved orchestration ownership are rejected, including the existing same-run lease reuse pattern. Ordinary non-orchestration lease rows are outside that guard.
- Recovery atomically marks running attempts and steps blocked, marks the parent task blocked, and preserves unresolved ownership. Repeating recovery is idempotent. Reopening the DB and reconciling does not create a replacement writer or request a launch.
- Completed step status requires host-verified outcome and cleanup. Dependency readiness can advance, but plan and claim outputs retain `acceptance:'unverified'`; the store does not turn completed steps into accepted requirements or a completed user command.
- Persisted plans bind an existing run/envelope and are revalidated against the stored digest. Plan, activity and receipt SQL UPDATE/DELETE/REPLACE paths are guarded. Events require attempt lineage and contiguous ordinals; changed replay and receipt revision regressions fail.
- Migration 010 is wired through ledger opening and build assets. The test fixture redundantly applies its idempotent SQL; worker and reopen paths use the normal ledger entry point.

## Boundaries and remaining integration

Host authorization and verification callbacks are trusted injection points, not independently measured tool eligibility, actual cleanup proof, budget reservation or filesystem authority. Fixture booleans do not prove those properties. Every real launch still needs current admission, budget reservation, isolated execution and owned process identity.

This store does not launch tools, enforce callback timeouts, resume work, create retry/replan revisions, reserve costs, collect acceptance evidence, integrate UI, or coordinate the entire legacy daemon dispatch/recovery flow. The same existing writer table prevents a parallel ownership registry, but that alone is not an end-to-end scheduler integration test.

Generic recovery currently attempts to delete writer leases; with unresolved orchestration ownership the database guard deliberately throws and rolls back instead of permitting an unsafe release. Unified startup/recovery must handle that blocked state and obtain cleanup evidence before clearing ownership. Live usage is not claimed until that coordination exists.

No application source was modified by the reviewer. Only this review and the related budget review artifact were written.
