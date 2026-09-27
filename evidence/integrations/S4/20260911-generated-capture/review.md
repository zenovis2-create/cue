# Generated model capture bridge — independent review

2026-09-11. Reviewer contracts_review; maker reuse_pure. PASS for the fixture-backed capture bridge, no blocking finding or requested correction. Product source read-only.

Done: inspect private execution/session/stage authority, delayed response drift, result/completion consistency and outer cleanup composition; build and focused tests exit0; record current hashes. Correction cap2, used0. Evidence written once then read/hash checked.

Independent commands (cwd daemon):

- npm run build — exit0, chunk29b690.
- npx --no-install vitest run test/integration-generated-capture.test.ts test/integration-generated-output.test.ts test/integration-isolated-model-cleanup.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
- Exit0, 3files/17tests PASS; start18:46:26, duration9.18s, session21078 finalchunk c34c28.

Launch requires model context, matching currently running/latest attempt, unexpired stored stage and exactly one approved target for its producer. Approved UTF8 input comes from the immutable store. Duplicate attempt launches and reused returned execution objects are blocked. The actual launch function remains a trusted host seam; the bridge cannot prove that an arbitrary injected launch function actually spawned a process.

Capture owns the returned executor promises privately. It snapshots the session identity and rechecks exact ledger session fields, context identity, candidate, stage hash and target digest after asynchronous completion. Its internal store authorizer binds exact response bytes, target, observation ID and stage to that owned session. Returned answer text is UTF8 encoded; it is explicitly not preservation of provider wire bytes. Invalid encoding/size/response identity or failed storage prevents successful completion. Disagreeing result and completion outcomes become unknown.

Late failed/cancelled responses may remain historical under the original immutable lineage. Recording does not change attempt/root state, cleanup, billing or acceptance. Current successful-attempt selection remains acceptance's responsibility. Rejected promises are observed, and cancellation control remains exposed.

Cleanup must compose outside capture so its weak registry owns the final returned execution object. The focused composition regression confirms fixture cleanup claims cannot become verified-clean. Existing cleanup observer regressions passed; no model request or native model-boundary qualification was run.

Tests use synthetic owned executor/session data and real SQLite. This is not live Qwen capture, genuine default host configuration, semantic checker execution, or final goal acceptance. Native checker edits occurring elsewhere only shared the successful compile gate and are not reviewed here.

Current SHA256:
- daemon/src/adapters/generated-model-output.ts : 59310B497E7F4057235A77610487CF436485FA4C06F8389DB9B5EA2B81FEBDCD
- daemon/test/integration-generated-capture.test.ts : 8153D3598B706AA7FF3AC11543B9C8473B5324A67F1A5EBFAAF23FB68EE6027E
- daemon/src/verification/generated-output.ts : 18A7662563CCA92FE8FBF50E5C1A7FB103F47EDEE657771270FD9DFF0DC49182
- daemon/src/adapters/isolated-model-cleanup.ts : 831767EF3E5779DE4AC637BC9526C443B7F495B5EC667366B2C41388E3417DD9
- daemon/test/integration-generated-output.test.ts : 41CD1A275221522A5F7BD3399BCF5A6DED7E781905C6D8A619672E0AAA171FB7
- daemon/test/integration-isolated-model-cleanup.test.ts : CBBDD96874685BDC36F4163015A4B70A4440FF7F8893635B30A3CE478C032F81
