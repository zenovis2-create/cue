# Maker evidence

Implemented a private `WeakMap` fact minted only for non-OK `fetch` responses. The exported reader returns one of `local-http-401`, `local-http-403`, `local-http-408`, `local-http-429`, `local-http-5xx`, or `local-http-other`; these codes state only the observed HTTP class. The isolated adapter latches that fixed code through its existing first-cause `stop` path. All other exceptions, including errors with forged diagnostic properties or matching messages, remain `transport-failed`. HTTP 200 with no body retains the existing `local model HTTP 200` message but has no HTTP rejection fact.

No response body, status text, headers, arbitrary exception text, provider cause, retry eligibility, recovery effect, schema, or host behavior is persisted.

## Verification

First focused pass failed one test because the test fixture's default parameter substituted its synthetic transport when passed `undefined`:

`integration-isolated-model-diagnostics.test.ts > preserves privately issued local HTTP rejection classes`: expected mocked child `kill` to have been called. The correction explicitly supplied `streamLocalModel`; no product code was changed for this failure.

Final focused gate:

`npm exec vitest run -- test/integration-local-http-failures.test.ts test/integration-isolated-model-diagnostics.test.ts test/integration-handoff-activity.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`

Result: PASS, 3 files and 26 tests.

Final build:

`npm run build`

Result: PASS (`tsc -p tsconfig.json && node scripts/copy-assets.mjs`).

The prohibited native and real HTTP fixture suites were not run.

## Final pins

- `daemon/src/adapters/local-model.ts` `E4FFF604DD3804F35EB9570F5DCAFFD1D9C52A81B7B3D922D4183220F20439C3`
- `daemon/src/adapters/isolated-local-model.ts` `FF6EE56F88E6DC16D051E1238DCF527D2828A40E25DDB897D76F78D358F992DC`
- `daemon/src/orchestration/failure-diagnostic.ts` `F782B110D60177849441321C8705C28961543EC94569CCFE52720E6C0B46249D`
- `daemon/test/integration-local-http-failures.test.ts` `17B9B863D1D216A50ACE87AEA81F30DCC7CEE01E139713DEC4AADB06D90206A5`
- `daemon/test/integration-isolated-model-diagnostics.test.ts` `23E54581B8FF2F49E42103D679F69128B87F266EE792E31E100510DFFD1422B6`
- `daemon/test/integration-handoff-activity.test.ts` `EDB7F836A2D4252AABC94B8B04D0F34035D760828695B36428FC49C811959348`
- `evidence/integrations/S4/20260913-local-transport-failures/PLAN.md` `E78DCA0ECC9011CF23B8ADE33D6D55F39E9ED9600C66F42F7082B0D1C3F37E65`
