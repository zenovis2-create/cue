# Independent selection preference integration review

2026-09-11 · `/root/contracts_review` · **PASS for the bounded S2 preference/mode integration**. Parent made store/migration/driver changes; `admission_impl` made core/IPC/preload/UI changes. Reviewer edited only this evidence artifact.

Completion gate: source-bound connected tests, daemon build, preference/approval/IPC/legacy review and hashes. Correction cap: two diagnosed findings allowed; no reviewer-requested source correction was needed. No native probes, live model calls, or broad baseline were run.

## Independent checks

From `daemon`: `npx --no-install vitest run test/integration-selection-preference.test.ts test/integration-selection-preference-core.test.ts test/integration-selection-preference-ui.test.ts test/integration-driver.test.ts test/integration-approval-plan.test.ts test/integration-observation.test.ts test/p11-electron-surface.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`.

Exit 0 at 17:09:33: **40 tests passed across 7 files** (store 4, core/IPC 4, UI 3, driver 15, approval 5, observation 7, explicit renderer surface 2). Final `npm run build` exit 0. An unrelated concurrent retry migration compile issue was fixed by its owner before the reviewer ran the build; no passing build was inferred from the earlier failing maker run.

## Findings and verified scope

- Reading an absent preference returns immutable efficiency/revision-0 intent without a write. All four modes persist across close/reopen and idempotent migration replay. BEGIN IMMEDIATE plus expected revision rejects stale saves from another connection; invalid modes/revisions do not write. Saving preferences creates neither policy snapshots nor runs.
- Core reads the default within preparation's transaction or validates an explicit per-run choice. The chosen mode is captured in the prepared run. Changing the default later does not change an existing pending approval, and an explicit per-run choice does not overwrite the saved default.
- Driver compares the captured requested mode with the actual immutable policy snapshot before binding approval. A mismatch fails and rolls back run creation. No candidate eligibility, model access, budget, or capability is inferred from the requested mode.
- Preference IPC permits only exact read/write operation schemas, enumerable own data properties, valid modes and revisions; proxies/accessors/unknown fields and channels are rejected. The preload exposes two narrow preference operations alongside existing execution APIs, with no generic settings or unrestricted invoke method.
- Without an orchestration host, preferences report unavailable, mutation and explicit mode preparation refuse, controls are hidden/disabled, and legacy preparation omits the mode. Existing approval/stop/observation behavior remains covered.
- Renderer distinguishes the current form choice from saving the next default. A CAS conflict refreshes the revision while retaining the current choice and reporting failure. Pending-approval copy explicitly states that later mode changes affect the next preparation. Text rendering and frozen approval details remain covered by connected regressions.
- Migration 015 is included in ledger initialization and copied build assets. Review of these shared files is limited to this wiring, not acceptance of unrelated concurrent migration work.

## Source snapshot

| Path | SHA-256 |
| --- | --- |
| daemon/src/selection/preferences.ts | 57F9C56E5189845C969460C0296FD4FE00919468253ED76DACDAFE198E13B71B |
| daemon/migrations/015_selection_preference.sql | 4380FE66AFE4D48C73556971A8A3AB260E29CBF53EDDD9916B2B3E4720C374A7 |
| daemon/src/ledger.ts | AF59264BA01B59D91A1DB15EB7EAC9FB9E7CC2DBBBD7EEB1A62C8FBD28786F2B |
| daemon/scripts/copy-assets.mjs | 0ECBF41BF27DE8E595707F155D3CF33382A26429E1A322AFD5F07A4683D859F6 |
| app/orchestration-driver.mjs | F6B54F47FB3CC710BA3BF2C5A0875B6E6A636396A07016443FFB36E0AFCF0BCC |
| app/orchestration-driver.d.mts | C71DD98E77F150778306B4868DC6589578BA63F5B799A7EC16CCE99F23AD11B3 |
| app/core.mjs | 418B5086879485A97877ED0B66E286B449F07C21486D8FDB1DA0921A74763CAA |
| app/core.d.mts | 9B4D5D555A9410926E1DCCC53B6F8B6D93371E9417A7F140ABB74678B7E6C229 |
| app/ipc.mjs | 3BA1E66DBA781A5464334E7C9F9730CD2759BD1CD43771378791612D66F9ADD1 |
| app/preload.cjs | 4E7763E75939FBACA0DE07B8ED8DA04C9E25D2AC4F7578967A02F3FC6B488A20 |
| app/renderer/index.html | 38B0C16D2C3852E75476EA14AC27E52851F0C32DDA1216265D1F42885D7BA2AC |
| app/renderer/renderer.js | 02B5B4794CCC531BD951407FDC4798F3BF1814C0DAF7DD430D8186DC73A4A3F5 |
| daemon/test/integration-selection-preference.test.ts | C6C63481E8090AE8A0B65ADE093E03B1DAB40DC313CA9A4C4D186E238E21E33A |
| daemon/test/integration-selection-preference-core.test.ts | B2874647D6FB937EB20895453932487E690050FA30E5282B1C4E0D4959FEB3FE |
| daemon/test/integration-selection-preference-ui.test.ts | E84D1C2814E657FFED961A10718342868CAB44EDFE97709AEA6FFCBF99E4DD65 |
| daemon/test/integration-driver.test.ts | 01788E4F122425C8EB85D3BB8992471E447B135C1716052FD6D6D35EFEEDC9F1 |

## Limits

Real SQLite persistence/core wiring and jsdom renderer behavior were tested with synthetic host policies. This does not demonstrate optimal real-world model selection, qualified default execution, live tool/model access, or mode performance/cost benchmarks. The default desktop without an orchestration host correctly remains unavailable. No independent native Electron visual session was performed for this review. This PASS covers preference selection and approval consistency only, not the whole S2 checklist or S0–S7 completion.
