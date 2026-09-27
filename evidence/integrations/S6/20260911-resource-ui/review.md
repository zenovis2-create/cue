# Independent resource UI review

Product code review: no blocking defect found in the assigned scope. Focused regression initially 20 passed / 1 failed, awaiting the exact P11 surface-list correction below. No implementation edits or model calls by this reviewer.

Command: `npx --no-install vitest run test/integration-resource-ui.test.ts test/integration-approval-plan.test.ts test/integration-report-app.test.ts test/p11-electron-surface.test.ts test/p12-electron-proof-result.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`. At 2026-09-11 21:26:13 KST, duration 17.78 seconds, exit 1 (tools b4476d / f16990).

Failure: p11-electron-surface.test.ts:12 exact preload keys omitted `resources`; its IPC_CHANNELS assertion at line15 likewise omitted `cue:resources` (not reached in the first failed assertion). Maker notified to update these two exact lists while preserving the closed whitelist. All 4 resource UI, 9 approval, 5 report and the actual P12 Electron cleanup-failure proof passed, as did the other P11 status isolation test. The P12 proof exact API list already includes resources.

Resource IPC requires the actual main window and main frame before dispatch. Discriminated commands have exact own-data fields, reject proxies/accessors, reject extra arguments, bound IDs/query/limit and provide no renderer-supplied filesystem path or command. Native chooser returns a host-selected directory and SHA256 of a bounded 32768-byte manifest; it checks file/root identity around the bounded read and closes the file in finally. Core import then independently uses the approved loader with that same manifest hash. This review does not claim protection against arbitrary privileged host filesystem mutation or add directory permissions.

The real-core IPC tests demonstrate cancellation without import, immutable prepared-run pins across package updates/removal and no search fallback for unknown runs. Renderer uses textContent for provenance, filenames and excerpts, creates no source link or injected markup, labels reference-only/unverified authority and does not insert retrieved text into the goal. Run-generation fencing discards late pin/search results after preparation changes; failed/unpinned preparations clear and disable search. Existing pins remain displayed after removing an active package. Package list display is separate from pinned run identity; native chooser UI interaction/visual QA belongs to the separate Electron QA task, not these mocked chooser/JSDOM cases.

## Final correction gate

Maker changed only the two exact P11 expected lists and their descriptive test title. Independent `npx --no-install vitest run test/p11-electron-surface.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`: exit 0, 2 passed, 154 ms at 21:27:56 KST (tool a5136d). Final bounded verdict PASS. The prior 20-pass/1-fail run remains recorded; no redundant full or Electron rerun after this test-only correction. No new build required for the final expected-list update.

Current source hashes (main.mjs reviewed resource chooser and sender wiring region only):
- app/ipc.mjs SHA256 1027753D164E682272D89ADB212F06B3DF17963B3BC18DDB10E703EC15EB5771
- app/ipc.d.mts SHA256 AE0CD9A0D7DDCA46549BDEC23CA25EC44C6B01FF473DE565D8B83A5EB3F70A14
- app/preload.cjs SHA256 011A4890FAA320E32C99BA3887EF88F4EF49A4D84ED7072047C3793591BAB24C
- app/main.mjs SHA256 6650823397F908EA6214664EDDD7F6449184AD4C841061A82CE5282A9950C22E
- app/renderer/renderer.js SHA256 D1C03AD3EAAB73F5B999B027FC9427FB8CD6C8F314C15ED8F5508D69C3232B39
- app/renderer/index.html SHA256 B1740E59F7DD49A65AE914A2C899A86786DDA4F005F5009E1018A8C9391BA98E
- app/renderer/styles.css SHA256 750EC21721BB3475269F5E1FDE7D9764DA999AE907E61297C34DB130700B113C
- daemon/test/integration-resource-ui.test.ts SHA256 7FE074528662FCB511DA9A7460AD7AD9C062BA40179CC3A4D2AE4DACC0C4DE1E
- daemon/test/p11-electron-surface.test.ts SHA256 CF075F7169E0B0E240D3C39A29A8EAC470CD4D9910DFFB4EAF729D3A19BF08FF
- scripts/p11-electron-proof.mjs SHA256 C96DC798FF7748CE78234C68D2FAF8C24CFE0C37088F72999702DFF9362D7C9D
