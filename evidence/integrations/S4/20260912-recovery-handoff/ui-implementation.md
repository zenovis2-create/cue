# Recovery handoff reason UI implementation

The existing observation-only native recovery projection now permits an optional `journal.reasonCode` only for `held` and `unavailable`. It recognizes exactly `handoff-unavailable`, `handoff-integrity-unavailable`, `external-effect-authority-unavailable`, `cleanup-or-death-unverified`, and `native-journal-observation-unavailable`. Raw durable `reason`, paths, case IDs, unknown strings, accessors, and proxy journal objects are not projected. Terminal journal states never carry a reason code.

The renderer maps those codes to concise Korean status text only for held/unavailable states and writes through `textContent`. Unknown or accessor-backed reason values are ignored without evaluation. Existing state/revision labels, observation-only wording, run-change clearing, stale-response fencing, Stop availability, and absence of recovery actions are unchanged.

Wording correction: `external-effect-authority-unavailable` renders as `외부 작업 결과 확인 필요`, describing missing evidence without implying that user permission is required. The same 19-test focused gate and syntax checks passed after this correction.

Maker gate: 3 files, 19 tests passed (`integration-native-recovery-ui`, recovery run-picker IPC, recovery run-picker UI); `node --check` passed for IPC and renderer; scoped `git diff --check` passed. Correction hypotheses used: 0/2. No build, backend, Electron, native helper, model, or network action was performed.

Hashes:

- `app/ipc.mjs` `8791BEE2F7692D00B515F79A388753822D8BBDC134B4627E43EDB7FEA4DFE6C2`
- `app/renderer/renderer.js` `91513E3680C22E88948FDA2766F592CA4CC4DE476A0AB6F3974683B51EE0B412`
- `daemon/test/integration-native-recovery-ui.test.ts` `A943C27F43025AD8D53A6EA73A7DABFA74D87D1989BFD7F27C2C4518A47FE837`
