# Independent root review — bounded composition accepted
Reviewed app/native-implementation-host.mjs and declaration plus the two new integration tests. Root found and required two corrections: producer principal must not include the run-dependent account row digest, and the workflow expectedArtifacts getter must not execute before safe cloning. Both are corrected; the getter test proves zero reads.

Actual scope: explicit expectedArtifacts selects the fixed native checker/acceptance host. Exact checker revision, parameters digest, target ID/path/byte cap must match. Caller acceptance/checker overrides are refused. Producer principal uses persisted validated account identity and exact migration050 runtime/session/stage lineage. This does not freshly authenticate a service account.

Independent root run: four host/acceptance files passed,19 tests passed,1 existing Windows snapshot skip. The fifth real-Node compiled-import test failed because a worker standalone tsc had overwritten the build's import relocation. No source relaxation: root reran the complete npm run build (exit0, root-build.log), then the failed compiled-import test separately passed1/1 (root-compiled-import-recheck.log). Failed raw output is preserved in root-review-tests.log.

The positive test uses actual Core prepare/approve, SQLite account/plan/stage/receipt stores, native file snapshots and createAcceptanceVerifier.collect. Runtime receipt issuance is mocked, attempts are manually finished, and replacement bytes are manually written. It demonstrates unknown without verifier receipt, pass with matching bytes and receipt, fail after bytes change, provider launches0. It does NOT prove automatic driver execution, staged publication, protected startup authority composition, current provider qualification or end-to-end release acceptance. These remain open. No extra provider/model/service calls; Qwen remains off.

Verdict: PASS for this narrow offline connection after corrections. No upper checklist item closed. Existing skip is not new evidence.

## Reviewed SHA-256
- app/native-implementation-host.mjs: B42F5D4024C23DF8EB37583485EABF2515FFA2709DABC285B03B772C441B8F1B
- app/native-implementation-host.d.mts: 1DDC1652A044CA8C3261861DC6A48C3A80369704EA97DDF2ADE6F6A4B9AFCB70
- daemon/test/integration-native-host-acceptance-wiring.test.ts: 4A285844C81FE6A2260CD096FD2C6C8502FCED8BC24C0580837633AF55C51841
- daemon/test/integration-native-host-core-positive.test.ts: 85B4A940F983C8CA2C3443F9F967F450EE1DE4C59732154AEE26BCAE7EA48139
