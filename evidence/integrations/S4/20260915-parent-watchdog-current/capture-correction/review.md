# Independent S4-06 completion review

Verdict: **NOT CLOSABLE from the current capture receipt.** The product-facing OS observations are positive, but the authorized capture runner failed its own postcheck and did not complete its cleanup contract.

## What the preserved run establishes

The corrected v2 gate ran the named five files against the frozen current source. Vitest exited 0 with 5 files and 10 tests passing. The raw output contains exactly one parent-death identity frame:

- parent PID `84100`, wrapper PID `131696`, worker PID `15356`;
- wrapper identity before: PID `131696`, parent `84100`, creation `2026-09-15T09:54:56.0381750Z`;
- worker identity before: PID `15356`, parent `131696`, creation `2026-09-15T09:54:56.7666450Z`;
- both after-identity observations are `null`, and all original/current wrapper/worker liveness fields are `false` before the test's fallback cleanup branch;
- reported elapsed time from starting the synchronous parent `taskkill` through the bounded post-call polling observation was `6932 ms`.

The AppContainer profile query preflight returned count 6. Runner control flow computed the after count, asserted source/dist hashes unchanged, and asserted the profile count unchanged before reaching the recorded latency assertion failure; the maker receipt records count 6 before and after. The named verification and enforcement-seal tests passed, including their refusal assertions. The separate targeted-termination evidence covers an actual sibling-isolation stop fixture.

The OS participants are test-created processes and the real launcher/controller/worker paths, rather than provider processes. The controller is a fixture controller exercising actual OS child behavior. No real provider cancellation or billing consequence was measured.

## Why the completion receipt remains failed

`capture-correction-v2/result.json` records `passed:false`, stage `postcheck`. Its runner required total `terminationLatencyMs <= 5000`, but the test's 5-second bound applies to polling after synchronous `taskkill` returns. The captured 6932 ms includes `taskkill` duration, so this runner oracle is not equivalent to the source test's wait bound. The next runner check also expected `createdAt`, while the raw DTO uses `created`; it was not reached.

Because postcheck aborted before the guarded removal block, `result.json` records `removed:false`, and independent inspection found the canonical owned directory `D:\Temp\User\cue-parent-watchdog-capture-v2-gN4iBr` still present. Thus the required successful terminal receipt and verified owned-root cleanup are absent. The earlier capture attempt is properly retained as `unknown_fail_closed` because its invalid PowerShell preflight produced no execution receipt; it is not evidence of a product failure.

S4-06's current source behavior has strong positive local OS evidence, but its stated completion requires the successful receipt and cleanup. It should remain open until an evidence-only correction records safe removal of the retained owned root and resolves the mismatched receipt schema/bound without retrospectively rewriting this failed run as PASS. No repeat OS launch is needed to preserve the valid raw test observations.

## Pins reviewed

- v2 gate log: `068b0eab200f7430921a73396451d0a9b17b3b3805e1d52bd60ce2a204105f87`
- v2 failed result: `786d7288a42228a04a318eefe3c9548a26fec3aedd107b198a73ed4a142bbf30`
- v2 runner: `34e203305ee52902afed085e2b280e56c0b7ba7e5f1595fc09135f9ec017ed32`
- original current-source parent sentinel test: `e13755ad1e401b003f1390d96a3318598e7ec0b29201172a624186242872c3d2`
- original current-source containment test: `17339087e6b8ec2cd757c656fb73fccce52f8d666a6ee87d992b3bd6deee63b5`
- verification test: `66514ac6533d86989b2bccbb757031d3231027dd7ab371d8777835e44ab62176`
- enforcement-seal test: `c8d02f5ec1516d032d5aca0047d156a877e824d4adeecf3e0078a36da6f11c2f`
