# S2-02 persisted cost dimensions plan

## Done

- Monetary and local engines ingest optional immutable cost/capacity observations through their real terminal receipt transaction.
- Persisted rows bind exact run, attempt, candidate, current launch subject, and either an approved account identity (API/subscription) or exact local attempt identity (local-resource), plus source bytes/digest and freshness fields.
- Snapshot/UI distinguish API, subscription, and local-resource; actual, estimated, unknown; fresh, stale, and future without converting units or describing quota/local invocation units as money or free service.
- Missing observations remain unknown. Observations grant no billing, budget, candidate, or selection authority and cannot create or finalize a budget receipt.
- Direct engine-to-store-to-snapshot-to-renderer fixtures cover every dimension and freshness/state distinction, replay/tamper rejection, and missing-data clearing.

## Gates

- Focused Vitest from `daemon/`: `npx --no-install vitest run test/integration-persisted-cost-observation.test.ts test/integration-engine.test.ts test/integration-local-engine.test.ts test/integration-cost-observation-ui.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`.
- TypeScript from `daemon/`: `npx --no-install tsc -p tsconfig.json --noEmit --pretty false`.
- Renderer syntax: `node --check app/renderer/renderer.js` from repo root.
- Root owns the shared build and ledger bootstrap edit.

## Loop contract

- Attempt cap: 2 per hypothesis.
- Every pass runs the focused gate, no-emit typecheck, and renderer syntax check.
- Failure requires a new hypothesis or handoff; regressions are reverted.

## Exact preimages

- `daemon/src/orchestration/engine.ts`: `de67f4a507f8f928ff0f490338eb585be6ff88695fa38809a5458c8c12e18109`
- `daemon/src/ui/orchestration.ts`: `4148694bd772d80dd0ab5a7e6494df4cb83f407c708ce08d12a25f05463f9aba`
- `app/renderer/renderer.js`: `3f680825b43b775c4e7d686a0053b08db5371809f0ff197e36b1ba0ba6839b17`
- `daemon/scripts/copy-assets.mjs`: `d0d025a69310b60386f25b9f3a2ed00ce769eeeb38c7dbb02a3ff81e3e5ce576`
- `daemon/test/integration-engine.test.ts`: `019ebe6581ac26ea80cf8a515a9b72743c33bfc00d78349484c8c9b74ff5e223`
- `daemon/test/integration-local-engine.test.ts`: `3c8728e4c01bb5b5759f02704880c3895c648b0835005128d313a0a2f9062bd3`
- `daemon/test/integration-cost-observation-ui.test.ts`: `0af156c14a5ae138a0e830ba3af43ccb34c988dc342da6d2807241e3feb88e13`
- Byte-exact copies are stored beside this plan. New module, migration, and focused test have no preimage.

## Limits

- No live provider/model/network/authentication calls; Qwen remains off and the 4/4 live budget remains exhausted.
- No fixed cross-dimension conversion, invoice invention, selection/admission grant, or billing-final authority follows from observation persistence.
