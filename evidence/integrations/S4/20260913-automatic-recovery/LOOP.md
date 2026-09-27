# Loop: approved automatic recovery

Status: implementation contract; production behavior unverified until independent gates pass.
Owner: root coordinator, Sol maker, separate Sol checker. Last reviewed: 2026-09-13.

## Goal

An explicitly configured active driver may continue an approved retry or switch after a verified failed receipt without an external recover/start call. Done means the actual driver with real SQLite stores records a derived decision and exactly one replacement activation, passes the focused integration gate and daemon build, and receives an independent review of final file hashes. A passing policy predicate alone, a generated self-report, or an injected runtime is not proof of actual provider execution.

## Trigger

Trigger: event-driven failed terminal receipt in the currently owned drive loop. Input: run ID, exact attempt/receipt IDs, active revision/digest, and immutable prepare-time recoveryMode automatic-approved. Omission/manual preserves current behavior. Automatic mode requires the existing approved retry contract, bound requirements and trusted recovery observations. Record the mode in the frozen preapproval summary; do not infer mode from a caller failure message. Existing candidate authorization, cleanup, handoff, held/change checks, approval expiry, attempt caps and cumulative budget remain mandatory.

Type: event-driven. Preconditions: preparation and approval precede activation, the terminal receipt belongs to the current owned attempt, and trusted observations are available. A cold ledger reopen is not this trigger.

## State

Durable state: existing failure observations, recovery decisions/activations, plan revisions, attempt/receipt lineage and budget reservations. Stable decision IDs derive from run/attempt/receipt/active revision. Exact replay must not create another activation or launch. Transient state: active promise, request/handle, pending recovery and quota not-before time. Automatic continuation must preserve the active promise; public manual recovery semantics remain compatible. Completion marker remains the existing independently verified acceptance state, not successful recovery alone. Reopening a ledger does not automatically resume writes or replay provider calls.

Idempotency key: the deterministic decision ID above, backed by the store's observation and activation uniqueness checks. Replay inputs: original run, exact prior attempt/receipt, revision/digest and persisted decision; replay supplies no new authority or provider call.

## Tools

The driver consumes trusted host failure observations and the existing recovery store; it never asks a model to invent recovery facts or a plan. Existing bounded reconcile calls, poll delay, absolute approved deadline, launch/task timeouts, owned cancellation and sealed runtime launch gates apply. Quota retry waits until the recorded reset while remaining cancellable and deadline-bounded. No extra monetary reservation authority is introduced.

| Tool | Purpose | Success signal | Failure signal | Timeout | Retryable? |
|---|---|---|---|---|---|
| handle.reconcile | Read exact attempt terminal receipt | Verified persisted receipt | Missing/unknown receipt | Existing bounded launch/task deadline | Only within existing poll/deadline |
| recovery.observeFailure / recordDecision | Derive approved action | Integrity-bound decision row | Corrupt/stale facts or sealed scope | Synchronous, followed by deadline fence | Exact replay only |
| engine.start | Claim, reserve, bind and launch replacement | One activation plus owned runtime start | Admission throw or denied/uncertain launch | Existing approved deadline and launch timeout | Only newly derived approved decision |

## Safety Gates

| Gate | Blocking condition | Recovery action |
|---|---|---|
| Schema | Unknown mode or automatic mode without retry contract, requirements or trusted host | Reject preparation before persistence |
| Scope/permission | Candidate or action outside bound approval | Persist stop/block; never broaden scope |
| Budget | Final attempt/deadline/cumulative reservation limit exceeded | Keep history, reject replacement admission |
| Quarantine | Held state, unknown cleanup, unsafe changes or uncertain effects | Retain evidence/ownership; no automatic replacement |
| Cancellation | Stop, close or deadline crossed during callbacks | Block pending mutation and preserve final launch fence |

## Observe-Decide Rules

Retry/switch: derive through the same observeFailure/recordDecision path as manual recovery, then continue the current loop. Stop: retain the sealed decision and block further work. Replan: retain the decision and block pending an explicit validated plan; do not fabricate one. Recheck cancellation, close and deadline after callbacks before mutating pending state, and retain the final runtime launch fence. Missing host observations cannot enable default generated-JSON automatic recovery.

- Done when the focused real-driver gate, build and independent final-hash review pass; workflow completion still requires acceptance.
- Retry when a fresh derived retry/switch decision is approved and final admission remains within bounds.
- Replan when the decision requires a new plan; pause this run until the explicit plan is validated.
- Escalate when trusted observations or a required plan are unavailable: expose blocked status instead of inventing either.
- Quarantine when held/identity/cleanup/effect evidence is uncertain: keep durable state and prohibit replacement.

## Telemetry

Existing run/task/attempt/receipt IDs, decision action/reason/digest, revision, candidate, activation, budget state and block reason are the trace. Record test commands, exit codes, passed/failed counts, file hashes and correction history in maker/review evidence here. Report synthetic runtime boundaries and unknown billing honestly; no new UI or external logging channel is required for this bounded unit.

Operator report: completed checks, blocked or unverified scenarios, rollback status, and next action. Metrics are persisted attempt/activation counts and test pass/fail counts; timing and retries remain bounded by the existing driver limits. Evidence artifacts are the maker command receipts, independent review, and final hashes.

Required logs/trace fields: run ID, stage/task ID, attempt ID, decision ID, action/reason, revision, result, and evidence reference, as already represented in the ledger and test receipts.

## Budgets and Stop Conditions

Implementation cap: two diagnosed correction passes, then change approach or hand off with exact failures. Each pass runs the combined command below. Keep existing native/model/live one-shot caps closed. Root performs one final shared build after source freeze. Restore only this unit's edits to its recorded pre-edit snapshot if an unrelated invariant regresses; preserve all existing dirty work. No fixture failure is completion or grounds to disable a gate.

## Verification

From daemon: npm exec vitest run -- test/integration-driver.test.ts test/integration-recovery-policy.test.ts test/integration-held-recovery-admission.test.ts test/integration-held-retry-admission.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1

Exercise actual driver automatic retry/switch, quota delay, stop, deferred replan, cancellation, caps/deadline, and held/unsafe-evidence denial, plus manual/missing-host controls. Assert persisted decision/activation and launch counts with real SQLite and injected runtime boundaries. Final build: npm run build from daemon, exit 0. Live canary: N/A for this unit; default host lacks trusted recovery observations and prior live caps remain consumed. No native/provider/model call is permitted.

Unit checks remain the existing recovery-policy and held-store regression suites. Integration checks are the actual driver/store scenarios above. Their injected runtime is the isolated dry run; it supplies no real provider qualification evidence.

Document scorecard is a gap checklist, not a runtime completion gate: python C:/Users/User/.agents/skills/loop-engineering/scripts/score_loop_contract.py evidence/integrations/S4/20260913-automatic-recovery/LOOP.md

## Run Ledger

Revision 0: read-only discovery found failed receipts with host.recovery fall through to blocked state; only tests manually call driver.recover. No source edits or runtime evidence yet. Next: independent contract assessment and bounded implementation, followed by checker-owned verification.
