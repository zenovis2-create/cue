# Independent preflight review — public-driver startup restart

Verdict: **BLOCKED — do not run the actual OS/process-termination gate at these source pins.**

Reviewed at repository HEAD `8e2afa6366e3af62f7115b2c67be799130f8dfdf` on 2026-09-15 (Asia/Seoul). This was a read-only source review plus offline syntax/mocked-test validation. No build, OS termination, provider, Electron, local-8085, or network probe was run.

## Pins

| Path | SHA-256 |
|---|---|
| `daemon/test/fixtures/integration-public-driver-startup-crash-child.mjs` | `229319fef9fd9810bb8a151e0d974d1d687aeb3eaa71fbaeaa6608f399dfc97a` |
| `daemon/test/integration-public-driver-startup-restart.test.ts` | `54d978e1473189039fa0a82439241ca119912434d175e4050100aeb679a3c002` |
| `app/orchestration-driver.mjs` | `2ed110d994e22910cd9b95deaf5d7a0167c033165c6a41cd7512221277a050f0` |
| `daemon/src/daemon-ownership.ts` | `f65e24dc1b423741d68b36fcf0d88e16f03807c31bc9e7046a2c51a4723618df` |
| `daemon/src/journal-recovery.ts` | `e909c595748bc741bc41cbaaf24df1e4c8ae3bec47ab018720616beffad9069a` |
| `daemon/src/recovery.ts` | `8a0b44def84161f4269bb2b978457254ab66a04790499d6436cfb7512f32b6a8` |

## Blocking findings

1. **The frame reader is not bounded in memory.** At `integration-public-driver-startup-restart.test.ts:15`, `createInterface()` owns framing and emits `line` only after it has accumulated the complete line. The 64 KiB check therefore happens after an unterminated or oversized frame has already been buffered. The `queue` is also unbounded, so a producer can enqueue unlimited valid-size frames. The test at line 22 only proves rejection after a newline and does not cover an unterminated oversized frame or queue growth. This does not satisfy the required bounded frame-reader gate.

2. **Cleanup has no durable JSON record.** At `integration-public-driver-startup-restart.test.ts:20`, cleanup first calls `rmSync`, verifies absence, and then writes JSON to process stdout. Stdout is not a durable cleanup artifact owned by the scenario, and the record is emitted after deletion. A runner interruption or output loss leaves no durable JSON result. This does not satisfy the required aggregate exact cleanup with durable JSON gate (and contradicts `PLAN.md`, which says the durable cleanup record is written before deletion).

3. **An identity-observation failure can leave an untracked live child.** At line 19, `startOwned` spawns the child and creates its close promise, but does not add it to `children` until after `observeIdentity` succeeds. The catch only sets `root.retain=true` and rethrows. If observation times out or throws while the child remains live, `afterEach` has no child reference to terminate. Retaining the root does not make the process cleanup exact.

4. **Close waits have no independent deadline.** `closeExact` awaits `closed` without a timeout, and the success path likewise awaits `secondOwned.closed` without a timeout. Vitest's test/afterEach timeouts can reject the hook or test but do not cancel an already-running awaited promise or prove child closure. Every process-close wait needs its own bounded rejection so cleanup can aggregate the failure and retain evidence.

5. **The verified creation identity is not bound into the termination helper.** `closeExact` observes and compares `createdAt`, then calls `terminateVerifiedTree(identity.pid)` without its available `identity.createdAt`. The production helper now accepts `expectedCreatedAt`; omitting it re-opens a check/use window in which a recycled PID could be targeted. Pass the expected creation identity to the helper. Because `process-termination.ts` was changing concurrently and is outside this reviewer's ownership, its implementation must be repinned with the revised harness review.

These are preflight blockers because the actual run would use the defective harness paths. Fix all five and obtain a new review at new source pins before enabling `CUE_ACTUAL_PUBLIC_DRIVER_RESTART=1`.

## Clear findings

- The first child calls the actual exported `createOrchestrationDriver`, then `prepare`, records approval, calls `activate`, and awaits `start`. Publication reaches the production publication store and invokes `compareWriteExistingNative`; the effect frame observes one durable intent, zero durable results, committed bytes, and then blocks before `execute` returns. The direct SQL creates prerequisite root/run/approval records but does not synthesize attempt, change-set, publication, held-recovery, or restart lineage.
- The restart child is a distinct process and calls `ownDaemonWorktree(worktree, databasePath, db)` before constructing/snapshotting its driver. Production ownership acquisition calls hold, fence, cleanup, and reconcile; assertions require the original attempt and root to be blocked, a hash-valid held row and transition to exist, the writer lease and changed bytes to remain, and launch/authorize/execute/replacement/result/receipt/acceptance counters to remain zero.
- `LOCALAPPDATA` is a sibling (`<temp-root>/local-app-data`) of the owned worktree (`<temp-root>/worktree`), so ownership storage is isolated from user state and outside the owned worktree.
- The parent observes PID plus creation time, compares both to the child's self-observation, and sends `continue` only after the exact match. The child performs no database open, ownership acquisition, or orchestration effect before that command.
- For children that reach successful identity observation, close promises are registered at spawn and before handshake/continue. Root cleanup validates canonical location, expected basename, and non-symlink status, retains uncertain roots, and aggregates the failures it receives.
- Identity and frame/test timeouts are finite and broadly realistic for the intended local Windows gate: 10 s identity/handshake, 60 s frame waits, 120 s scenario, and 30 s cleanup. The fixture's 120 s stall is not relied upon as success because the parent intends to terminate immediately after the effect frame. The missing close-promise deadlines remain a blocker above.

## Offline validation

- `node --check test/fixtures/integration-public-driver-startup-crash-child.mjs` from `daemon`: exit 0.
- `npm exec -- vitest run test/integration-public-driver-startup-restart.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` from `daemon`: exit 0; bounded-reader unit test passed; actual environment-gated test skipped.

The offline pass does not clear the blockers: its oversized-frame case includes a newline, and it does not exercise the process-lifecycle or durable-cleanup failure paths.
