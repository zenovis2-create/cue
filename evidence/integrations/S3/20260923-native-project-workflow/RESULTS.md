# Batch102 — native project workflow and session search

## Implemented

- Extended `scripts/p11-electron-proof.mjs` with disposable real-Electron project-add/switch and denied-switch fixtures. The positive path exercises renderer→IPC→Core close→active-root config swap→app quit and reopens Core at the second root. Folder picker and confirmation return **synthetic** responses; `app.relaunch()` is intercepted. This is not human consent or a real OS restart.
- The denied path inserts a **synthetic held writer lease** in the disposable ledger, then exercises the renderer switch request. It observes refusal and unchanged active-root config. It does not establish refusal against a real active provider process or a prepared-approval state. An initial attempt to prepare in the default proof app failed because no qualified tool was configured (`native-denied1-run.log`); no bypass was granted.
- Added one visible `<main>` per view, skip target and focus transitions for navigation/details/archive, associated goal and autonomy control names. The first native capture exposed a white-on-white history pane inherited from legacy `main` CSS; a scoped dark-surface rule corrected it. `final-workspace/p12_workspace_smoke.png` is the post-fix capture. Focus outline is visible. JSDOM/DOM checks and actual Electron rendering are **not** screen-reader or representative-user acceptance.
- Added bounded, literal session title/first-4096-goal-text search through workspace-scoped SQLite, strict IPC DTO and sidebar controls. Search cannot grant resume, approval, provider connection or execution authority. Search results are paged and historical metadata only; archive filter remains explicit. Session naming remains automatic from the first goal, not user editable.

## Verification

- `daemon npm run build`: exit 0 (`build-final.log`).
- Selected regression list: `test-files.txt`, 26/26 files, 195 passed, 0 failed (`regression-final.log`). The focused session files had 14 passed (`focused3.log`); those are included in the 195, not additional tests.
- Final actual Electron disposable proofs: `final-project-switch/` positive, `final-project-switch-denied/` synthetic-lease refusal, `final-workspace/` navigation/focus; each exited 0 and reported `passed:true`. The positive Core reentry found two registered projects and one current project. The navigation proof found one session, no run, disabled approval, history visible and history `<main>` focused.
- First completed root `npm test` attempt: **305 files passed, 2 failed; 2,229 tests passed, 3 failed, 10 existing skips**, exit 1 (`whole-suite.log`). Two startup-plumbing fixtures used a nonexistent root/empty DB after project catalog wiring; one P12 contract rejected `wc.capturePage()` in the new visual smoke. The startup test now explicitly mocks the catalog (the real catalog has separate integration tests), and visual smoke uses the same CDP `Page.captureScreenshot` path as P12. Focused 2 files/10 tests passed (`root-failures-focused.log`), and native CDP navigation passed (`final-workspace-cdp/`). The failed whole-suite log remains preserved.
- Fresh final root `npm test`: **307/307 files, 2,232 passed, 10 existing skipped, 0 failed, exit 0** (`whole-suite-final.log`, `whole-suite-final-exit.txt`). This supersedes the last *completed passing* root regression from batch89 for current source, without erasing the failed attempt or substituting for live acceptance.
- `git diff --check` on touched implementation/test paths: no whitespace errors. No live provider/model/account/service call was made.

## Limits and unresolved gates

- No actual `app.relaunch()` cycle, real OS folder/confirmation selection, prepared-approval denial in an otherwise qualified app, active provider cleanup-failure exercise, keyboard-only human review, NVDA/other screen-reader review or representative user acceptance.
- Batch101's 1,200-second root timeout and earlier P12 failure remain historical failures. The final root pass above covers current code; it does not prove live qualification, accessibility or representative user acceptance.
- No independent reviewer, live provider/account admission, final-billing observation, production measured-fact host, representative paired evaluation or four-mode improvement claim. Original checklist remains 33/44 closed and 11 open. Qwen remains off; subscription allowance remains exhausted 4/4. New real calls require explicit scope/budget approval.
