# Independent recovery journal UI/IPC review

## Review contract

Done means the optional recovery-journal status is compatible with the actual host DTO, exposes only validated state and revision, renders no action or authority, clears stale status, and passes the focused recovery UI/run-picker gate plus JavaScript syntax checks. Review correction cap: 2. Every pass rechecks the relevant source hashes, the host DTO shape, the focused tests, syntax, and this scoped verdict. A failed pass requires a new concrete hypothesis or handoff; no product source is edited by this reviewer.

## Final verdict: PASS for the scoped recovery status DOM/IPC surface

The initial host compatibility blocker below was corrected. The frozen host now emits `revision` whenever it is a safe integer, independently of whether private `caseId` is present. This makes the first finalized DTO compatible with the IPC finality rule while `caseId` and `reason` remain stripped from renderer-visible data.

The independent backend reviewer’s frozen receipt reports the required four-file selection at 21/21 PASS, reviewer regressions at 3/3 PASS, TypeScript exit 0, and scoped diff-check exit 0. The reviewed host hashes are `9A75A130FE3C45EA3AC49313AF527A02123A294C72727FB899DC187234C2C164` for `app/native-recovery-host.mjs` and `5B4E97CB18B652F1B650A8D16D07F2FD98A3114479BE66F9674556A96ECBD40F` for its declaration. This review consumes that receipt for DTO compatibility only. The host intentionally remains held when validated handoff/external completeness is unavailable, so this PASS makes no eligible-disposition claim.

## Initial blocked finding, corrected

The renderer and IPC behavior passed their focused tests, but the initial actual host DTO was incompatible on the observation that first reached a finalized journal state.

`daemon/src/held-recovery.ts` returns `{ state, revision, reason }` from the successful `reconcileHeldRecovery()` transition; that return deliberately has no `caseId`. `app/native-recovery-host.mjs` currently emits `revision` only inside the conditional spread guarded by `journal.caseId`:

```js
...(journal.caseId ? { caseId: journal.caseId, revision: journal.revision } : {})
```

Consequently, the same `observeNativeRecovery()` call that persisted `eligible-for-disposition` or `reconciled-stop` returned a journal object with the final state but without its positive revision. `app/ipc.mjs` correctly required a positive revision for either finalized state, so it projected this response as `{ state: 'unavailable' }`. A later observation worked because `readHeldRecovery()` returned the persisted summary with a `caseId`. The correction now emits safe-integer revision independently of case ID.

## Passing evidence within the narrower UI/IPC fixture scope

- Focused command: `npx vitest run test/integration-native-recovery-ui.test.ts test/integration-recovery-run-picker-ipc.test.ts test/integration-recovery-run-picker-ui.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`
- Result: 3 files, 17/17 tests passed, exit 0.
- `node --check app/ipc.mjs` and `node --check app/renderer/renderer.js`: PASS.
- One attempted combined host/UI run during concurrent protected-source edits produced 24/28 passes; all four failures were the installation guard's expected `installation_identity_unavailable_or_drifted`. It is retained as historical failed evidence and is superseded by the frozen backend review receipt above, not waived as a product success.
- The IPC projection strips raw `reason`, `caseId`, and private fields; rejects journal accessors without invoking them; accepts only `held` revision 0 and finalized revision >0.
- The DOM uses only known labels, exposes no journal action, states that there is no automatic rerun/restore, and clears stale journal text on target/query changes and late responses.
- The Korean journal copy reports observation/reconciliation status only; it does not claim provider status, cleanup authority, resume authority, or restoration authority.

## Reviewed hashes

- `app/ipc.mjs`: `80AC4B774900CBDF44EE0D908ECA944CA1515A989ADD42D57096BE8B1ABBB819`
- `app/renderer/index.html`: `6DDD19516CB8EF70192BB63AE146D1AC28DD9154D73BAF4BBB7AFC7872506716`
- `app/renderer/renderer.js`: `F2169CA21078C5194CF3531ADEABAB2AAC92BBF8ABFD83674CDED75B23EBF78C`
- `daemon/test/integration-native-recovery-ui.test.ts`: `38AFE6154C50A88F9E37D7AEA46B89279A2628B9A0FE8697F6D9BEAAB4CB82F4`
- `app/native-recovery-host.mjs`: `9A75A130FE3C45EA3AC49313AF527A02123A294C72727FB899DC187234C2C164`
- `app/native-recovery-host.d.mts`: `5B4E97CB18B652F1B650A8D16D07F2FD98A3114479BE66F9674556A96ECBD40F`
- `daemon/src/journal-recovery.ts`: `E909C595748BC741BC41CBAAF24DF1E4C8AE3BEC47AB018720616BEFFAD9069A`

This verdict covers the recovery status DOM and IPC projection only. It does not qualify actual Electron behavior, native execution, cleanup, provider state, resume, restoration, or the broader host integration.
