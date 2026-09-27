# Independent review: isolated local model broker

Reviewer: `/root/broker_review` (read-only product review). Date: 2026-09-11.

Result: **PASS for the bounded broker implementation and offline Windows child protocol**. No blocking defect found in the reviewed scope. This is not a provider qualification, network-denial proof, live Qwen result, host admission receipt, billing settlement, or full Cue integration approval.

## Source identity

| File | SHA-256 |
| --- | --- |
| `daemon/src/model-only-launch.ps1` | `517C1974DBC1268C5886A5E4ECCBFEAC8A88AF270E3F35CECFC1F5A5C37B7B4A` |
| `daemon/src/model-only-client.cjs` | `52129525E66E891068B15A1928A170ED7B6BB4DC35E7C6BA0AFC4EDB294EB015` |
| `daemon/src/adapters/isolated-local-model.ts` | `FE3DEB8DBEF4BF4ADBDAAF55B1C727918964C07A4B6B3C700FDA5A178CD6BA09` |
| `daemon/test/integration-isolated-local-model.test.ts` | `0E4C70E7DF8887183A9F952D7A70C01AB5F3AF68C209E25A27BDD8FE30328DEE` |
| `daemon/src/model-only-profile-cleanup.ps1` | `2D2E60085FA79B98EE1D3149FBA0673EA62288A1C60DC5661E227B0545988A69` |
| `daemon/scripts/copy-assets.mjs` | `D98E43859A1FAA0F0E57E448C0DD1FBF2BC38564FAAA237D47412FAA7ABFF1D2` |

## Independent checks

- `npm run build` in `daemon`: exit 0. Compiled adapter plus all three native assets are exercised by the real child roundtrip test.
- `npx --no-install vitest run test/integration-isolated-local-model.test.ts test/integration-model-boundary-hardkill.test.ts test/integration-model-boundary-observation.test.ts test/integration-model-boundary-process-limit.test.ts test/integration-runtime.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`: exit 0, **4 files / 7 tests passed**, 21.37 s. The last filter names no existing file and contributes no coverage; runtime coverage was therefore run separately using the correct filename below.
- `npx --no-install vitest run test/integration-local-model.test.ts test/integration-executors.test.ts test/integration-runtime-contract.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`: exit 0, **3 files / 39 tests passed**, 1.02 s.
- `node evidence/integrations/S1/20260911-model-broker/reviewer-probe.mjs`: exit 0. Reviewer-owned fixture transport, actual compiled adapter / PowerShell / AppContainer child. Safely inspects the owned launcher's command line and decoded metadata in memory, emits only boolean success; neither contains the synthetic prompt. Verifies `length` remains an incomplete failed outcome with partial text. Verifies real broker timeout abort after **6028 ms**, failed outcome, null result text, unknown cleanup receipt, and subsequent physical profile/root removal by the guardian. No actual provider request.

## Authority and boundary findings

- Production API fixes endpoint to `http://127.0.0.1:8085/v1` and model to `qwen38-27b-unc`. Only a trusted host test seam can replace transport; child requests cannot choose URL, model, executable, tools, or code. Existing transport rejects redirects, wrong model, tool calls, invalid terminal order, inconsistent token usage, and response overflow.
- User prompt travels through bounded base64 stdin frames, not command arguments. Native launch command contains staged fixed Node/client paths only. Child is suspended until Job assignment, profile reseal, readback, and native token/Job observation; guardian is armed before profile creation.
- The fixed child sends `model_request`; adapter requires exact identity and payload match before invoking transport once. The adapter then sends a bounded response and requires the actual child `model_result` to match before returning text. Wrong identity/truncation and EOF or overflow fail closed.
- Native host observations use separate prefixes. Every child line is UTF-8 validated and base64 wrapped as `CUE_MODEL_FRAME`; model text containing `CUE_MODEL_CLEANUP=...` is tested as data and cannot create native observations.
- Byte, frame, event, output-token and timeout bounds exist at the adapter, PowerShell relay and fixed client. Cancel and timeout abort transport and terminate the owned launcher; existing guardian test proves actual Job drain and private profile/root cleanup after launcher hard kill.
- Successful result requires the real returned frame, completed terminal, observed native boundary, clean host exit and native path-absence observations. It still exposes `cleanup: unknown` and `providerStopped: unknown`; it creates no qualification, clean runtime receipt or billing release.

## Remaining limits

- The tests use trusted fixture transports. A real approved Qwen canary is a separate next check, not represented as completed here.
- The pre-existing network probe's `ETIMEDOUT` is not explicit network-denial evidence. No M/P/B qualification was granted by this review.
- Admission, current envelope authorization, authoritative cleanup and durable execution/result storage remain the composing host's responsibilities. This isolated executor is not yet evidence that the default application can dispatch a fully qualified local-model task.
- The reviewer made no product changes. `reviewer-probe.mjs` and this report are reviewer-owned evidence only.

## Follow-up: recorded real Qwen canary audit

After the offline review, the maker ran the separately authorized local canary. This section audits the saved execution script/result and current cleanup state; the reviewer did **not** call Qwen again. It supersedes only the pending-live-canary statement above, not the qualification and application-integration limits.

- `real-qwen-canary.mjs` SHA-256 `8788F147A9B46CBC37D2CF1E14FF09FD0873BE6022F9BEC271BBFFA349C4360A` imports the compiled adapter, sets output limit 128 and supplies **no transport override**. The reviewed production factory fixes `http://127.0.0.1:8085/v1` and `qwen38-27b-unc`; the default SSE transport performs the request. The script refuses replay when the output artifact exists.
- `real-qwen-canary-normalized-root.json` SHA-256 `F3482AA278239F55534622CE01C5858A733D5968BF491DB99ACF836D5AB2CBAF` records 2026-09-11 08:35:18.090–08:35:22.371 UTC, **4.281 s**, actual result text `OK`, completed/stop terminal, usage **22 input / 37 output / 59 total**. Its five source hashes match the current reviewed files. Local transport source SHA is `ADEC850A783E94708946E1570BC653F1992977F97EC869CBC413FECE3BEE6A8F`.
- Native observation records client PID 82396, exact Job membership, AppContainer token with zero capabilities, Job flags 8200 and active-process limit 1, and no loopback exemption. Client and launcher exited cleanly. There was no attempted subprocess during this canary; the process-limit observation therefore correctly remains `unknown`, event count 0.
- The maker's `independentCleanup` fields mean checks performed outside the launcher. In addition, this reviewer independently checked the saved client/guardian PIDs (82396 / 30384) and the exact saved task-root/profile paths after the run: all four are currently absent. This confirms current cleanup state, not a second live execution or a provider-stop guarantee.
- Failed `real-qwen-canary.json` is preserved: `broker_binding_mismatch` after 67 ms and no native observations. The script correction normalizes the owner root to match the normalized envelope. Source control flow rejects that mismatch before `spawn` or transport invocation. Its `calls: 1` field was a planned cap, not an observed provider-call count; the successful record explicitly corrects that wording.
- Compiled artifacts currently hash to `A65246EA6192FF271577026AB39AFF68F6FCFBC8703464A680FCEB615FD0D3A2` (isolated adapter) and `5179556CCE68B38828C8B96EF7A7E465D3AB0924B2AE179C0559BBA4D33DB6CE` (local SSE transport); copied native assets exactly match the source hashes above. These are post-run hashes, not a claim that the initial artifact recorded compiled-file identity.

Outcome: the saved evidence supports **one recorded production-transport local Qwen broker roundtrip**, with an independently audited script/source/result and current cleanup observation. `cleanup`, `providerStopped`, and `qualification` remain `unknown` in the result. This does not qualify M/P/B admission, prove every network probe, settle billing, or complete the default Cue host integration.
