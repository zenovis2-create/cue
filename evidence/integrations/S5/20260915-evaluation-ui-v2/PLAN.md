# Evaluation UI v2 proof plan

## Starting evidence

The historical 2026-09-12 unit remains immutable. Its second actual attempt reached the real Electron renderer, preload, trusted IPC, and Core, then failed because the harness assumed `prepareGoal` created a `local_selection_run_policy` row. Its cleanup also referenced block-scoped `guardCheck` from `finally`.

This is a changed harness hypothesis. It uses the later reviewed fixture policy binding: save/read a synthetic local policy, bind it to the prepared run, validate a matching plan, and install that plan through the orchestration store. The fixture is descriptive evaluation enrollment only and does not qualify a provider, candidate, trial, or execution.

## Done contract

Before any Electron launch:

- New paths are recorded as absent and the historical unit is not modified.
- The fixture establishes policy binding through current public stores and Core-owned SQLite, without protected Core/IPC bypass.
- `guardCheck` is declared in cleanup-visible scope; cleanup remains valid when setup or scenario throws.
- An offline JSDOM harness executes current Core, compiled evaluation stores, IPC dispatch, preload-shaped API, and renderer; approve, execute, and Stop calls remain zero.
- Main-process fetch is denied and counted; renderer requests outside `file:` are denied in the future Electron run.
- The isolated database is backed up with `PRAGMA integrity_check=ok`; source manifest is identical before/after; only a verified owned temp root may be recursively removed.
- Offline scenarios cover a successful available state, an actual Core/IPC error rendered without internal detail, and a stale response discarded after a new prepared run.
- Protocol, metric, environment, account-limit, policy, and enrollment values are synthetic bounded fixture labels. Outcomes remain unknown/unavailable; no actual provider or statistical qualification is claimed.

After offline and independent preflight, root may authorize exactly one actual Electron invocation. It must use the current Core/preload/IPC/renderer, an isolated profile/workspace/database, capture DOM receipts/screenshots for available/error/stale states, create no approval/attempt/session/native identity, and verify process closure, database backup, source guard, and owned-root cleanup.

## Caps

- Offline correction cap: 3 distinct evidence-based corrections.
- Actual cap: 1 invocation, only after root review.
- Every offline pass: `node evidence/integrations/S5/20260915-evaluation-ui-v2/offline-test.mjs`
- Syntax gate: `node --check` on all four new JavaScript files.
- Failure requires a new hypothesis or an honest blocked receipt.

No build, provider, model, network, native helper, approval, execute, or Stop operation is authorized by preparation.

