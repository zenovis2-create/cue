# Generated recovery observations Unit A maker report

## Result

Implemented a fixed host diagnostic vocabulary and first-cause latching in the isolated local-model adapter. Cancellation and the adapter deadline are distinct. Transport exceptions are never classified from exception text; unknown transport rejection becomes `transport-failed`. Host/native identity commit or final boundary mismatch becomes `native-boundary-unverified`. Protocol parsing and response identity failures become `protocol-invalid`. Output bounds, native I/O, terminal incompletion, cleanup, and native exit have separate fixed codes. Successful results carry no diagnostic.

The existing immutable orchestration terminal activity accepts an optional diagnostic only for `status: failed`, rejects codes outside the fixed vocabulary, and remains backward compatible with terminal activity lacking a diagnostic. The generated JSON host projects only `diagnosticCode`; arbitrary result properties and raw exception/provider text are not persisted.

No recovery callback, recovery classification, handoff fallback, schema migration, native/model execution, network call, or automatic mode was added.

## Files

- `daemon/src/orchestration/failure-diagnostic.ts` — fixed vocabulary and validator.
- `daemon/src/adapters/isolated-local-model.ts` — first-cause diagnostic latching.
- `daemon/src/orchestration/handoff-activity.ts` — optional terminal diagnostic validation.
- `app/generated-json-host.mjs` — sanitized terminal emission.
- `daemon/test/integration-handoff-activity.test.ts` — vocabulary, success rejection, legacy, reopen, and zero-evaluation proxy coverage.
- `daemon/test/integration-generated-json-host.test.ts` — injected-runtime durable SQLite projection and raw-secret exclusion.
- `evidence/integrations/S4/20260913-generated-recovery-observations/PLAN.md` — bounded gate contract and native-suite correction.

All source/test files appeared as pre-existing untracked shared-worktree files in `git status`; no trustworthy Git preimage exists and none is invented. Historical evidence preimages were not used as current preimages.

## Verification

First focused run: 25 passed, 1 failed because app `.mjs` loaded the pre-build `daemon/dist` activity contract. `npm run build` exited 0. The next run reached the new assertion and failed only because the test closed SQLite before `driver.close()`.

Final safe gates:

- `npm exec vitest run -- test/integration-generated-json-host.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1` — 17/17 passed.
- `npm exec vitest run -- test/integration-handoff-activity.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1` — 9/9 passed.
- `npm run build` — exit 0 after the final production change.

The real-native `integration-isolated-local-model.test.ts` was never run. Direct adapter runtime behavior remains source-inspected and build-checked in this unit; independent review must treat that as a limitation rather than native evidence.

## Final SHA-256

- `isolated-local-model.ts`: `046854357DCC60CAD501AA1BD8BA2295D1020DBF06561B9E8B53EF2D6BCE06AF`
- `failure-diagnostic.ts`: `571148AD3427DD4D45128CE4498A2A7ED317914FBDF1C0B395F59A901D1E617E`
- `handoff-activity.ts`: `B6DF1DF93FBC3F160A88418CDA7D123B76541F2597B063C6FDB01BE062ED08BE`
- `integration-handoff-activity.test.ts`: `AF59E505CF212DA646E640E66043F63EECB9B5591E12D21128204309251FEAB2`
- `integration-generated-json-host.test.ts`: `CA4E3D3C6152E51404B27D3C23BA84EAD5E85D5D6B1DADC2DEA367098FF47726`
- `generated-json-host.mjs`: `F72110F8FFA69B3F83D94716C6385566BF773DACD2069C157A4705A6DA65FFAA`
