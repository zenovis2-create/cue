# Independent correction preflight — public-driver startup restart

Verdict: **BLOCKED — do not run the actual OS/process-termination gate at these pins.**

Reviewed 2026-09-15 (Asia/Seoul), read-only apart from this review and its offline log. No build, actual/OS termination, provider, Electron, local-8085, or network operation was run.

## Pins

| Path | SHA-256 |
|---|---|
| `daemon/test/fixtures/integration-public-driver-startup-crash-child.mjs` | `ab8e5095fe8b1a829248f0e6482f322c49f092934c4a90bb8fc42cf41267818f` |
| `daemon/test/integration-public-driver-startup-restart.test.ts` | `39d992fc5544213ab83cb7fb99ab21776281c5b989763306bd4e979e922ae528` |

## Blocking findings

1. **The raw frame buffer is still allowed to exceed 64 KiB before rejection.** In `JsonFrames.onData` at test line 14, `Buffer.concat([this.pending,bytes])` allocates and retains the entire incoming chunk before either the per-frame or pending-length check runs. The unit test sends one 65,537-byte chunk and proves eventual rejection, but it also demonstrates that the cap is crossed before rejection. This does not clear the prior requirement that byte bounding precede newline framing/allocation. Consume a bounded slice or reject from `pending.length + bytes.length` before concatenating; account for newlines without ever materializing an over-limit pending frame.

2. **A valid final frame can be discarded by normal EOF/close.** `onEnd` calls `fail`, and `fail` clears `queue`. The restart fixture emits its sole `restart` frame and exits. If stdout data queues that frame before the parent calls `next`, the subsequent EOF clears it and `next` reports `public_driver_restart_frame_eof`. The same race exists for process `close`. EOF safety requires preserving already-completed queued frames and returning them before the terminal EOF, while still rejecting incomplete trailing bytes. Add a test that writes a valid JSON frame, ends the stream, and only then calls `next`.

3. **A spawn error can be unhandled during identity observation.** `closedOf` only registers `close`; `JsonFrames`, which supplies the first child `error` listener, is not constructed until after `observeIdentity` succeeds. A child-process `error` emitted between `spawn` and that point can therefore become an uncaught EventEmitter error and abort the runner, despite the child already being registered. Register an error promise/listener at spawn, race it with observation/handshake, and retain its diagnostic in the child receipt. The existing timeout/cleanup path is not a substitute for an error listener.

## Findings cleared by the correction

- Children and their close promises are registered before identity observation. Handshake close/EOF has a bounded failure path, and all explicit close waits use `within(..., 10_000, ...)`.
- Exact termination forwards both `identity.pid` and `identity.createdAt` to `terminateVerifiedTree`.
- Cleanup writes a before-delete JSON receipt outside the owned scenario root, retains the root on uncertainty, verifies the exact root shape, aggregates failures, and attempts a final complete receipt even after earlier failure.
- The restart process calls `ownDaemonWorktree` before constructing its public driver. The public `start` signature accepts either an `OrchestrationRun` or a run ID string, so `driver.start('workflow')` is a valid public call. With no in-memory preparation in the new driver it is expected to refuse with `driver_prepare_missing`; the fixture records zero candidate launches, publication authorizations, resends, replacement attempts, results, receipts, and acceptances.
- The `session_handle` row is limited to the observed fixture controller/execution process PID and creation time. It is needed because the real public-driver launch records that durable reference as the attempt identity; it does not claim a provider session.
- Launch/task limits are 30,000/120,000 ms.

## Offline evidence

- `node --check test/fixtures/integration-public-driver-startup-crash-child.mjs`: exit 0.
- `npm exec -- tsc -p tsconfig.json --noEmit`: exit 0.
- `npm exec -- vitest run test/integration-public-driver-startup-restart.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`: exit 0; 1 passed, 1 environment-gated skipped.

The actual gate requires an absolute cleanup file outside the scenario root, with an existing parent directory:

`CUE_PUBLIC_DRIVER_RESTART_CLEANUP_RECORD=<absolute-path-outside-the-cue-public-driver-restart-* root>`

After the three blockers are corrected and repinned, rerun independent preflight. **CLEAR is not issued at these pins.**
