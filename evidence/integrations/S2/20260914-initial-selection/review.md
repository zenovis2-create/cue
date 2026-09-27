# Independent review — initial selection and exploration

Verdict: **NOT SHIPPED / rollback verified**.

The attempted backend is not qualified. The three-revision maker cap ended with all eight new behavioral tests failing in fixture construction (`invalid_plan:array-size`), before the assertions exercised cold-start selection, exploration authorization, dual-cap accounting, replay, or SQL tamper resistance. The failed candidate is retained only as audit material under `preimages/revision-3-failed/`; it is not present in product source.

## Rollback verification

- `daemon/src/orchestration/engine.ts` is byte-identical to `preimages/engine.ts`, SHA-256 `6e6f0915c21422ebe937668dccae1f62e4011c46473960125b83180f17dee33c`.
- `daemon/src/ledger.ts` is byte-identical to `preimages/ledger.ts`, SHA-256 `19bcb46c6c3d0c02b2f6b4cf828c1d277072def59ff4e158f2e8535ce394e47e`.
- The paths recorded absent before the attempt are absent after rollback: `daemon/src/selection/initial-selection-store.ts`, `daemon/migrations/040_initial_selection.sql`, and `daemon/test/integration-initial-selection.test.ts`.
- No `initial-selection-store`, `040_initial_selection`, or `initial_selection_` reference remains under current `daemon/src`, `daemon/test`, or `daemon/migrations`.
- Every restored-source, failed-revision archive, and maker-log SHA-256 in `final-pins.json` was recomputed: 13/13 matched, zero mismatches.
- Migration 040 therefore remains uninstalled and absent; migration 039 remains the current last product migration.

## Independent restored-source gates

The maker's successful builds were generated from the failed candidate, so I rebuilt the restored source once from `daemon/`.

- `npm run build`: exit 0. Raw output `logs/independent-build.log`, SHA-256 `89f372151bf1861e05da5fcf17034620efbad440875f28d2f36289729f3aac06`; exit receipt `logs/independent-build.exit`, SHA-256 `c1e97067c5f479a44a6f57297a0a8f87a59d181c3c529910f8bf059094bc3abb`.
- Restored selection/budget/engine/policy/history gate: 5 files passed, 49/49 tests passed, exit 0. Command: `npx vitest run test/integration-selection.test.ts test/integration-budget.test.ts test/integration-engine.test.ts test/integration-policy-store.test.ts test/integration-attempt-selection.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`. Raw output `logs/independent-restored-gate.log`, SHA-256 `f84d526301746a281737fc28aadc03064897fe79fc023d67fe96d43437623d4e`; exit receipt `logs/independent-restored-gate.exit`, SHA-256 `c1e97067c5f479a44a6f57297a0a8f87a59d181c3c529910f8bf059094bc3abb`.

These gates establish that the restored existing backend remains green. They provide no evidence for the removed feature.

## Qualification boundary

Cold-start/default selection and separately authorized paid exploration remain unimplemented. No UI or IPC authorization, trusted production statistics or price ingestion, real provider accounting, provider/model/local-model invocation, Electron, native helper, server, or network behavior was exercised or qualified. The failed candidate must not be used as a source-freeze or completion basis. Any future implementation needs a fresh bounded unit; this capped attempt must not be resumed under a renamed scope.
