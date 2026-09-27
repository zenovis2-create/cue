# Batch86 — Claude stop settlement

Date: 2026-09-22 (host clock). Scope: S1 inactive second-agent executor / cancellation lifecycle prerequisite. **Implemented and locally tested; independent review pending.** Original checklist remains 44 total / 33 closed / 11 open.

## Defect and fix

`daemon/src/adapters/claude-cli-executor.ts` previously settled `completion` after local child `close` and activity delivery, even if `stopOwnedTree` was still pending. A later rejection or timeout updated `stopUnverified` too late: the immutable promise had already returned `failed` rather than `unknown`. Even a later successful acknowledgement could arrive after completion.

Three parameterized fake-process tests reproduce the ordering defect on unchanged production code (`baseline.log`: exit 1, 12 pass / 3 fail). The three-line production addition awaits the existing bounded `stopping` promise after activity settlement and preserves `unknown` on rejection. It introduces no new timer, launch authority, cleanup receipt, or provider/billing inference.

Positive case: after local close, completion remains pending until stop acknowledges, then returns cancelled/failed (never success). Negative cases: delayed stop rejection and the existing 1,000 ms stop timeout both return unknown with the durable session handle retained. The tests check that provider terminal remains null. Existing normal success, missing identity, no-close, activity rejection and idempotent cancellation still pass.

## Verification

Commands below ran in `daemon/`, with output saved beside this file:

1. Baseline: `npx vitest run test/integration-claude-cli-executor.test.ts --fileParallelism=false --maxWorkers=1 --reporter=verbose` — exit 1, expected 3 new failures (`baseline.log`).
2. Focused: `npx vitest run test/integration-claude-cli-executor.test.ts test/integration-claude-cli-owned.test.ts test/integration-claude-cli-protocol.test.ts --fileParallelism=false --maxWorkers=1 --reporter=verbose` — exit 0, 3 files / 22 pass (`focused.log`).
3. Build: `npm run build` — exit 0 (`build.log`).
4. Regression: `npx vitest run test/integration-runtime-contract.test.ts test/integration-executors.test.ts test/integration-provider-lifecycle.test.ts test/integration-driver-provider-lifecycle.test.ts test/integration-native-compiled-imports.test.ts test/p45.test.ts --fileParallelism=false --maxWorkers=1 --reporter=verbose` — exit 0, 6 files / 55 pass / 1 existing Windows cwd skip (`regression.log`). Includes real Node import of the compiled Claude executor, SQLite lifecycle guards, local test HTTP transport and existing native AppContainer launch-boundary regression.

Final passing file sets are disjoint: **9 files, 77 pass, 1 existing skip**. This is not a full `npm test` run, independent review, or actual Claude/provider qualification. One production correction; no failed post-fix run.

## Self-review and limits

- Local child close, stop acknowledgement, independent whole-tree cleanup, remote provider terminal and billing remain separate facts.
- Awaited stop is already bounded by the existing timeout; a hanging host callback cannot hang completion indefinitely.
- Normal no-stop completion remains unchanged. No new skip or test exemption.
- The candidate remains inactive. Credential/config isolation, account observation/authorization, registration and actual second-agent qualification remain open.
- No model/provider/account/service calls; Qwen remains OFF, subscription allowance remains 4/4 spent. Local test processes/HTTP fixtures are not the user's model endpoint.
- No independent reviewer was available; this document is implementation evidence and self-review only. No parent checkbox is closed.
- Existing unrelated changes preserved; no commit or publication. Exact preimages saved before edits. Evidence directory was renamed from `20260920-claude-stop-settlement` to the measured host date `20260922-claude-stop-settlement`; captured logs were not modified.

## SHA-256

| File | SHA-256 |
| --- | --- |
| `daemon/src/adapters/claude-cli-executor.ts` | `252e94da09883e5cb999294dacedd8b0974626ad8970016698f625496c6c97bc` |
| `daemon/test/integration-claude-cli-executor.test.ts` | `f78bde8c039639c05cd32810523a43460444f59cb7b9706e11e002bf1e61ea09` |
| `baseline.log` | `bceb0aee2609e959891ca9f37ee569da73a63ed9fb668aa7742dc823d65da417` |
| `focused.log` | `ff5b25c27c64edc2bef0d0c4fa7a55cd167032adba51c633116968ce40e23688` |
| `build.log` | `743b39c3f88e0e76ba79dc6b4e1b51650875199b69c411b5419f6d3bc01be8b2` |
| `regression.log` | `809780857f9e01c5a4d50db79752f4dcd51e183284a7d3f66899aa69ca0b2db7` |
