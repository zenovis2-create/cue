# A03 targeted Stop actual-fixture lifetime correction

Recorded before editing the independently cleared completion-fence candidate.

## Goal

Done when the Windows fixture preserves both active run owners through real identity discovery, emits and asserts a pre-Stop `running` snapshot with zero cancellation requests/completions, and then exercises the already reviewed completion fence. False done includes automatic task/deadline expiry before public Stop, cleanup-only identity absence, or any product timeout change.

## Trigger

- Type: manual bounded correction authorized by root after corrective actual 1 failed at `stop(runId) === false` before entering cancellation.
- Input: test source SHA-256 `EE2E7682D28D616D438127C7130D7C22F268D55B1D5C75DE91AA628A79EEDA6A`, actual-1 raw log/exit, and current driver timeout bounds.
- Preconditions: preserve all prior failed receipts; edit only the owned test/evidence; independent review before actual execution; root coordination after UI activity.

## State

- Durable state: full test preimage, raw logs/exits, JSON frames, review, maker record, and SHA-256 pins.
- Transient state: two exact fixture process trees and heartbeat files.
- Idempotency key: A03 lifetime-correction plus revision/actual attempt; no attempt is replayed or renamed.
- Replay inputs: pinned source, exact filtered preflight/typecheck/actual commands, platform, and root coordination message.
- Completion marker: active pre-Stop root snapshots followed by per-attempt termination/close/exact-absence completion.

## Tools

| Tool | Purpose | Success signal | Failure signal | Timeout/retry |
|---|---|---|---|---|
| Filtered Vitest | no-OS completion-fence preflight | one pass, actual skipped | nonzero/early completion | max two changed offline revisions |
| `tsc --noEmit` | validate test types | exit 0 | nonzero | every revision |
| Windows Vitest actual | public targeted Stop with two real trees | exit 0 plus all raw frames | nonzero/missing frame/cleanup error | one coordinated attempt |
| SHA-256 | bind source/product/evidence | all pins match | mismatch | no blind retry |

## Safety Gates

| Gate | Blocks when | Recovery |
|---|---|---|
| Product scope | driver/runtime/product timeout would change | stop; fixture-only constants |
| Lifetime | pre-Stop snapshot is not `running` or cancellation count is nonzero | fail before interpreting Stop |
| Identity | PID/creation pair changes or is absent before its intended Stop | fail closed |
| Isolation | sibling heartbeat or exact identities do not survive target Stop | preserve evidence; no pass |
| Billing | cancellation/cleanup is used to infer provider billing | retain unknown/no claim |
| Budget | offline revisions exceed 2 or actual exceeds 1 | stop and hand off |
| Cleanup | canonical root or exact identity cleanup is uncertain | quarantine and retain failure |

## Observe-Decide Rules

- Done when all measurable facts have current source-bound evidence and the sole actual exits 0.
- Retry when an offline failure has a changed source hypothesis and budget remains.
- Replan when two offline revisions are spent or the timing hypothesis is false.
- Escalate when independent approval/root coordination is missing.
- Quarantine when exact process identity or canonical cleanup cannot be verified.
- The changed fixture windows are bounded: policy/task 120,000 ms, launch 30,000 ms, envelope 180,000 ms; they do not claim product latency.

## Telemetry

- Required logs: complete stdout/stderr and exit for every first command execution.
- Required fields: phase, runId, attemptId, task snapshot, request/completion counts, PID, createdAt, heartbeat, and exact remaining identities.
- Artifacts: PLAN, preimage, logs/exits, maker, independent review, actual receipt, and final pins.
- Operator report: hypothesis, revisions, result, cleanup, limitations, and next action.
- Metrics: offline revisions, actual attempts, timing windows, cancellation requests/completions, heartbeat delta, remaining identities.
- Trace: `unit=A03-targeted-stop-lifetime`, revision, attempt, phase, status, evidence path.

## Verification

- Unit checks: controlled delayed termination/close fence.
- Integration checks: public driver Stop against two concurrent actual Windows fixture trees.
- Dry run: filtered test that excludes the OS case plus TypeScript no-emit.
- Live canary: one root-coordinated local Windows child-process test; no provider/model/native application.
- Scorecard: loop contract score 100 is required but does not replace runtime evidence.

## Attempt caps and failure rule

At most two offline implementation revisions and one new actual execution. Every offline revision runs the filtered preflight and `npx tsc -p tsconfig.json --noEmit`, with full output and exit capture. A failure retries only after a new hypothesis. The actual is never automatically retried.
