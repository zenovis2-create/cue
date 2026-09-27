# Independent review: PASS

Done definition: verify the final source against the captured preimages; run the exact safe focused Vitest gate; inspect the actual mocked `streamLocalModel` -> isolated adapter path, durable activity acceptance, first-cause handling, and unchanged success contract; independently challenge the classifier with forged and hostile values. Attempt cap: two evidence-writing/correction passes. Per pass: exact diff inspection, focused tests, pin verification, and scoped diff check. This review completed in one pass.

## Verdict

PASS. The change creates a private host-issued fact only after an actual non-OK mocked `fetch` response. Its finite codes are deterministic: 401, 403, 408, 429, 500-599, and other non-OK status. HTTP 200 with a missing body remains an ordinary unclassified error. The isolated adapter reads the private fact and latches it through the existing first-cause `stop` path; it does not infer provider authentication, quota, retry eligibility, candidate state, external effects, or recovery authority. Default unknown-stop authority is unchanged.

The actual composition is covered rather than only a mapper: `integration-isolated-model-diagnostics.test.ts` supplies the real `streamLocalModel`, mocks `fetch` with HTTP 429, drives the mocked child request, and observes `local-http-429` on the adapter result. `integration-handoff-activity.test.ts` accepts and reopens the same fixed code through the durable activity store. Cancellation/deadline distinction, later-error first-cause retention, arbitrary transport sanitization, successful adapter completion without a diagnostic, and malformed/native failure behavior all remained in the focused gate.

The `WeakMap` reader performs no arbitrary property or prototype reads. An independent built-output challenge passed for null, primitive, function, copied-message/property forged object, forged `Error.prototype` object, and a hostile proxy: all returned null and the proxy's `get` and `getPrototypeOf` traps were invoked zero times. Copying message, prototype, or diagnostic-looking properties cannot mint the private identity. Source inspection confirms only the numeric status is retained in the minted `Error`; response body, status text, headers, and arbitrary exception text do not enter the diagnostic result. The HTTP 429 adapter test also asserts the provider secret body/status text are absent.

The success parser/SSE body is byte-for-byte unchanged from its captured preimage after the two split rejection checks. The existing mocked successful-close adapter test passed. Per the contract, the real HTTP fixture/local-model suite and native isolated-model suite were not run, so this review makes no live server, native boundary, model, network, or UI claim.

## Independent gates

Command:

`npm exec vitest run -- test/integration-local-http-failures.test.ts test/integration-isolated-model-diagnostics.test.ts test/integration-handoff-activity.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`

Result: PASS, 3 files, 26 tests.

Built classifier challenge: PASS, 6 values, 0 proxy traps.

Scoped `git diff --check`: PASS. Maker build evidence reports `npm run build` PASS after the final source state; the reviewer did not duplicate the unchanged build.

## Final pins

- `daemon/src/adapters/local-model.ts`: `E4FFF604DD3804F35EB9570F5DCAFFD1D9C52A81B7B3D922D4183220F20439C3`
- `daemon/src/adapters/isolated-local-model.ts`: `FF6EE56F88E6DC16D051E1238DCF527D2828A40E25DDB897D76F78D358F992DC`
- `daemon/src/orchestration/failure-diagnostic.ts`: `F782B110D60177849441321C8705C28961543EC94569CCFE52720E6C0B46249D`
- `daemon/test/integration-local-http-failures.test.ts`: `17B9B863D1D216A50ACE87AEA81F30DCC7CEE01E139713DEC4AADB06D90206A5`
- `daemon/test/integration-isolated-model-diagnostics.test.ts`: `23E54581B8FF2F49E42103D679F69128B87F266EE792E31E100510DFFD1422B6`
- `daemon/test/integration-handoff-activity.test.ts`: `EDB7F836A2D4252AABC94B8B04D0F34035D760828695B36428FC49C811959348`
- `evidence/integrations/S4/20260913-local-transport-failures/PLAN.md`: `E78DCA0ECC9011CF23B8ADE33D6D55F39E9ED9600C66F42F7082B0D1C3F37E65`

Captured preimage hashes were checked against `preimages.json`. Exact preimage diffs show no change to `integration-local-model.test.ts`; two bounded cases were added to isolated diagnostics; the durable handoff test substituted one allowlisted diagnostic; production changes are limited to the local transport issuer/reader, adapter propagation, and fixed diagnostic enum.
