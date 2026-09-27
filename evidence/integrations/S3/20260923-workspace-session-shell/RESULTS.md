# Batch100 — current-project work-session shell

2026-09-23. Direct implementation/self-review, no delegation or independent visual/native acceptance.

## Implemented

- Reorganized `app/renderer/index.html`, `renderer.js`, `styles.css` into a dark project/session sidebar and separate work, historical session, evaluation, and tools/settings surfaces. Existing goal/approval/Stop elements and IDs remain. The session selection is read-only and does not change the active execution or evaluation run. New work does not silently discard active/pending approval.
- `app/workspace-sessions.mjs` reads only run rows whose saved envelope equals the current canonical Core worktree. Bounded20/page cursor and exact historical detail, no provider handle/reconnect token, execution, approval, Stop, or filesystem mutation. Core→strict IPC→preload→renderer is connected. One run is one displayed work-session record, not a cross-run conversation. Current project display is real; project addition/switch/removal is **not** claimed because the app has a single startup-bound Core and ledger owner.
- `docs/integration/WORKSPACE_SESSION_SHELL.md` states the boundary and next safe multi-project/session work.

## Verification

- Final `daemon/npm run build`: exit0 (`build-final.log`).
- Final selected renderer/Core/P11/P9 regression: **28 files, 203 passed, 0 failed/skipped**, exit0, start08:38:20 +09:00, duration112.90s (`regression-final.log`, exact test paths in `test-files.txt`). New four tests use actual Core/SQLite/reopen/IPC and JSDOM, plus worktree isolation, forged commands, history navigation and pending approval preservation. No provider/model/account/service call. Selected run is not a complete root `npm test`.
- `workspace-shell-chrome.png` (1440×900) and `workspace-shell-1180.png` (1180×760) are **static Chromium file:// render** captures, not real Electron default-app screenshots or assistive-technology acceptance. The exact screenshot profile created under this evidence directory was removed after capture; screenshots/logs retained.

## Preserved red evidence

- `build1.log`: a new test's untyped SQLite row and generic DOM Element property caused TS errors. Test annotations corrected; product behavior unchanged.
- `focused1.log`: new workspace tests passed, but P11's exact preload-function allowlist missed the deliberate new `workspaceSessions` API (5 pass/1 fail). Updated the explicit allowlist, without relaxing sender/channel guards. `focused2.log` then passed4 files/22 tests; `focused3.log` passed4 new tests after adding pending-state and escaped-text checks.
- A disposable Electron visual-capture fixture timed out after50s without producing a screenshot (`visual-capture.log`). Only its identified process tree was terminated. No claim of native visual acceptance. It was not retried under a different gate. Static Chromium captures supplied layout inspection, not the missing native gate.

## Open

The renderer remains a staged UX improvement, not a fully conversation-centered Codex/Orca-equivalent app. Project switching/addition, durable multi-run user sessions, archive/search, safe continuing, and true Electron/manual/accessibility review remain. Historical run state is not current process/cleanup/remote billing status. Batch99's incomplete whole-suite remains incomplete; no fresh whole-suite or independent review here. Original broad checklist remains33/44 closed,11 open; Qwen OFF, subscription4/4 exhausted. No credential/home changes, commit/push/publication or unrelated cleanup.
