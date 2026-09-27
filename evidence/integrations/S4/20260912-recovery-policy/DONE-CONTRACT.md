# S4 Unit 1 done contract

Date: 2026-09-12

## Scope

Implement only failure disposition, immutable plan revision lineage, and type-specific evidence policy from `evidence/integrations/S4/20260912-gap-design.md` Unit 1. The migration allocation is `036_s4_recovery_revision.sql`; `037` remains uncreated and reserved for Unit 2.

No Core/evaluation/request-queue/handoff behavior changes, filesystem restoration, worktree reconciliation, native process execution, renderer work, provider/model calls, networking, paid calls, or credential handling are in scope.

## Done means

- A host-observed terminal failure produces exactly one immutable `retry | switch | replan | stop` decision under the frozen original recovery scope.
- An executable nonzero plan revision is selected explicitly and identically by readiness, claim, stage-envelope creation, and acceptance history; old pending steps cannot launch and no implicit latest-revision lookup grants authority.
- Attempts, monetary/local budgets, caps, deadline, original approval/envelope/policy, requirement text, targets, checker revisions, and parameters remain cumulative or frozen across revisions.
- Code, research, document, and external evidence policies fail closed at approval registration and final acceptance for their exact target/checker/independence/source bindings; broad suite success, process exit, model reports, request acknowledgement, and missing/unknown observations cannot satisfy completion.
- Migration reopen, append-only guards, digest tampering, legacy rows, foreign keys, source/dist byte equality, and outer-transaction behavior are covered.
- Existing `033` and `035` positive lifecycle behavior remains green.

## Attempt cap and every-pass gate

Initial implementation plus at most two correction passes. Every pass runs from `daemon`:

```powershell
npm run build
npx --no-install vitest run test/integration-recovery-policy.test.ts test/integration-evidence-policy.test.ts test/integration-retry-backend.test.ts test/integration-requirements.test.ts test/integration-acceptance.test.ts test/integration-driver.test.ts test/integration-handoff-activity.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
npx --no-install tsc -p tsconfig.json --noEmit
```

From the repository root:

```powershell
git diff --check -- daemon/migrations/036_s4_recovery_revision.sql daemon/src/ledger.ts daemon/scripts/copy-assets.mjs daemon/src/orchestration/recovery-policy.ts daemon/src/orchestration/plan.ts daemon/src/orchestration/store.ts daemon/src/orchestration/engine.ts daemon/src/verification/evidence-policy.ts daemon/src/verification/requirements.ts daemon/src/verification/acceptance.ts app/orchestration-driver.mjs app/orchestration-driver.d.mts daemon/test/integration-recovery-policy.test.ts daemon/test/integration-evidence-policy.test.ts daemon/test/integration-retry-backend.test.ts daemon/test/integration-requirements.test.ts daemon/test/integration-acceptance.test.ts daemon/test/integration-driver.test.ts
```

Also reopen a temporary SQLite ledger, run `PRAGMA integrity_check` and `PRAGMA foreign_key_check`, and compare SHA-256 bytes for source and deployed migration `036`.

## Hostile gate

The focused tests must reject forbidden cause/action pairs, caller-selected branches, unknown cleanup/effects, unapproved switches, unsupported quota retry, unchanged quality retry, post-seal actions, widened or incomplete revisions, stale/forked revision lineage, old-revision claims, cross-revision cap/budget reset, self-review, missing targets, stale or model-origin observations, unmapped research claims, missing document render/structure checks, and unconfirmed external state.

## Correction rule

On failure, retry only with a new hypothesis tied to the exact counterexample. Keep a correction only when the hostile gate improves and the previously green focused set does not regress. Roll back a regressing correction. After two failed correction passes, preserve the failure and hand back the exact counterexample.
