# S4 Unit 1 independent correction 1 review

Date: 2026-09-12

Verdict: **FAIL — final correction required**

## Independent gate

From `daemon`:

```powershell
npm run build
npx --no-install vitest run test/integration-recovery-policy.test.ts test/integration-evidence-policy.test.ts test/integration-retry-backend.test.ts test/integration-requirements.test.ts test/integration-acceptance.test.ts test/integration-driver.test.ts test/integration-handoff-activity.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
npx --no-install tsc -p tsconfig.json --noEmit
```

Build and TypeScript passed. Vitest passed 85/90 tests and failed five:

1. The legacy compiled-helper test fails in `revisionPlan` with `no such table: orchestration_recovery_scope`.
2. The positive clean transient retry fails with `retry_previous_not_clean_failed`.
3. The cumulative/per-task cap test fails with `retry_previous_not_clean_failed`.
4. The atomic budget/stage rollback test reaches `retry_previous_not_clean_failed` instead of its expected preparation failure.
5. The two-connection consume-once test returns two `retry_previous_not_clean_failed` results instead of one claim and one `retry_previous_consumed`.

The separate maker-expanded gate reported 98/103 with the same five failures. The difference in total count comes from additional suites not named in the original seven-file command; it does not change the failing product/fixture paths.

## Current correction-1 blockers

- The five failures above must be repaired without weakening the typed S3 terminal receipt requirement. Legacy schema detection must occur before querying a 036 table. Current retry fixtures must provide the actual verified 033 lineage rather than restoring the old boolean-only shortcut.
- The explicit generated-host revision-one positive fixture fails `generated_checker_revision_required`: verifier launch reads the stage, then calls `runData(runId)` without passing the stage's exact revision and plan digest. This is a current product-path blocker and the final gate must include `integration-generated-acceptance-host.test.ts` explicitly.
- A remaining reentrant atomicity window exists in `recovery-policy.ts`: monetary/local availability is snapshotted before the later `host.now()` callback. A host closure can reserve the final budget slot from that callback on the same ledger, after which the code persists a non-stop decision using stale `budgetAvailable=true`. The final correction must either snapshot all host facts before the authoritative in-transaction DB facts, or detect/reject reentrant ledger mutation, and must prove the actual final-slot reservation plus absence of a stale non-stop decision.

## Findings resolved before correction 2

The correction-1 bytes now bind scalar columns to payloads, revalidate public reads, require S3 terminal integrity, choose alternate candidates from host-observed approved inventory, preserve quota not-before behavior, supersede old pending/blocked revision steps, use the existing monetary/local budget summaries, wrap authoritative decision reads and insertion in an immediate transaction, bind revision-one handoff launch intent through `attempt_revision -> plan_revision`, evaluate the registered checker, bind all producer principals, and freeze/revalidate an evidence source revision distinct from the plan digest. These historical findings are not current blockers.

## Reviewed hashes

```text
2681f4d95afcbed98aadc12d4ab9ff72b494f58efbb0cd7da6ee42e0fe96360b  daemon/src/orchestration/recovery-policy.ts
a513412a81871a3ccb150e9d91f2b1a057f423c746e34ba41066ada6ff6e0e34  daemon/src/orchestration/store.ts
84191f68fc8be82cd13e38743ae041682a049ee8cb3273fda84cecaac197069f  daemon/src/orchestration/handoff-activity.ts
ec5ca58e9249e332200665fc5fe5b3fbbb9ab2fce48b2728d785450b4304c614  daemon/src/verification/acceptance.ts
f48341752511aa129963cc159143ce90eb5c161b96d6bef8d589c3137bc58767  daemon/src/verification/evidence-policy.ts
571392539735db7ff81121d6d71efbc64c5af2307a661dc5d6ca1a104a962de9  daemon/src/verification/generated-acceptance-host.ts
82ffca12c48c65d17d5a48deab7a7377a2877a868f147817cc021af6d8809826  daemon/migrations/036_s4_recovery_revision.sql
e022bbae8412cb566beb420b33a2ba8321ba2f3d74f354dc5beaa8b1f8b61664  daemon/test/integration-retry-backend.test.ts
```

The reentrant final-slot scenario is a source-level counterexample at this review point; it still requires an executable regression test in correction 2. No claim is made that it was independently executed in correction 1.
