# Independent recovery reason UI review

## Review contract

Done means the observation-only IPC projection accepts only the agreed finite reason codes, never exposes raw reason/case/path/private data or evaluates hostile reason accessors, and the renderer shows inert Korean status text only for held/unavailable states, clears it on target changes, and adds no action. Correction cap: 2. Every pass checks the frozen hashes, focused native-recovery UI/run-picker tests, JavaScript syntax, and scoped diff. A failed pass requires a new evidence-backed hypothesis or handoff. This reviewer owns this evidence file only and made no product or test edits.

## Verdict: PASS — DOM/IPC reason projection only

The IPC projection recognizes exactly five backend reason codes: `handoff-unavailable`, `handoff-integrity-unavailable`, `external-effect-authority-unavailable`, `cleanup-or-death-unverified`, and `native-journal-observation-unavailable`. It reads journal fields through property descriptors, rejects proxies, does not invoke accessors, and returns only state/revision plus an allowed reason code. Raw `reason`, `caseId`, private paths, and unknown strings remain absent. Finalized journal states do not receive a reason code.

The renderer maps the finite values through `textContent`. The corrected external-effect wording, `외부 작업 결과 확인 필요`, requests confirmation of the recorded result and does not imply missing user permission or claim that an external operation occurred. Unknown data falls back safely. Journal status remains observation-only, includes no resume/restore action, and is cleared when the selected run changes or a stale response arrives.

## Independent evidence

- Frozen maker gate: 3 files, 19/19 passed; IPC and renderer syntax checks passed; scoped diff-check passed.
- Independent full focused gate: `npx vitest run test/integration-native-recovery-ui.test.ts test/integration-recovery-run-picker-ipc.test.ts test/integration-recovery-run-picker-ui.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` — 3 files, 19/19 passed.
- After the wording correction: `npx vitest run test/integration-native-recovery-ui.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` — 1 file, 13/13 passed.
- `node --check app/ipc.mjs` and `node --check app/renderer/renderer.js` — PASS.
- `git diff --check -- app/ipc.mjs app/renderer/renderer.js daemon/test/integration-native-recovery-ui.test.ts` — PASS; only Git's existing LF-to-CRLF notices were printed.

## Frozen hashes

- `app/ipc.mjs`: `8791BEE2F7692D00B515F79A388753822D8BBDC134B4627E43EDB7FEA4DFE6C2`
- `app/renderer/renderer.js`: `91513E3680C22E88948FDA2766F592CA4CC4DE476A0AB6F3974683B51EE0B412`
- `daemon/test/integration-native-recovery-ui.test.ts`: `A943C27F43025AD8D53A6EA73A7DABFA74D87D1989BFD7F27C2C4518A47FE837`

This PASS does not qualify actual Electron rendering, native execution, provider state, cleanup, resume, restoration, handoff completeness, external-effect occurrence, or disposition authority.
