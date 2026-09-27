# Batch101 — project and Cue-owned session management

2026-09-23. Offline implementation, no real provider/model/account/service calls, no credential copying, commit, push or publication. Existing dirty/untracked work was preserved.

## Shipped source

`daemon/migrations/053_workspace_management.sql` + ledger/copy-assets install and definition check; `app/workspace-management.mjs`, `workspace-management-ipc.mjs`, `project-switch.mjs`; Core switch readiness; host dialog/config swap/relaunch; strict IPC/preload; project and multi-run Cue-session UI. A continued session creates a **new approved run**; it does not reconnect a provider handle, resume writes, or inherit a prior envelope. Project addition registers an existing canonical folder only. Same-root ownership, pending approval, queued/running work, unresolved write/attempts and in-flight async IPC deny switch. Close failure retains old config; post-close failure is blocked, not reported successful.

## Verification

- Final daemon build exit0: `build-final.log`.
- Selected regression: **29 files, 213 passed, 0 failed/skipped**, exit0, start09:36:54 +09:00, duration122.79s (`test-files.txt`, `regression-final.log`). New tests cover migration, project containment, session link/read/page/archive/reopen, SQLite cross-worktree trigger, Core refusal and post-close other-root reentry, IPC projection, lifecycle ordering/refusal and JSDOM history/continued-goal flow. Selected success is not the whole suite.
- P12 isolated Electron cleanup-failure receipt test: **1/1 passed** after exact preload API list correction (`p12-final.log`); the injected cleanup failure is still expected to be a failure receipt, not a pass.
- Actual temporary Electron default-app **window security/UI proof passed** (`native-ui-final/p12_electron_window_result.json`, screenshot). Native local **session-create smoke passed**: one current project, one new Cue session, zero runs, approval disabled (`native-smoke/p12_workspace_smoke.json`, screenshot). This does not exercise project switch, model preparation/execution, keyboard/screen reader or representative human acceptance.
- Chromium file:// static 1180px screenshot: `workspace-1180.png`, visual reference only.

## Preserved red and uncertainty

- `build1.log` was TypeScript-green but initial `focused1.log` failed because new migration was not copied into compiled assets and the exact preload surface test still listed the old API. Corrected asset copy and test allowlist; `focused2.log` passed.
- `build3.log`, `build7.log`, `build9.log` contain test-typing errors corrected in new tests. `new-tests2.log`/`new-tests3.log` preserve async-test expectation mistakes; `new-tests4.log` passed. `regression1.log` preserved two UI ordering failures caused by an unnecessary microtask in legacy no-session mode; `correction1.log` passed after keeping that path synchronous.
- Root `npm test` **did not complete within 1,200s** (`whole-suite.log`, `whole-suite.status`, `whole-suite-termination.log`). An observed P12 proof-result test failed because `scripts/p11-electron-proof.mjs` still asserted the old exact preload API list. This was corrected and isolated P12 passed (`p12-corrected.log`, `p12-final.log`), but the aborted root suite was **not** promoted to a pass or rerun. No global regression verdict.
- Previous batch100 Electron visual timeout remains historical evidence; this batch's default-app proof succeeds only for the bounded window and local session-create surface. No multi-project native switch, no independent/assistive-technology acceptance, no live qualification, no final billing/remote cleanup observation, no four-mode improvement claim.

Original integration checklist remains **33/44 closed, 11 open**. Qwen OFF; subscription allowance 4/4 exhausted.
