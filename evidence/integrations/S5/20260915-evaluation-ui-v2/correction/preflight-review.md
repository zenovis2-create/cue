# Independent Electron harness preflight review

## Verdict

**READY for the single actual Electron attempt**, conditional on the recorded source/build freeze remaining current at child startup. This is harness startability approval only. It does not claim a successful Electron observation.

## Verified path and boundaries

- The actual child binds an exclusive temporary Electron `userData` and `sessionData` profile before `app.whenReady()` and checks the resulting paths.
- It loads the current renderer through `BrowserWindow`, current sandboxed preload (`contextIsolation:true`, `nodeIntegration:false`, `sandbox:true`), registered current IPC handlers, exact trusted `webContents`/main-frame sender gate, and current Core.
- Synthetic direct-Core fixture calls create pending policy-bound runs only. Visible enrollment, observations, coverage, unavailable comparison, stale response handling, and replacement prepare use the renderer/IPC path.
- Approval, execute, and Stop are denied and counted; network fetch is denied and non-file web requests are cancelled. Acceptance requires all counters to remain zero and no approval, orchestration attempt, session handle, or native identity rows.
- Expected outcomes remain `unknown`, unavailable, or unobserved. The harness makes no success, improvement, provider, model, native, execution, or qualification claim.

## Corrected synchronization and screenshots

The stale-response seam now leaves synchronous Core/IPC comparison behavior unchanged. The harness delays the already computed public IPC reply once, replaces the active run, releases the reply, waits for an after-gate marker, and yields two renderer animation frames before inspecting the DOM. Both offline and Electron paths use the same scenario and exact guard-tag sequence, including the second `ipc:prepare`.

The stale comparison form and replacement-current screenshots are separate. Both compact targets must fit fully within the vertical viewport. Other long-form screenshots prove only the visible portion; no full-form visibility claim follows.

## Offline evidence

`offline-attempt-IBMtCK` completed with process exit 0 and `result.passed:true`:

- 7 evaluation IPC calls and 9 guarded Core evaluation calls.
- 0 approval, execute, and Stop calls.
- 3 pending tasks/runs, 2 enrollments, 2 observations.
- 0 approval events, orchestration attempts, session handles, and native identities.
- Revision-1 observation remained unknown; resubmitting the same observation ID with the advanced expected-prior revision was rejected with no row or database change; revision 2 added one row.
- Coverage showed the observed evaluation member and unobserved holdout member.
- Delayed reply return was observed, stale unavailable content stayed discarded, and the replacement run identity changed.
- Fetch calls were 0; SQLite backup integrity was `ok`; Core closed; the canonical direct temporary child was removed; before/after selected manifests were byte-identical.

The backup target is protected structurally by the exclusive new actual output directory. Failed actual attempts may retain their owned temporary filesystem root, so the final report must not claim unconditional filesystem cleanup.

## Exact reviewed harness SHA-256

- `8961c6b4fe629e6583594ec93a76bdc9a77be82e3ee99673191e410291039e66` electron-proof.mjs
- `b4b1cce53661e378ea5a9bc047e4469b1a8f71d9efdaae2c6041edfcb9f7da40` evaluation-fixture.mjs
- `637d08b9707f9a5060338f0c910d5b8f7ffa5d181fb238a1530c91676766e25f` evaluation-scenarios.mjs
- `b964feabb69bd86ab02c9f8ba0e4df56d3623a9b8bfb24fad24047b28b9ffca4` offline-test.mjs
