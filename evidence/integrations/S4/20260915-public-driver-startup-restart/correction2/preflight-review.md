# Independent correction-2 preflight — public-driver startup restart

Verdict: **CLEAR for the root's one actual OS/process-termination gate at the pins below.**

Reviewed 2026-09-15 (Asia/Seoul). This checker performed source review and offline validation only. No build, actual/OS termination, provider, Electron, local-8085, or network operation was run.

## Pins

| Path | SHA-256 |
|---|---|
| `daemon/test/fixtures/integration-public-driver-startup-crash-child.mjs` | `ab8e5095fe8b1a829248f0e6482f322c49f092934c4a90bb8fc42cf41267818f` |
| `daemon/test/integration-public-driver-startup-restart.test.ts` | `2913bb04bb33724f473899819ac636bc4b47502b61e0b9c357e3267187ea8d46` |

## Cleared findings

- `JsonFrames` scans the incoming chunk for newline boundaries and checks `pending.length + segment.length` before `Buffer.concat`. It therefore never materializes an unterminated frame over 64 KiB. Completed-frame queue growth remains capped at 16.
- Malformed/oversized/overflow input discards queued frames, while clean EOF or lifecycle close preserves completed frames. `next()` drains those frames before returning the stored terminal error. The focused test covers both stream EOF and lifecycle-close races after valid frames were produced.
- A permanent child `error` listener is registered immediately after `spawn`, before identity observation. It marks the root retained, records the receipt diagnostic, prevents later errors from becoming unhandled, and its first error is raced against identity observation and handshake.
- Children and close promises are registered before observation. Handshake EOF and all child-close waits are bounded.
- Exact termination passes PID and expected creation time. Cleanup writes durable before/complete JSON outside the owned root, retains uncertain roots, validates the exact root, and aggregates failures.
- The restart child acquires `ownDaemonWorktree` before creating the public driver. `driver.start('workflow')` uses the declared public string overload and correctly refuses absent in-memory preparation with `driver_prepare_missing`. Assertions require zero relaunch, authorization, resend, replacement attempt, result, receipt, and acceptance effects.
- `session_handle` identifies only the observed fixture controller/execution process using its PID and creation time. It does not claim provider identity. Launch/task limits remain 30,000/120,000 ms.

## Offline evidence

- `node --check test/fixtures/integration-public-driver-startup-crash-child.mjs`: exit 0.
- `npm exec -- vitest run test/integration-public-driver-startup-restart.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`: exit 0; 3 passed, 1 actual-gated skipped.
- `npm exec -- tsc -p tsconfig.json --noEmit --pretty false`: exit 0 on the independent recheck. The earlier recorded exit 2 was transient and attributed to a concurrently edited unowned test; it is no longer a blocker.

For the one actual run, set an absolute cleanup receipt path whose parent already exists and which is outside the scenario root:

`CUE_PUBLIC_DRIVER_RESTART_CLEANUP_RECORD=<absolute-path-outside-the-cue-public-driver-restart-* root>`

Also set `CUE_ACTUAL_PUBLIC_DRIVER_RESTART=1` only for that bounded actual command. **CLEAR applies only while both pinned files remain unchanged.**
