# Independent JSON template IPC/UI code review

Verdict: PASS for the explicit JSON renderer/IPC integration. No blocking defect found. Actual Electron visual QA is assigned separately; this review does not claim that proof script was executed or that default host qualification/main activation is complete.

Done gate: bounded source review, focused UI/preload/core/resource/approval tests, typecheck and current hashes. Review cap 1; no product source edited. Only this review evidence is authored by the reviewer.

Independent checks (2026-09-11):
- cwd daemon: `npx --no-install vitest run test/integration-json-template-ui.test.ts test/p11-electron-surface.test.ts test/integration-json-template-core.test.ts test/integration-resource-ui.test.ts test/integration-approval-plan.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`: exit 0, 23 passed in 5 files, started 21:51:20, duration 5.47 s.
- cwd daemon: `npx --no-install tsc -p tsconfig.json --noEmit`: exit 0.

Confirmed:
- Dedicated cue:prepare-json accepts exactly one plain-data DTO with templateId/inputText/autonomy/selectionMode. Unknown fields, malformed kinds/choices, oversized UTF-8 input, accessors and proxies reject without executing getters. IPC checks the protected sender predicate before handlers; tests cover wrong sender and wrong frame. Actual JSON parsing/UTF-8 roundtrip validation remains in core.
- Preload exposes one named prepareJson function and the exact explicit channel/surface allowlists were updated in both P11 unit expectations and the existing Electron proof script. There is no arbitrary invoke/eval/path/permission API added.
- The form defaults to general preparation. JSON is an explicit selector and dedicated textarea, sent only through prepareJson with current selected mode/autonomy. No unavailable-JSON fallback calls general prepare. The general path preserves its previous optional-mode behavior.
- Switching templates and beginning a new preparation invalidate the previous preparation generation, disable approval, clear metadata and reset resource pins. A late result from the previous generation cannot restore approval or request its resource pin. Failure leaves no active approval.
- Raw JSON goes only to the explicit preparation call; approval rendering consumes the core's metadata/fixed description using textContent. Hostile textarea/image-looking text remains literal and creates no DOM image. Switching back clears old envelope/resource metadata.
- Existing resource, approval and core tests passed in the same focused run. No execution/model/network request was performed by these fixtures.

Limits: DOM tests use jsdom and a mocked renderer API. Core tests use real storage/driver composition with synthetic qualification and no-launch seams. These layers establish data flow and rejection behavior, not operating-system isolation, real model success, actual visual layout or current default host readiness. The separately assigned Electron QA must retain its own source hashes and screenshots. Existing active-run cancellation semantics were not redesigned by the template selector.

Current SHA256:
- app/ipc.mjs: DBF958369A04C374BB528A4481CAC5635DA58A772AC98936C841F177A19C1A82
- app/ipc.d.mts: 7CA380DF8EB04F8855B4D9C944A74286A271CB74E0CD5C47C25FF676776B361F
- app/preload.cjs: CD7E7C1FEA8F8E6E90D5682A507667E78FEE059B3674CDC9899B9A3A8CBFEBEA
- app/renderer/index.html: F2D9181BBB1D9EB0EEE4461835F8F2E1E6A5B2801F775BBBE307236EAE1F85C6
- app/renderer/renderer.js: 92B19BF380441D1A42E554B3F17639A3EB55A72E47BB1A41C98833D5023A50C8
- daemon/test/integration-json-template-ui.test.ts: 38B68BCEBC338F761304E0DBECA0D7D4B000B963BBBE1CD352EDE38005998AD9
- daemon/test/p11-electron-surface.test.ts: F2778F8B5D49FF71FD98DF120D126C6163A256632A102C13FD90505E6E3A1383
- scripts/p11-electron-proof.mjs: CBC3625A5E98F07B23D807CFB1DE0317F9F516ED77A6CBCE45825CAADC8E6387

