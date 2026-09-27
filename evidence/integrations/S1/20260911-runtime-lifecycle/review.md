# Independent S1 runtime lifecycle review

Reviewer /root/contracts_review, 2026-09-11. Verdict PASS for bounded transient lifecycle contracts after one reviewer-requested options correction. No remaining blocker in this scope. This is not live capability qualification or full S1 completion.

Done gate: focused lifecycle/admission tests exit 0, pending/late launch ownership review, current hashes and no false cleanup settlement. Artifact write cap 1 followed by readback/hash. Reviewer made no source edits or live calls and did not rerun the old full baseline or investigate the old Codex pin.

Command (cwd daemon): `npx --no-install vitest run test/integration-runtime-contract.test.ts test/capability-admission.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`

Observed exit 0: 25 passed (17 runtime plus 8 admission), duration 610 ms. Author build exit 0 and source/test hashes are recorded in result.json. Earlier reviewed lifecycle revision passed 15 tests but had the options defect below; the final revision supersedes it.

## Reviewer finding resolved

`start(..., null)` previously rejected with a TypeError reading timeoutMs rather than invalid-request. Accessor options ran caller code outside the guarded path; rereading mutable options.signal during detach could leak the original listener. The maker now validates own plain data options before reads, rejects unknown/proxy/accessor inputs, snapshots signal/timeout, uses native signal brand/event methods, and adds malformed-input plus mutation/detach regressions. Final tests pass with no getter invocation and original listener removal after settlement.

## Ownership and cleanup review

- Start is bounded by default 30 seconds, maximum 120 seconds; pre-aborted input cannot launch. Timeout/abort returns a recovery handle and keeps the run ID reserved.
- The launch promise remains observed after timeout/abort. Late valid execution is owned and cancellation is requested where supported. Late rejection and malformed control completion are consumed without an unhandled rejection.
- Pending launch cannot settle from any clean receipt because it may still create future effects. Cleanup captures the inspected launch generation/execution and rejects a receipt when that generation changes.
- Failed-start cleanup is independently observed by the host hook; receipt must match run and subject. Unsupported cancellation, unknown/residual cleanup, cancel acknowledgement and provider completion never prove clean settlement.
- Per-run ownership and late completion behavior preserve prior admission and cleanup invariants.

## Remaining product gates

The timer cannot preempt synchronous adapter code, AbortSignal is not a process-kill proof, and a never-resolving launch remains quarantined indefinitely until an external trustworthy recovery mechanism resolves it. This module has no persistent recovery/lease ledger or real adapter activation. Host cleanup implementations must establish closed process ownership and no future side effects. Application wiring, actual P13/M tests, event/usage integration and UI behavior remain separate work.

## Reviewed SHA-256

- daemon/src/integration-runtime.ts: CE95812CAD2B3E4377CC2CAF40642A8EC5140EC873A7346873773FA6966439F1
- daemon/test/integration-runtime-contract.test.ts: AD3D22345D9F739EFD9D744DF513A13169E422915EE7A1A8FFF9109260451721
