# Generated output approval preparation/UI — independent review

2026-09-11. Reviewer contracts_review; makers reuse_pure (driver), admission_impl (UI). PASS for preparation/UI only. No source corrections requested and no reviewer product edits.

Done: inspect exact preparation/transaction/replay/privacy/UI contracts, run focused tests and build, record current hashes. Correction cap 2 (used 0). Evidence write once then read/hash verification.

## Independently executed

Cwd daemon. All commands exit 0:

1. npx --no-install vitest run test/integration-driver.test.ts test/integration-driver-core.test.ts test/integration-approval-plan.test.ts test/integration-observation.test.ts test/integration-selection-mode-ui.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
   4 files / 49 tests passed, 18:30:01, 5.05 s. The nonexistent selection-mode-ui filename contributed zero tests; it is not counted as checked.
2. npx --no-install vitest run test/integration-selection-preference-ui.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
   Correct mode UI path, 1 file / 3 tests passed, 18:30:16, 1.32 s.
3. npm run build — exit 0 (tool chunk 3ba9bd), after native maker reuse_cli confirmed running the build was acceptable. This is compile compatibility, not review or qualification of that maker's unfinished native checker.

## Inspection conclusions

- Optional trusted host configuration accepts named plaintext target fields; unknown enumerable fields, duplicate targets, empty/malformed Unicode input and invalid store contracts reject. Host configuration is not an untrusted plugin execution boundary.
- Actual UTF-8 bytes bind the approved input/checker/target contract through the existing store, before approval inside the same policy/budget/plan/requirements transaction. A malformed second target rolls all persisted preparation back; the failed cache entry is removed.
- The frozen public summary is an explicit metadata allowlist. It contains hashes, lengths, IDs and limits, never inputText or raw bytes. Mutation of later host configuration does not rewrite the already-frozen approval.
- Replay and activation check the exact persisted target set and each target digest. readTarget recomputes input-byte and contract integrity, so missing targets or changed storage reject. Absent legacy configuration does not introduce an empty generatedOutputs field.
- Retry summary uses the existing summary spread and preserves generated target metadata. No permission, retry or acceptance expansion is introduced.
- UI labels only metadata using textContent, bounds target display at 128, and clears/hides the panel before new render and on missing or failed preparation. Literal hostile text does not become markup; supplied rawinput fields are ignored.

No response capture, actual deterministic verifier execution, output semantic validation, default host activation, live model qualification or full goal completion is claimed.

## Current hashes
- app/orchestration-driver.mjs : 4FCD10BD5243CDAD0A1D61272E3B8F3A7C7BDAC826966B1FAD9933E64E17B25D
- app/orchestration-driver.d.mts : 07A1DF86F5F14C707708B217596466DBD6D9EE6846C61648412578DAF522F856
- app/renderer/renderer.js : 66041CB0C8BCD3D87A70943B51F78B952CB27EE9842E4F19B2EA2C071D5D96F0
- app/renderer/index.html : A7F5946B0E1C0D6D4BA8EE84EA77037C029E197F7CC48AC6C49F14E549C109F4
- daemon/test/integration-driver.test.ts : E1B5B7223C47F33ACD1C2C240ADA67D7D43170431B7B7D69B85B45920F58709C
- daemon/test/integration-driver-core.test.ts : 88AF7BCA6DD48BECC7564038C7945226E6BF9955B2DB1517AA3A6154CA3DD5BB
- daemon/test/integration-approval-plan.test.ts : E27D153467C279BF350BA0C1ACFEC53CC986ED580FD1D6C9DB547475A3EE24BB
- daemon/test/integration-observation.test.ts : BE33ACF9E77642CA4DC6109B1F60A74760FBD206C41DA4CACCD0814E2906F20C
- daemon/test/integration-selection-preference-ui.test.ts : E84D1C2814E657FFED961A10718342868CAB44EDFE97709AEA6FFCBF99E4DD65
