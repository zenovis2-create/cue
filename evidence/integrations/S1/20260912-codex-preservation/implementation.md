# S1 Unit 1 Codex preservation implementation evidence

Date: 2026-09-12
Attempt cap: 2 of 2 used
Status: offline component hostile suite, repository typecheck, and build passed; independent review required

## Preserved baseline

The work began from the exact S3 correction-2 bytes recorded in its handoff:

- `host-codex-controller.ts`: `499387243a1d00d20550252c6bca7788542f2d2ae41666b31abdfc3eac5ffbff`
- `host-codex-runtime.ts`: `22d2217b119f8762b165c8afd7b853f24370b9518e10b7565785ead85364ecaf`
- `integration-executors.ts`: `bb92f752add89464bbafc58bce3733c4b15a31a30e34e991decd6229b091733f`
- `integration-executors.test.ts`: `87d083f515fe47d3c542402350fd3d27d5f753363225adbecfb6bcc7622e7071`

The default candidate still declares `host-codex-controller-v1` typed activity and `session-handle-v1` durable execution identity. The executor still returns `session:<handle>` and the exact backend/result object.

## Implemented component contract

- Provider thread, turn, and call IDs are bounded at the controller input. A tool activity publishes only a domain-separated SHA-256 `call:<digest>` reference, so a provider call ID cannot place a prompt, secret, stderr, or absolute path in typed activity.
- Duplicate final-output bytes, foreign item/terminal events, and activity after terminal are quarantined. Existing call-ID replay, concurrent-call, and post-terminal call rejection remain active.
- A synchronous controller observer failure poisons the run. The executor assigns monotonically increasing activity ordinals and converts synchronous or asynchronous activity-sink failure to a failed completion.
- Binary, model, canonical tool identity, owner, envelope, runtime options, and controller arguments are copied from own data properties into frozen snapshots. Proxy/accessor inputs are rejected before launch.
- Pre-abort does not launch. Abort during launch, repeated explicit cancel, and stop failure cannot produce success; stop is attempted at most once. A successful stop emits only `client-cancel-acknowledged`, with no provider-terminal or cleanup claim.
- Goal-verification failure remains a failed adapter completion while the raw host receipt remains available for host verification.
- The existing runtime launch, clean Codex home, sole `cue_workspace` dynamic tool, goal verification, and RPC → worker stop → worker completion → controller → credential cleanup teardown order were retained and covered through offline seams.

No real Codex binary, provider, model, network, native helper, Electron, or worktree execution was performed.

## Mutation attempts

Attempt 1 added the boundary checks and hostile fixtures. The focused run reported 22/34 passing and 12 failures, all caused by one helper parameter shadowing the `value()` descriptor reader. Runtime-contract remained 18/18 passing. TypeScript also identified the same local issue.

Attempt 2 renamed that parameter and completed the corresponding type narrowing without changing the preservation hypothesis.

## Measured gates

From `daemon`:

```text
npx --no-install vitest run test/integration-codex-adapter-preservation.test.ts test/integration-executors.test.ts test/host-codex-controller.test.ts test/p10c-host-controller.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
4 files / 34 tests PASS / exit 0

npx --no-install vitest run test/integration-runtime-contract.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
1 file / 18 tests PASS / exit 0

npx --no-install tsc --project tsconfig.json --noEmit --pretty false
PASS / exit 0

npm run build --silent
PASS / exit 0
```

The first shared-tree compiler/build attempt was blocked only by concurrent Unit 2 `provider-lifecycle.ts:145:71` TS1024. That owner corrected its declaration, after which this source-unchanged S1 revision reproduced typecheck and build exit 0. This was a transient shared-tree remeasurement, not another S1 mutation hypothesis.

Scoped tracked and new-file whitespace inspection produced no whitespace error; Git emitted only the repository's LF-to-CRLF warnings. The no-index command returns 1 because the new file differs from `NUL`, not because `--check` found whitespace.

## Current SHA-256

- `daemon/src/host-codex-controller.ts`: `d06b68bef5bc3158c89ae8883bbc3338bf1fe223b01647885a1e34db316539b7`
- `daemon/src/host-codex-runtime.ts`: `22d2217b119f8762b165c8afd7b853f24370b9518e10b7565785ead85364ecaf`
- `daemon/src/adapters/integration-executors.ts`: `165c78cfc6728003cc427ccd5224c220c2a423280b6390ae4e6af6961fab5f89`
- `daemon/test/host-codex-controller.test.ts`: `fced2c6bcca430819067ba19b73529cbd9fd536a6b246b70efa4c798e300d55b`
- `daemon/test/integration-executors.test.ts`: `87d083f515fe47d3c542402350fd3d27d5f753363225adbecfb6bcc7622e7071`
- `daemon/test/integration-codex-adapter-preservation.test.ts`: `b906114a2c43e88f9f387970b435289080bab903147edf5c8463a3877e444414`

## Evidence boundary

This strengthens only the offline regression component behind the existing broad Codex-preservation checklist line and the event input needed by cancellation/provider-lifecycle work. It does not prove the installed Codex binary, authentication, provider/model behavior, P13, remote provider termination, billing finality, or real stop/cleanup. Those completion claims remain open. Independent review is required before even the offline component is called PASS.
