# Readonly launcher lifecycle discovery

## Done contract

- Deliverable: one source-supported, executable plan for the smallest post-ACL launcher hang/authority defect. No production or test implementation in this unit.
- Attempt cap: 2 plan passes.
- Every pass: re-read `daemon/src/readonly-verifier-worker.ts` lines 46-54 and verify the proposed negative test reaches the real worker through mocked `spawnOwned` without exercising the completed ACL matrix.
- Failure handling: revise only for a new source-supported hypothesis; otherwise return the unresolved evidence to the root agent.

## Finding

The verifier launcher can hang indefinitely after its deadline. In `daemon/src/readonly-verifier-worker.ts:47`, the emergency timer only calls `launched.child.kill()`. Line 50 awaits a Promise resolved exclusively by the child's `close` event. Node does not make `kill()` itself a completion signal, so a child or mock that accepts the kill request but never emits `close` leaves `launch()` pending forever. The pending call never reaches lines 51-54, which remove the runtime directory, observe process death/root state, and return a fail-closed result. A child `error` event after spawn has the same close-only gap.

This is the smallest material defect in the inspected post-ACL lifecycle because it prevents bounded settlement and prevents any authority result at all. PID-frame parsing remains fail-closed: without a completed lifecycle and verified cleanup, lines 51-52 cannot persist identity or cleanup receipts. The existing CRLF parser and bootstrap LF coverage do not address missing `close`.

## Bounded fix plan

1. Replace the close-only wait at lines 47-50 with one guarded launcher-finalization state shared by `close`, `error`, abort, stdout/stderr overflow, and the fixed `command.timeoutMs + 15000` emergency trigger.
2. On abort, overflow, error with an owned PID, or emergency, request `terminateVerifiedTree(launched.child.pid)` and retain an explicit unverified failure if termination verification throws. Lock failure before termination so synchronous late `close(0)` cannot win.
3. Settle the lifecycle as failed after the bounded termination operation even when `close` never arrives. Clear the timer and remove the abort listener exactly once. Late data/error/close events must be inert.
4. Treat absent stdin or synchronous/asynchronous stdin failure as launcher failure: terminate the owned launcher, remove only the owned runtime directory, and never persist identity or cleanup authority.
5. Keep the current success requirements unchanged: exit code zero, exact PID/created-time frame, independently absent worker process, one valid cleanup frame, restored root identity, absent runtime/profile, and current control digest.

The five-second ACL observation deadline is unrelated and must remain unchanged. This launcher deadline is the already configured command timeout plus its existing 15-second cleanup allowance; synchronous verified termination has its own bounded observation time.

## Concrete RED test

Add a focused mocked-coordinator case beside `integration-readonly-verifier-bootstrap.test.ts`:

- First mocked spawn returns valid ACL output and `close(0)`.
- Second mocked spawn captures the exact `-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command -` arguments and bootstrap input, has an owned PID, and never emits `close`.
- Use fake timers; advance to one millisecond before `command.timeoutMs + 15000` and assert the launch remains pending and termination was not requested. Advance one millisecond and assert verified termination is requested, the launch settles failed without a clean receipt, the runtime is removed, and identity/cleanup writers remain unused.
- Emit late PID/cleanup data and `close(0)` after settlement; assert they cannot change the failed result or write authority.
- Add adjacent cases for post-spawn `error` without `close` and stdin failure, each asserting verified termination and null authority.

Expected RED baseline on current source: the missing-close case remains pending after the emergency timer because only `close` resolves line 50.

Run from `daemon`:

`npx vitest run test/integration-readonly-verifier-launch-lifecycle.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`

## Out of scope

- The completed ACL timeout/cancellation/output-limit matrix.
- Acceptance Unit B or any checker truth decision.
- Native execution, helper invocation, model/provider calls, schema changes, or public API additions.
