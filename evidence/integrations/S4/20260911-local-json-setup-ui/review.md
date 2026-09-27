# Independent setup UI/IPC review — correction pending

Verdict: BLOCKED for the current renderer lifecycle. This is a bounded review finding, not a claim that the whole project goal is blocked. Maker and parent have the diagnosis; no reviewer product edits were made.

Completion gate: review corrected source, focused setup/core/JSON/P11/resource tests, typecheck and current hashes. Maker correction cap 2; one ownership-race hypothesis requested. Final tests are deferred until corrected source is stable; no new passing test claim is made here.

Blocker: while the approve handler awaits approve/execute IPC, setup save checks only lastLedgerCard.state === running. Before the first running card arrives, a setup submission can call clearPreparation(), setting pending=null. If the backend has started and the execute response arrives later, pollStatus(pending.taskId) throws and the Stop handler returns early because pending is null. The existing run loses its renderer control identity even though setup itself does not stop it.

Relevant current source: app/renderer/renderer.js approve handler around line 449; setup submit around line 501; clearPreparation and Stop both use mutable pending. The running-card guard is insufficient during dispatch or uncertain IPC completion.

Required bounded correction: retain an explicit owned execution identity during approval/dispatch; block setup/template/preparation actions that clear it while dispatch is pending or execution status is unknown. Capture run/task IDs before awaits. An execute IPC rejection must not imply the backend did not start; retain Stop/reconciliation until authoritative terminal state is observed. Add a deferred execute response and rejected execute regression showing settings cannot clear the run and Stop remains usable. No real model call is necessary.

Other preliminary checks: strict cue:local-json-setup DTO and trusted sender hooks are present; explicit setup form is read-only on load; count/time/output bounds and CAS are forwarded through the protected core API; rendering uses textContent. These observations do not override the lifecycle blocker. Actual Electron QA is owned separately.

No network/model/native probe was run. This artifact must be superseded after maker correction and final independent gates.

Renderer SHA256 at finding:
66805C6AB12788E89CB51D8092AF63834E6655A519204A3A2467988CF21D20E3


## Follow-up source review: dispatch race correction still needs ownership proof

The maker's execution identity and in-flight latch fix addresses the initial setup/dispatch clearing race and discards obsolete poll responses. On this subsequent snapshot, renderCard still releases activeExecution whenever the task state is completed, failed or blocked. A blocked task can retain runtime ownership/unknown cleanup after Stop or deadline. Releasing the identity at that point hides Stop and permits setup clearing without actual cleanup proof. Parent and maker were notified before final test execution.

Required next gate: full-run authoritative unresolved ownership/cleanup status (not a truncated history list and not task state or Stop acknowledgement alone); blocked/unknown keeps identity and Stop, then verified settlement releases it. The initial review remains BLOCKED until this remaining condition is resolved. No final test PASS claim is issued for this snapshot.

Follow-up renderer SHA256:
987D5CADE184842A17C697DDF83AFBDBE3EF38CC1704CD7C136C5D2ACBD83394

## Final delta review — PASS after lifecycle and visibility corrections

2026-09-11 final independent verdict: PASS for setup UI/IPC and corrected renderer ownership handling. The earlier BLOCKED findings above remain as history; they are superseded for the hashes listed below. No product source edits or model calls by this reviewer.

Resolved:
- Approval/execute captures immutable run/task identity before awaits. The active execution latch blocks setup, new preparation and template clearing while dispatch is pending or status is uncertain. Rejected execute IPC preserves the identity and starts ledger reconciliation; it does not imply no execution occurred.
- Identity releases only after matching taskId/runId, terminal task state and explicit executionOwnership.status=released. Missing, unknown, unresolved and wrong-run release statuses keep Stop/control identity. A Stop acknowledgement alone cannot release it. The host projection reads all unresolved attempt rows and retained daemon handle/settlement state; bounded UI history is not the proof source.
- First execute IPC failure reveals the result/recovery ancestor as well as Stop, with unknown-state wording. The regression checks Stop has no hidden ancestor, addressing the actual QA finding that an enabled DOM button could still be invisible.
- Obsolete status responses are discarded after await by poll generation. Captured identity remains usable by Stop despite intervening UI events.
- Strict read/configure IPC schema, explicit save, CAS refresh, count/time/output bounds, read-only load, restart latch, metadata text rendering and no autoqualification remain intact.

Independent final validation:
- cwd daemon: `npx --no-install vitest run test/integration-local-json-setup-ui.test.ts test/integration-local-json-setup-core.test.ts test/integration-json-template-ui.test.ts test/p11-electron-surface.test.ts test/integration-resource-ui.test.ts test/integration-selection-mode-ui.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`: exit 0, 17 passed in 5 actual files, 22:29:16, 6.87 s. The final named selection-mode path does not exist and contributed no tests; it is not counted as coverage.
- Correct existing mode file and prior renderer regression separately: `npx --no-install vitest run test/integration-selection-preference-ui.test.ts test/p10c-renderer.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`: exit 0, 5 passed in 2 files, 22:29:48, 2.75 s. Total final nonoverlapping focused coverage: 22 tests.
- `npx --no-install tsc -p tsconfig.json --noEmit`: exit 0.
- Maker final renderer and setup-test hashes match independent reads.

Scope limits: these are DOM/IPC/core fixture tests and source review, not a real model invocation or OS cleanup proof. The UI consumes authoritative host ownership status rather than issuing that proof itself. Actual Electron screenshots and native cleanup measurement remain separate evidence owned by their assigned executors. Setup availability does not imply qualification or main activation. No full-project completion claim.

Final SHA256:
- app/ipc.mjs: 92EC78603BECE540CD0CF8CD9CCDDF9F16185454725972809DA9C26BF90547E7
- app/ipc.d.mts: 02D95FB186E34202D372ACBA0095A260E333703FB51BC752F86BFBBF33436E24
- app/preload.cjs: 7A0B150870FF053CCFB8F978B038B0432924EF7F4FD7BF657948DFF59C1889E2
- app/renderer/index.html: 003062D523733614F55FC47B935A33037C9CAECC190CE05F066209992F7B9BBA
- app/renderer/renderer.js: 1F3F258461AE1470154983F9D3F1CAF24D6713B57D511D9FFF8B9C5466F758D1
- daemon/test/integration-local-json-setup-ui.test.ts: DE3DD26B22CC887B3A17D39CC060DC4905295301FCEC190DF85505161ADCB6B9
- daemon/test/p11-electron-surface.test.ts: DAAAD1B8BC92F28DA7AA49B4E52D9465E171909C738779D796135A6B1A6A3C44
- scripts/p11-electron-proof.mjs: 5EA82A2AB7C54A74F133F3A4FA526DF8EBD1F762F91DFD0C597D2C388D6DD3C0
- daemon/test/p10c-renderer.test.ts: 477C887E1D607E7CB3F229960EF512B846E3DCED37B109B88C78C64E44704048
- daemon/test/integration-selection-preference-ui.test.ts: C61F3355AA5BFEF168E20FDBF8715B5E97274EDBC0FA68145DD734D7BF71D53A
- app/core.mjs: BD7F47D4C9FA4F54FA40325B48B49D2D9BF00835AC49C6A785709C51860948AB
