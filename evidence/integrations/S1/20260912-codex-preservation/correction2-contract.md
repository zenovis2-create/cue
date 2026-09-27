# S1 Unit 1 Codex preservation correction 2 contract

Date: 2026-09-12
Attempt: correction 2 of 2, final

## Exact blockers

1. `controllerArgs`, `egress`, and `allowed_actions` arrays must be rejected before reading any element unless they have the exact ordinary Array prototype, a safe bounded data `length`, no holes, no symbols or extra own keys, and an enumerable own data descriptor for every index. Proxies, including revoked proxies, accessors, custom prototypes, sparse or oversized arrays, and extra properties must invoke no caller getter or iterator and must launch nothing.
2. Both raw `onActivity` and runtime `emitActivity` may return promises. Every synchronous throw, asynchronous rejection, timeout, or late settlement must be observed with zero unhandled rejections and must prevent adapter success. Completion may return only after the bounded activity queue for the sealed backend result is drained. Later callbacks cannot change an already returned success.
3. The same contract must be exercised through `createDefaultCodexCandidate`, the controller event seam, and the runtime/default composition fixture without executing Codex, a provider/model, native helper, Electron, external network, or a worktree command.

## Kept invariants

Preserve the exact current wrapper launch data, clean Codex home, owner/envelope binding, sole `cue_workspace` runner, independent goal verification, stop-once cancellation, ordered teardown, opaque provider call digest, S3 typed activity declaration, and `session:<handle>` durable reference. A cancel acknowledgement remains neither provider terminal nor cleanup.

## Final gate

The reviewer accessor repro must produce `hits=0` and `launched=0` for all three array fields. The asynchronous raw sink repro must return a non-success completion with zero unhandled rejections. Run the focused Unit 1 four-file suite, runtime-contract regression, P10C host controller regression, TypeScript, build, SHA-256, target diff, and whitespace checks. Keep the change only if all direct counterexamples and regressions improve. If any blocker remains after this pass, record final BLOCKED; no third mutation pass is allowed.
