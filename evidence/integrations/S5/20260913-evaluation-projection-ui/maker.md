# Evaluation projection bridge maker evidence

## Scope delivered

- Core derives `evaluation-projection:<sha256(JSON.stringify([enrollmentId,observationId]))>` from exact public input `{enrollmentId,observationId}`, verifies stored enrollment/observation workspace lineage, and delegates persistence to the existing immutable projection store.
- IPC keeps the prepared-run/current-enrollment gate and returns a validated bounded projection DTO with `trial:null`, fixed non-convertible reasons, and `promotionEligible:false`.
- Renderer adds the explicit `비교용 기록 저장` action for the current stored observation and labels the output as a derived descriptive record, not a new measurement or policy-promotion basis.
- No schema, projection-store, comparison, measurement, runtime, approval, or policy semantics changed.

## Two-pass cap and receipts

Pass 1 implemented the bounded production path and initial tests. The first focused run had 13 passing tests and two new-fixture failures because the fixture enrolled after setting task state to failed (`evaluation_enrollment_run_started`). After correcting only fixture order, the next run still had 13 passing tests and two fixture failures because the fixture attempted to seed a foreign-workspace enrollment through protected Core (`evaluation_unavailable`). Seeding that foreign record through the underlying store matched the existing containment-test pattern. A table-name fixture error (`selection_policy` versus `selection_policy_snapshot`), an unavailable stored outcome expectation, and persisted-config worktree override were then corrected within this first verification pass. The focused gate reached 15/15 passing tests.

Pass 2 added projection DTO outcome/reason consistency, hostile projection DTO coverage, actual foreign-workspace Core-to-IPC coverage, and stale/failure DOM coverage. The final attempted focused gate was:

```text
cd daemon
npx vitest run test/integration-evaluation-ui.test.ts test/integration-evaluation-projection-core.test.ts test/integration-evaluation-trials.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
```

Result: all 16 tests and assertions passed, but the process reported one unhandled rejection and is therefore not a passing final gate. The new stale-projection DOM test closes JSDOM while its second goal-submit render is still pending:

```text
TypeError: Cannot read properties of undefined (reading 'querySelector')
at renderApprovalPlan (integration-evaluation-ui.test.ts fixture-evaluated renderer line 73)
```

Required bounded follow-up: settle the second goal-submit async renderer work before resolving the stale projection and closing JSDOM, then rerun the focused gate, build, and syntax checks. No further maker edits or runs were made after the two-pass cap.

An earlier, non-final production-state check passed before the pass-2 IPC validator and tests:

```text
cd daemon && npm run build
# tsc -p tsconfig.json && node scripts/copy-assets.mjs: passed

node --check app/core.mjs
node --check app/ipc.mjs
node --check app/renderer/renderer.js
# passed
```

This earlier build and syntax result is evidence only; it is not the final gate for the current hashes.

## Current hashes before root fixture correction

```text
1b159c6c1f98327674994b8463d7d970742597534c52ab572f045f61d0f99865  app/core.mjs
fedf29dfc94560dc4a93b0822026ae98c64240aabe715303343d89224435632a  app/core.d.mts
5887da5e9e0f2d32380a4a77f643e40218ef8a5b4ffc4d904841051a01facde9  app/ipc.mjs
743e4a3c487d87462f9de47d6f796b8d208c1ba010868f748c51c480d0ea42ae  app/ipc.d.mts
558b36c020d4d2e59221ba19625f51b5f06e6b06d3cb766a6be3731ddfc4efef  app/renderer/index.html
284ac295481d21360b260d07c324141bc73a9be145a0d5b064f576b96952081c  app/renderer/renderer.js
a44f2eee058d612358eb05d7023aa6ac18bc39bb33fbc7e2e213c9267e203563  daemon/test/integration-evaluation-ui.test.ts
c3f3f724f5af9859dfeb9a758a3e8b3baccbd61ccfa7b89559dae6e334c07de8  daemon/test/integration-evaluation-projection-core.test.ts
d39b7fd60a32add93a7bd93018936eb815ab2be564710678b20e596fc712c39c  evidence/integrations/S5/20260913-evaluation-projection-ui/PLAN.md
```

These pins intentionally exclude `maker.md`, which records them, and will change if the root applies the documented test-only fixture correction.
