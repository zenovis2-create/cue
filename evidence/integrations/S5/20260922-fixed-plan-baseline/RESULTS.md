# Batch92 — fixed-plan manual baseline / desktop consent

2026-09-22. Direct implementation and self-review; no independent agent review. Original checklist33/44 closed,11 open. Qwen OFF; subscription allowance4/4 remains exhausted. No real provider/model/account calls, credentials, user-home mutations, publication or commit.

## Implemented

- Added `daemon/src/evaluation/baseline-plan.ts`: validates actual immutable plan/envelope/monetary policy, no global pin, singleton per task, same implementation candidate and distinct verifier candidate/owner. Verifier depends on every writer and has no write scope; maximum16tasks. Refuses fallback lists, model/planner tasks, replan revisions and attempts outside original task candidate membership. The native execution host/selector's existing conditions are **not weakened or changed**.
- Added optional **explicit** `planDigest` to the canonical baseline contract. No-plan legacy declarations retain their original bytes and global pinned-candidate requirement. `fixed-task-plan-v1` candidate identity describes the task-selection plan, **not a measured model version, installation, account or provider qualification**.
- Baseline admission/read and outcome projection validate the fixed plan and canonical candidate/policy binding. Outcome-only baseline still produces `trial:null`; known failures stay failures rather than becoming unavailable solely due to the arm/mode mismatch.
- Added `baseline-confirmation.ts` and Core `requestManualEvaluationBaseline`: bounded descriptor-safe snapshot; host-derived policy/candidate/plan/time/unique confirmation reference; eligibility before any external UI; only literal trusted-host true;120second bounded freshness/current workspace recheck; existing IMMEDIATE transactional preflight after confirmation. A ledger-local pending fence denies concurrent dialogs. Exact historical replay returns prior declaration; changed replay refuses.
- Added exact `baseline` operation to existing evaluation IPC (no new unrestricted channel). Renderer may provide only dataset/case/IDs/user refs, not run/policy/candidate/time/confirmed/authority callback. IPC derives current run and invalidates pending confirmation after new preparation, approval, execution or Stop.
- Connected `app/main.mjs` to **native Electron dialog** with Cancel as default and explicit unchecked acknowledgement. Confirmation requires affirmative button **and** checkbox; protected configuration and window identity are rechecked. Core/IPC tests inject mock dialog outcomes, not actual user consent.
- Added baseline action to existing evaluation panel, requiring full manifest and explicit case; reuses reference fields, ignores policy editor values for this operation, handles errors/stale replies and locks enrollment after success. Does not create an execution approval.
- Updated [usage guide](../../../../docs/integration/MANUAL_BASELINE.md) and current checklist/progress/remaining overlays. Exact previous file bytes are retained in `preimages/`; unrelated dirty work was not reset.

## Verification

| Run | Result |
|---|---|
| Initial builds `build-pass1.log`, `build-pass2.log` | exit0 |
| First focused implementation tests `focused-pass1.log` |6files51pass,0fail/skip |
| Final `build-final.log` / `.exit` | exit0 |
| Final `regression-pass1.log` / `.exit` |**38files257pass,0fail/skip,exit0**,111.03s |

The final38 files include19 newly added tests, legacy baseline/enrollment/outcome/comparison, workload/app bridge, Core workspace, current renderer/IPC, native implementation host, compiled Node imports, protected installation and planning regressions. First focused tests overlap and are **not added** to257. `summary.json` reconciles all38 selected files in `test-files.txt` to executed verbose rows, missing/unexpected0.

Concrete checks:

- Actual SQLite declaration/reopen and recorded failed baseline projection with an unpinned real policy and singleton task plan.
- Existing `integration-native-host-core-positive.test.ts` now confirms/registers its **built-in native host's actual Core-prepared plan** before its pre-existing fixture approval/acceptance flow. Baseline registration itself has approval_event0; original launch counter remains0. Existing fixture authority is not provider qualification.
- Actual renderer→structured-clone IPC→Core→SQLite register and UI lock, with mocked host response and no execution/approval calls.
- The production main-process dialog method is evaluated with a mock Electron dialog to assert default Cancel, required checkbox, displayed writer/verifier/plan and pre/post guard checks. This is **not a real Electron window/screenshot/user acceptance test**.
- Unknown host/sender, unsupported plan, direct legacy unpinned declaration, renderer authority fields/getters/proxy, cancellation/nonliteral true, stale clock/current run, concurrent requests, approval/Stop/new-run races, changed plans/replay and oversized/missing saved plans all refuse. Mutating original renderer input while awaiting confirmation cannot change the frozen request.

No failing build/test hypothesis occurred in this batch; no test weakening, skip, timeout increase or exhausted actual-gate rerun was needed. The last whole `npm test` remains batch89, before90–92. This targeted run does not supersede that historical whole-suite scope.

## Remaining / interpretation

This implements choosing **the currently configured protected fixed combination** as the manual baseline. It is not an arbitrary candidate/model editor, a real user's already-recorded choice, an independent review, or successful live execution. `planDigest` does not prove executed input bytes. Enrollment remains `claimed-not-verified`; quality/time/cost measurements are not fabricated; `trial:null` and promotion denial remain.

Next implement production executed-input/measurement evidence and fact→trial conversion with missing/unknown lineage preserved. Representative baseline/paired four-mode holdout measurements, current provider qualification, authoritative remote cleanup/final billing and release acceptance still require genuine evidence and renewed live-call scope/budget where applicable.
