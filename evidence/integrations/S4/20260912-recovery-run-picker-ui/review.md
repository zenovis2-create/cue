# Historical run picker UI — independent review

Reviewer `/root/broker_review`, 2026-09-12 KST. PASS for the three-file renderer delta. No source edits, build, Electron/helper/native/model execution.

Independent command in `daemon`:

```text
npx vitest run test/integration-recovery-run-picker-ui.test.ts test/integration-native-recovery-ui.test.ts test/integration-selection-explanation-ui.test.ts test/integration-execution-ownership-core.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
npx tsc --noEmit
```

Exit 0, 4 suites / 16 PASS, start 01:26:16 KST, duration 4.61 seconds. Typecheck exit 0. All three entries in `hashes.json` independently match.

No unresolved blocker found. Explicit listing sends only `operation:runs`; choosing a historical record changes only the recovery target. Current run tracking continues separately through later preparation/polling updates; returning to current selects the latest current run. Selection does not dispatch execution, Stop or observation automatically.

Target and run-list generations invalidate old runs/list/observe replies and stale record buttons. Old failures/finally blocks cannot overwrite output or unlock a newer request. Run-list and identity-query busy states remain separate from execution state and Stop ownership. Existing recovery stale-response/Stop and execution ownership tests pass; selection explanation regression tests also pass.

Metadata uses inert text; missing identities/links and both output/scan truncation remain explicit. A scan-limited empty result is not labelled as proof that no older runs exist. UI relies on the previously reviewed strict IPC DTO and does not add backend authority. No cleanup receipt, ownership release, acceptance or restart action is added.

This is JSDOM and source evidence, not actual Electron historical-picker or real OS observation proof. The prior Electron recovery UI proof covered its earlier prepared-run UI snapshot; it is not relabelled as this new picker proof.

| File | SHA-256 |
| --- | --- |
| app/renderer/renderer.js | 558D116AD6BC8EC37F7F9E8DE63529313037423E278F0542A1F93D07AEF17CF9 |
| app/renderer/index.html | 8E3F25ECC626CDC4ADA561E4AF6A2632AE8105A7275846A69EDA74B3B0B6BD50 |
| daemon/test/integration-recovery-run-picker-ui.test.ts | D4B9A7E699F05223447154CCE9CB86D09EC6420258B3E0E00E80A561087931A7 |
