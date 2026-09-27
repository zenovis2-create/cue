# Independent review — public-driver restart actual 3

Verdict: **VALID HARNESS-CONSTRUCTION FAILURE; CLEANUP VERIFIED; A04 NOT CLOSED.**

Reviewed 2026-09-15 (Asia/Seoul). This was a read-only evidence/source audit. No actual rerun, build, provider, Electron, local-8085, process signaling, deletion, or retained-root/database access was performed.

## Evidence hashes

| Artifact | SHA-256 |
|---|---|
| `actual.log` | `a7315bc4e7cdddf2648196a1c44ef2eb4e57a640833eb67d8af442cf05b4aab8` |
| `observations.json` | `25eb912d48bf7a04f9833f60db393e1897aecfd69d28961ba2be579195d44b58` |
| `cleanup.json` | `75b536b0172f4bafacfc6973a1f550e6cff3793c3ffed8a49c9e263b4694172d` |

Actual 3 used fixture pin `e3ccd1d492885b2e5f4d1fb1aee8800242eafb64efe6c9656456c2e2424c8d73` and test pin `8192234f3004a6d075eeca31df86d9c76511026c3836e109cfc966e030449ef9`. Full runtime pins remain in `runtime-pins.json`.

## What the run proves

All seven offline tests passed. The first actual child then produced a durable response proving one exact intent, zero result, and a committed native replacement with `published-by-public-driver`. Its intent payload, publication ID, preimage/postimage identities, and content hashes are retained in `observations.json`.

The second child passed the independently observed PID/creation-time handshake and reached fixture line 65. It then exited 1 before emitting a restart response. The correction-5 diagnostic path preserved the exact failure:

`driver_final_publication_host` at `app/orchestration-driver.mjs:108`, called from restart fixture line 65.

At the pinned driver source, construction requires a supplied `finalPublication` host to implement `authorize`, `openStagedAttempt`, and `readStagedReplacement`, with optional `execute`. The restart fixture supplied only `authorize` and `execute`. The driver therefore refused that malformed fixture host during construction. Neither public `start('workflow')` nor `snapshot('workflow')` executed in the second child.

This is a harness-construction failure, not a product restart/recovery verdict. It does not establish the cause of actual 2: actual 2 had no preserved stderr, and its immediate exception remains unknown. Correction 5 exposed a source-inferred latent fixture bug; actual 3 is the first run that proves this constructor failure directly.

## Cleanup verification

The durable cleanup receipt records:

- first child PID 81472, exact creation time, `closed:true`, exit 1, no signal, empty stderr;
- second child PID 106868, exact creation time, `closed:true`, exit 1, no signal, captured constructor stderr;
- exact scenario root `D:\\Temp\\User\\cue-public-driver-restart-Sj8EGb`, `absent:true`, `retained:false`.

Independent read-only checks found both PIDs absent and the exact actual-3 root absent. The retained actual-2 root `D:\\Temp\\User\\cue-public-driver-restart-k3JYSB` remains present and untouched. Actual-3 cleanup is verified.

## Required correction

Correction 6 should provide deny/count stubs for the complete current `finalPublication` host contract, including `openStagedAttempt` and `readStagedReplacement`, and assert their counts remain zero along with authorize/execute/relaunch counts. The restart host must come from one shared exact factory used by both the offline constructor/refusal test and the executable actual fixture, so the offline gate cannot pass with a different host shape.

The corrected restart response must retain the public start/snapshot refusals, separate durable ledger task state, held/recovery/postimage assertions, and exact cleanup/diagnostic behavior. Actual 4 must wait for new frozen fixture/test pins and independent preflight.
