# Independent Electron startup-correction preflight

Verdict: **CLEAR for the separately coordinated actual attempt 2.**

The failed attempt-1 output remains isolated under `actual-attempt1`; the corrected harness writes only to the new `actual-attempt2` directory. Both the Electron child branch and parent orchestration branch now execute inside `async function runProof()`. Module evaluation ends with synchronous `startBootstrap(runProof, onError)`, whose implementation schedules the async function and returns `undefined` immediately. There is no top-level await in the entry module.

The controlled readiness test proves the ordering needed to address the prior deadlock hypothesis: the caller returns and module evaluation records completion before the async task reaches its readiness await; initialization occurs only after readiness resolves. A separate test proves a rejected bootstrap task reaches the error handler once. The builtin VM test parses and links the complete current harness without evaluating it and reports no top-level await. This matches the established successful Cue Electron harness pattern that starts an async IIFE/task rather than awaiting readiness during ESM evaluation.

The child now writes and fsyncs `readiness-before.json` immediately before `app.whenReady()` and `readiness-after.json` immediately afterward, before dynamic Core/IPC imports. These markers will distinguish another readiness failure from later Core/renderer failures. They supplement rather than replace the existing terminal result, parent exit, backup, and visual receipts.

The correction preserves the nine field-level screenshot oracles, exact invocation and monetary-unknown assertions, blocked/cancelled state, unresolved ownership, unknown cleanup, expected `Core.close()` refusal, fixture-only database teardown, source/generation checks, request denial, backup integrity, child-close verification, and canonical-root guard. The bootstrap helper and correction plan are included in before/after hashes.

Reviewed pins:

- `electron-proof.mjs`: `0325c9423ae12ec610176da4cf5cb93e99ecaf3a02c891dfc07e097828ab7052`
- `startup-correction/bootstrap.mjs`: `52237b0e7a27a0fdb1e9bf2c9d719c2a6e64472cb404e503ddcf1141d229f4c2`
- `startup-correction/bootstrap.test.mjs`: `6e6ba46c155f3d65d8bdb7bec624e06c64243575a4a906a2b8a2f024627df186`
- `startup-correction/PLAN.md`: `2fa8472822d0b6736e4c5cfbbfaf2e70fe32a9c6376f27db6ac75c81e036a591`

No Electron window, OS integration test, product edit, build, provider, model, native helper, or network call was performed during this review.
