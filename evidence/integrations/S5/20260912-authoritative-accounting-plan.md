# S5 authoritative accounting snapshot plan

Date: 2026-09-12 KST  
Status: design only; Unit 1 remains **BLOCKED after correction 2/2**

## Boundary and done gate

Implement a new read-only `daemon/src/evaluation/authoritative-accounting.ts` plus `daemon/test/integration-evaluation-authoritative-accounting.test.ts`. Done means its focused test passes and proves complete database-enumerated membership, derived classes, bounded fixed-cutoff replay, tamper/race failure, and zero writes. Maximum two implementation attempts; every pass reruns the focused test, nonincremental typecheck, `git diff --check`, and an owned-path check. A failed pass gets one new-hypothesis correction, then stops.

Migration 034 and `daemon/src/evaluation/measured-facts.ts` stay frozen. Core capture/read stays quarantined by the independently passed containment. No migration, Core, budget manager, driver, selection, promotion, report, or UI source is owned. This component does not repair or expose Unit 1; a later reviewed v2 may consume its result.

The new trust boundary is deliberate: the store enumerates the authoritative inventory from SQLite. The caller supplies only `{runId, cutoff?}` and cannot submit item IDs, classes, units, totals, or evidence. This replaces validation of a caller-selected subset with derivation of the complete bounded set.

## Current sources and dependency

- `daemon/migrations/008_integration_budget.sql`: monetary policy, reservations, revisioned receipts.
- `daemon/src/budget.ts`: preserve latest-receipt, final-actual, pending-upper, debt, currency/unit semantics; a terminal orchestration handoff/receipt is never billing proof.
- `daemon/migrations/021_local_invocation_budget.sql`: mutually exclusive local budget and one immutable reservation per attempt.
- `daemon/migrations/010_orchestration.sql` and `016_orchestration_retry.sql`: attempt/task membership, original plan payload, retry link.
- `daemon/migrations/036_s4_recovery_revision.sql` and `daemon/src/orchestration/recovery-policy.ts`: draft revision/attempt linkage and revision-step payload.
- Blocking evidence: `20260912-measured-facts/review.md` SHA-256 `975b38710c7fd81d4ce57f8a5eaacf1055fa5c55e5b9f80ec30f1e0601b7fa9c`; containment review SHA-256 `bb4295b39d17dbf7c79a16d2d699fc230e514424e2224b3aa0452afe60c2e9d0`.

S4 Unit 1 migration 036 is active concurrent work. Its final independent review, source/dist parity, immutability, and role-bearing revision payload contract are prerequisites. Do not assume the original `orchestration_plan.payload` role when an attempt has `orchestration_attempt_revision`; until 036 is reviewed stable, return `lineage-unavailable:s4-revision-unverified`, never a class.

## Typed API

```ts
type Cutoff = Readonly<{schema:'cue-accounting-cutoff-v1'; runId:string;
  reservationRowid:number; receiptRowid:number; localRowid:number;
  attemptRowid:number; retryRowid:number; attemptRevisionRowid:number; planRevisionRowid:number;digest:string}>;
type CostClass = 'base'|'retry'|'verification'; // handoff unsupported by current schema
type Item = Readonly<{requestId:string;attemptId:string;taskId:string;revision:number|null;
  role:string;retryOf:string|null;costClass:CostClass;upperUnits:number|null;
  latestAtCutoff:Readonly<{receiptId:string;revision:number;kind:'actual'|'estimated'|'unknown';units:number|null;providerFinal:boolean;payloadDigest:string}>|null}>;
type HistoricalSnapshot = Readonly<{version:'cue-authoritative-accounting-snapshot-v1';runId:string;
  cutoff:Cutoff;kind:'monetary'|'local-invocation'|'unknown';currency:string|null;unit:string|null;
  items:readonly Item[];committedUnits:string|null;actualUnits:string|null;
  totalUnits:string|null;completeAtCutoff:boolean;unknownReasons:readonly string[];digest:string}>;
type CurrentDisclosure = Readonly<{requestId:string;currentLatestRevision:number|null;newerThanCutoff:boolean}>;
type Projection = Readonly<{historical:HistoricalSnapshot;currentDisclosure:readonly CurrentDisclosure[]}>;
interface Store { captureCurrent(runId:string):HistoricalSnapshot; projectAt(runId:string,cutoff:Cutoff):Projection }
```

`captureCurrent` starts a deferred read transaction and records each table's `MAX(rowid)` after validating one and only one budget kind. The cutoff digest is only a corruption checksum over maxima, run ID, schema version, and bounded inventory; it does not authenticate authority because any caller can recompute it. `projectAt` therefore exposes an explicitly historical, `completeAtCutoff` projection and never claims current-run completeness or accepts a cutoff as billing authority. Both methods are read-only; SQLite authorizer/`total_changes()` tests prove no INSERT/UPDATE/DELETE. IDs are bounded to 128 bytes, inventory to 4096 reservations and 4096 receipts, payload to 1 MiB each, safe integers only, and output to 2 MiB; overflow fails closed.

The cutoff is a database sequence boundary, not wall-clock billing truth. Historic latest is the maximum `(revision, rowid)` with `rowid <= receiptRowid`. `currentDisclosure` is queried separately without that predicate and is excluded from the historical canonical bytes and digest, so later receipts can change disclosure without changing replay. A future immutable v2 fact must accept caller IDs only, call `captureCurrent` internally, and atomically persist its trusted cutoff/digest in its own authenticated or database-bound store outside this module. Its read path passes that stored cutoff to `projectAt` and compares the historical bytes; no caller-supplied cutoff becomes authoritative. Missing or changed old rows then fails integrity. No such v2 table or authority exists yet.

## Exact enumeration and joins

Monetary inventory uses this shape, ordered by `r.request_id`:

```sql
FROM integration_budget_reservation r
JOIN integration_budget b ON b.run_id=r.run_id
JOIN orchestration_attempt a ON a.attempt_id=r.attempt_id AND a.run_id=r.run_id
LEFT JOIN integration_budget_receipt x ON x.run_id=r.run_id AND x.request_id=r.request_id
 AND x.rowid<=:receiptCutoff AND x.revision=(SELECT MAX(y.revision)
   FROM integration_budget_receipt y WHERE y.run_id=r.run_id
   AND y.request_id=r.request_id AND y.rowid<=:receiptCutoff)
WHERE r.run_id=:runId AND r.rowid<=:reservationCutoff
```

Separately reject any bounded receipt lacking a bounded reservation, duplicate latest revision, reservation lacking its attempt, cross-run attempt, or reservation/receipt scalar mismatch with its canonical JSON payload. Hash exact stored receipt payload. Enumerate every reservation, including no receipt, estimated, unknown, and non-final receipt. Recompute `committedUnits`, `actualUnits`, remaining/debt rules exactly as `createBudgetManager.snapshot`; `totalUnits` is non-null only when every item is provider-final actual and convertible under one currency/unit. Otherwise retain items and set total null/`completeAtCutoff:false` with explicit reasons. Zero means authoritative empty/zero, never missing.

Local inventory is `local_invocation_reservation l JOIN local_invocation_budget b USING(run_id) JOIN orchestration_attempt a ON a.attempt_id=l.attempt_id AND a.run_id=l.run_id AND a.task_id=l.task_id AND a.candidate_id=l.candidate_id`, filtered by both rowid cutoffs and ordered by `l.request_id`. Count all rows as committed dispatches; do not call them provider calls or monetary cost. Reconstruct and hash budget/reservation payloads and fail on mismatch.

For each attempt, left join `orchestration_retry_link rl ON rl.attempt_id=a.attempt_id`, and derive role as follows: if `orchestration_attempt_revision ar` exists within cutoff, require the exact `(run_id,revision,task_id)` `orchestration_revision_step`, matching `orchestration_plan_revision`, verified payload hashes, and parse the validated step payload role; otherwise require no active revision linkage and parse the immutable original plan task. Missing, conflicting, post-cutoff, or unreviewed-036 lineage is `unclassified` and makes `completeAtCutoff` false.

Classification is deterministic and mutually exclusive: a valid `rl` makes `retry`; otherwise a validated checker/verifier plan role makes `verification`; otherwise a recognized producer/implementation role makes `base`. Preserve role and `retryOf` as separate facts. Current tables contain no separately billed handoff lineage, so `handoff` is unavailable. Never infer it from `orchestration_handoff`, terminal receipt text, artifacts, task names, or caller prose. Unknown roles are explicit `unclassified`; they are not forced to base.

## Integrity, races, replay, and tests

- Use one deferred read transaction for cutoff plus historic rows. A second connection appending a later receipt either commits after the snapshot and appears only as current-latest on a later read, or causes a bounded retry/`accounting_snapshot_busy`; it cannot enter half the inventory.
- Before returning, rerun bounded membership counts and canonical row/payload hashes in the same transaction. Reject payload/scalar divergence, duplicate/cyclic retry links, cross-run links, missing plan tasks, invalid revision parents, and cutoff values above current maxima.
- Historical canonical JSON sorts items/reasons and encodes integer totals as decimal strings; SHA-256 covers version, run, cutoff, all historic items, totals, `completeAtCutoff`, and reasons. It excludes current disclosure. No host callback or filesystem/network evidence participates.
- Test two reservations where a caller could formerly omit one: both appear and total includes both final actuals; pending/estimated/unknown/non-final rows remain visible and make total unknown without omission.
- Test latest receipt revision at cutoff versus a newer appended revision: historical bytes/digest remain identical while only current disclosure changes, and a fresh `captureCurrent` changes; deletion or mutation of an old row makes stored-digest comparison fail. Test that a self-consistent caller-chosen lower cutoff remains historical projection only and never gains current completeness/authority. Use a fixture with guards disabled only to simulate database tampering.
- Test base, retry, and checker/verifier classification from stored lineage; caller has no class field. Test unknown role, missing revision step, cross-run retry, and separately billed handoff request as explicit unavailable/failure, never fabricated zero.
- Test monetary/local mutual exclusion, orphan receipt/reservation/attempt, payload mismatch, duplicate latest, >4096 rows, oversized payload/output, unsafe integer, and current-max cutoff forgery.
- Test two SQLite connections at the cutoff boundary and assert one coherent before/after snapshot, stable ordering, no writes, unchanged `total_changes()`, and unchanged counts in migration 034/Core tables.
- Run focused test independently without importing `measured-facts.ts` or invoking blocked Core. Then run budget/local-budget/recovery-policy regression tests and typecheck. This proves the new component in isolation; it does not approve old factory 034, remove containment, close S5 Unit 1, or authorize budget, selection, execution, promotion, provider, model, native, network, or paid activity.
