# Final independent late regression

**PASS: build exit 0; 131 test files passed; 931 tests passed, 5 conditional skips, 0 failed (936 reported tests).** One final full serial Vitest run, duration 763.03 seconds. The only explicit file exclusion was the user's `**/p10c-manifest.test.ts`. This is a source-bound regression result, not completion of live model qualification or final user-goal acceptance.

## Exact execution and preservation

- Build: `npm --prefix daemon run build`, UTC 2026-09-11 13:55:34.855 to 13:55:35.932, exit 0. Log/result: build.log, build-result.json.
- Test cwd: C:/Users/User/cue/daemon.
- `npx --no-install vitest run --exclude **/p10c-manifest.test.ts --reporter=verbose --reporter=json --outputFile.json=../evidence/integrations/20260911-late-regression/vitest-results.json --fileParallelism=false --maxWorkers=1`
- Wrapper UTC start 13:55:59.402, finish 14:08:43.654, exit 0. Vitest start 22:56:00 KST, duration 763.03 seconds. Terminal tool 682274. Complete logs/structured results: vitest-full.log, vitest-results.json, run-result.json, test-summary.json.
- No second full run, no focused corrective rerun, no product/test edit during execution. The 30-minute observation limit was not reached.
- Parent paused the earlier build-only preparation for an actual runtime metadata/source/test change before any full test started. Those artifacts are preserved as pre-hold-*; the final authorized source state was then rebuilt once. The older 20260911-current-regression 746-pass/2-fail/5-skip evidence was not overwritten or relabelled.

## Source identity

source-hashes-before.json / source-hashes-after.json contain 356 sorted path/SHA256 entries: app, daemon/src, migrations, tests, root and daemon scripts, package manifests and TS config. build-hashes-before.json / build-hashes-after.json contain 257 compiled output entries. Both inventories match exactly: added 0, changed 0, removed 0 (manifest-drift.json). Compiled files were enumerated/hashed only, not read for source review. These inventories are not an independently issued model qualification or a complete native/runtime dependency manifest.

## Skips and model-call boundary

Exactly five expected conditional skips, with full assertion names in test-summary.json:
1. Installed Orca readonly probe: opt-in environment unset.
2. Real vendor Codex probe: opt-in environment unset.
3. Windows OS cwd query: Win32_Process lacks cwd.
4. External Buzz delivery/registration: would mutate an external system.
5. External artifacts share/Orca capture: requires an external system.

No unexpected skip or failed assertion was reported. Relevant live environment flag names were absent at start (environment-flag-names.json). Model/qualification/startup tests use injected fixture transport, synthetic executors or mocked discovery. No Qwen/model canary/live runner was invoked. Actual native process lifecycle, controlled network denial and fixture Electron checks did execute; log labels such as LIVE/RED inside those fixtures do not mean paid model inference or a failed test when the assertion correctly detects deliberate faults.

## Teardown observations

Before/after registry inventories contain the same six preexisting cue.worker profiles; added 0, removed 0. No matching native/proof worker processes remained in the scoped post-run query. Cue.Model Temp directories 0, Packages directories 0, model profiles 0. See teardown-baseline.json and teardown-after.json. No global kill, profile deletion or ACL/network mutation was performed by the reviewer. The six old worker mappings are preserved and not claimed cleaned or attributable to this run. Scoped process-name/command evidence does not prove absence of every unrelated process.

## Remaining scope

No regression failure requires correction in this run. The explicit pinned Codex manifest exclusion and normal external-system skips remain outside this PASS. Actual latest-source qualification and a complete real model workflow/checker acceptance remain separate gates. Default startup/visual proof and model-provider behavior must be assessed from their own receipts, not inferred from the aggregate test count.
