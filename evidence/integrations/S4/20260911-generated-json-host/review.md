# Independent generated JSON app-host composition review

Reviewer `/root/transport_review`, read-only source review. Final result: PASS for the protected main-process composition and its synthetic integration evidence, after the bounded preapproval input correction below. This is not a live Qwen execution or new native-boundary qualification.

Integration follow-up resolved: the newly tightened app-core factory unavailable contract accepts only bounded reason codes. The maker changed the shared unavailable helper to preserve only `[a-zA-Z0-9._:-]{1,128}` strings and otherwise return `generated-host-invalid`. This closes the previously reported arbitrary error-message shape mismatch without fallback execution. Independent targeted regression passed for an exception containing a private path and for preservation of the normal unqualified code. Final reviewed hashes below include this small correction.

## Corrected finding

The initial host formatted `JSON.parse(inputText)` before invoking the strict checker. The input's 1 MiB cap alone did not cap expanded indentation/depth allocation. It also did not reject an exact expected output already known to exceed configured `maxOutputBytes` before approval.

The maker's current lines 100–107 first call the fixed checker with an empty candidate output. Unsupported/canonical/depth/expected-size input is rejected before the app formatter runs. Only a supported bounded input is formatted, and output larger than the approved byte cap rejects before persistence/launch. The new depth-65 test observes zero pretty-format calls; the small output-cap test observes no generated target, approval event or executor launch. No unbounded stress/OOM experiment was needed.

## Composition checks

- Producer capture, checker observation/acceptance, runtime cleanup persistence and driver orchestration use the supplied same Ledger. Defaults construct the existing pinned native model/checker executors; optional executor factories are explicitly trusted test/main-process seams, not renderer/plugin configuration.
- All four configured persisted modes must exist and match their policy digests, currency and candidate allowlists. The host requires qualified catalog/admission evidence and supported estimates rather than fabricating missing capability/quality/cost observations or choosing a fallback. Evidence is rechecked during candidate observation and runtime authorization.
- The generated plan has a model-producer stage with only fixed localhost egress and an independent verifier stage without egress. Child stages have no allowed actions. Parent template/envelope and plan hashes are checked; stage envelopes are still validated through the existing driver/binder/executors.
- Reservation amounts are bounded integer units and checked against conservative estimates. Policy/budget currency, denomination and maximum allocation are reconciled. Billing receipts remain null and final billing authorization is false, so unsettled reservations remain committed rather than being inferred settled from client exit.
- Runtime execution objects are owned in a WeakMap and cleanup requires the same context identity. Results and issued receipts are keyed by the attempt; receipt verification compares exactly the host-issued object value. The shared cleanup store must contain the cleanup evidence before a receipt can be returned.
- A successful process exit is only an execution outcome. The reused generated collector binds stored input/output bytes, producer/checker stages and sessions, parameter/control digests and principals. It rejects missing owned executions, forged pass values, wrong output, cancellation and changed lineage. Current output/session/manifest checks and signal/expiry checks remain in the underlying collector, runtime and acceptance layers.
- No renderer/model supplied self-pass, output frame or cleanup claim becomes acceptance merely by appearing in this app-host assembly. Supplying actual trusted subject/evidence/estimates remains a host bootstrap responsibility; the factory does not manufacture live observations.

## Independent checks

Daemon working directory, 2026-09-11 20:13:58 local:

```text
npm run build
npx vitest run test/integration-generated-json-host.test.ts test/integration-generated-acceptance-host.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
```

Build exit 0; 16 tests PASS across the two files, duration 2.36 seconds (tool chunk 6d6e43). The host tests use explicitly synthetic admission/executor/native observation frames while exercising real SQLite policy, capture, cleanup, budget and acceptance composition. They demonstrate the four modes, unavailable authority/estimates/pins, qualification drift before launch, wrong generated values and the new bounded preapproval rejection. Collector regressions cover independent principals, owned evidence, cancellation, late outcomes and session/output drift. No new native subprocess or provider/model invocation was performed by these tests.

The separately reviewed app-core seam was not redundantly rerun here. Real native qualification, a live provider canary, deployed bootstrap wiring and UI behavior must retain their own source-bound evidence. Factory test substitution is not a live qualification claim.

Reason-code correction verification: `npx vitest run test/integration-generated-json-host.test.ts -t 'core-compatible reason codes' --reporter=verbose --fileParallelism=false --maxWorkers=1`, exit 0, 1 PASS / 9 intentionally unselected, 20:17:45 local, 394 ms (chunk 58de79). The preceding full 16-test gate remains the pre-reason-correction record, not a claim it was rerun. The independent typecheck at 20:17 also exited 0 during the concurrent delivery review; the correction touches runtime JavaScript reason normalization and its focused test only.

## Reviewed SHA-256

| Artifact | SHA-256 |
|---|---|
| app/generated-json-host.mjs | 653CAF20B359D57D4E757BBF73F9DB4D6A7FB6A9E1C8067C4E29D5B26E54D366 |
| app/generated-json-host.d.mts | 0C55C4D195ADF55F2078624F1025FD7619A492E352730F32029C976D044FB303 |
| daemon/test/integration-generated-json-host.test.ts | 1C3BFFA755585E3A05083C6D30CF45520B8C4EF6135851F94510029D70171FC3 |
