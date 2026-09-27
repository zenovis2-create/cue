# A03 targeted Stop completion-fence correction

Recorded before editing `daemon/test/integration-driver-targeted-stop.test.ts`.

## Goal

Close the concrete A03 harness synchronization gap with source-bound offline evidence and one separately coordinated actual receipt. Completion requires the measurable done surface below; a green assertion based only on cancellation entry is not completion.

## Trigger

Root assigned this corrective unit after independent review found actual attempt 2 waited for a request counter rather than termination completion. Input is the pinned test preimage `09E7E5BE38CF0F82B83A098618D500D9A5B45A52AA7565D45746C6E0468C5080`; preconditions are no product edits, preserved prior failures, independent exploration review, and root coordination before actual execution.

- Type: manual bounded correction.

## State

Durable evidence is the full test preimage, raw command logs, exit files, raw JSON frames, maker record, and final SHA-256 pins in this directory. Transient state is the two fixture process trees and their heartbeat files. The idempotency key is the corrective unit plus attempt ID; the single actual attempt is never replayed or renamed. Recovery cleans only exact observed PID/creation pairs and canonical fixture roots. Completion markers are per-attempt cancellation-completed facts backed by termination, close, and absence observation.

- Durable state: test/preimage hashes, raw logs, exits, JSON frames, maker record, and final pins.
- Replay inputs: pinned test source, exact filtered test name, exact typecheck command, platform, and root-issued actual-attempt coordination.

## Tools

| Tool | Purpose | Success signal | Failure signal | Timeout/retry |
|---|---|---|---|---|
| Vitest filtered preflight | Exercise delayed cancellation without OS children | focused test exit 0 with completion held until both deferred gates | nonzero or early completion | bounded test timeout; max 2 changed revisions |
| TypeScript compiler | Validate harness types | exit 0 | nonzero | once per revision |
| Windows Vitest actual | Exercise public Stop with two exact trees | exit 0 plus raw identity/absence/sibling frames | any nonzero, missing frame, surviving identity, or cleanup error | one root-coordinated attempt only |
| SHA-256 | Bind source, preimage, and evidence | all pins match | any mismatch | no mutation/retry without diagnosis |

## Safety Gates

| Gate | Blocks when | Recovery |
|---|---|---|
| Scope | product/driver or unrelated file would change | stop; confine edits to owned test/evidence |
| Identity | PID lacks matching creation time or tree attribution changes | do not kill or claim absence |
| Completion | terminate, child close, or exact-absence check is pending | keep cancellation incomplete |
| Sibling isolation | sibling identity or heartbeat changes before its own Stop | fail and preserve raw frames |
| Budget | offline revisions exceed 2 or coordinated actual exceeds 1 | stop and hand evidence to root |
| Cleanup | canonical root containment or exact process cleanup is uncertain | preserve/quarantine; never report clean |

## Observe-Decide Rules

- Done when all measurable-done facts have current source-bound evidence and no surviving exact owned identity.
- Pass offline only when the delayed observer proves completion stays false before termination and close, then becomes true after both.
- Pass actual only when target original identities are absent, sibling original identities and heartbeat remain live before sibling Stop, then sibling identities are absent after its own completed cancellation.
- Retry when an offline failure has a changed source-based hypothesis and the two-revision cap remains.
- Replan when two offline revisions are spent or an API assumption is false; preserve evidence and return the unresolved item to root.
- Escalate when root coordination or independent approval for the sole actual attempt is missing.
- Quarantine when any process identity is unattributed or survives; retain failure evidence and clean only through the exact observed identity path.
- Do not retry the actual gate; preserve any failure for root review.
- A cancellation request, taskkill return, process name scan, or final cleanup alone cannot satisfy done.

## Telemetry

Synchronous JSON lines include phase, run/attempt identity, controller and grandchild PID/creation pairs, heartbeat sizes, cancellation requested/completed state, and exact after observations. Full stdout/stderr and exit status are retained on every first command execution. Final evidence records source/preimage/log hashes, used budgets, and limitations without treating cancellation as billing or provider truth.

- Required logs: full stdout/stderr and exit status. Required fields: phase, runId, attemptId, PID, createdAt, heartbeat size, request count, completion IDs, and exact remaining identities.
- Artifacts: PLAN, full preimage, maker record, raw logs/exits, review, and final pins.
- Operator report: pass/fail/unverified, budgets used, cleanup result, limitations, and exact next action.
- Metrics: offline revisions, actual attempts, cancellation requests/completions, original identities remaining, and heartbeat delta.
- Trace: `unit=A03-targeted-stop`, revision, attempt, phase, status, and evidence path.
- Operating budget: two offline revisions and one separately coordinated actual attempt.

## Verification

Offline: filtered controlled-delay Vitest plus daemon typecheck on every implementation revision. Actual: one root-coordinated Windows run after independent exploration review. Final: inspect preimage diff, parse every emitted JSON line, verify raw exit files, and recompute all SHA-256 pins.

- Unit checks: controlled delayed termination/close completion fence.
- Integration checks: public driver Stop with two concurrent fixture runs.
- Dry run: filtered Vitest executes only the no-OS delayed observer.
- Live canary: the one coordinated Windows child-process-tree test; no provider/model/native application.
- Scorecard: `python C:/Users/User/.agents/skills/loop-engineering/scripts/score_loop_contract.py <PLAN>`; document score is not runtime proof.

## Measurable done

The corrected harness must preserve exact before identities for both process trees, count cancellation requests separately from per-attempt completed cancellation, register child close before termination, await termination even if its API becomes asynchronous, boundedly prove every original target PID/creation pair absent, and then prove the sibling's original PID/creation pairs and heartbeat remain live before stopping it. Raw JSON identity and observation frames must be synchronously emitted before assertions and final cleanup so a failed actual run remains independently inspectable.

A platform-independent preflight must use a controlled delayed termination/close observer to prove completion cannot be signalled at request entry or before both termination and close have completed. No product or driver source may change.

False done includes a cancellation-request counter reaching one while termination is still pending, taskkill exit without exact identity absence, a later name-filtered cleanup observation, or sibling liveness inferred without matching creation times and heartbeat advancement.

## Attempt caps

- Offline implementation revisions: at most **2**.
- Corrective actual Windows OS execution: at most **1**, separately coordinated by root after independent exploration review and the concurrent UI actual run.
- The two prior failed actual attempts remain preserved and are not renamed, overwritten, or counted as success.

## Every offline implementation pass

Capture full stdout/stderr and exit code for the targeted test in a platform-neutral mode that runs only the controlled delayed-cancellation preflight, then run TypeScript typecheck. A failed pass is retried only after a changed source-based hypothesis. Keep a revision only if the measured gates improve and existing meaningful assertions remain.

## Actual gate

Only after root coordination and independent exploration approval, capture the full Windows targeted test stdout/stderr and exit code on its first and only corrective actual execution. The log must contain the raw JSON before identities and final per-tree observations even if an assertion or cleanup fails.

## State, recovery, and quarantine

Cancellation request and completion are distinct per-attempt facts. Completion is set only after verified termination, child close, and exact original identity absence. Cleanup retains the existing canonical temporary-root checks and exact identity verification. Any unknown identity, timeout, cleanup failure, or surviving exact PID/creation pair is failure evidence and cannot become clean, completed, or billing evidence.

## Scope

Owned source is only `daemon/test/integration-driver-targeted-stop.test.ts`; owned evidence is this directory. No product/driver edit, commit, push, network, provider/model call, Electron/native application run, or uncoordinated actual OS attempt is allowed.
