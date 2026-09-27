# Automatic approved recovery maker status

Status: INCOMPLETE after the two-pass cap.

The production draft adds an immutable `manual | automatic-approved` preparation mode, shared manual/automatic recovery authority derivation, deterministic receipt-bound decision IDs, automatic retry/switch/quota scheduling, deferred explicit replan continuation, stop handling, reentrancy/cancellation/deadline fences, and monotonic-deadline preservation. It does not add a default production recovery observer.

Combined gate from `daemon/`:

`npm exec vitest run -- test/integration-driver.test.ts test/integration-recovery-policy.test.ts test/integration-held-recovery-admission.test.ts test/integration-recovery-claim-limits.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`

- Pass 1: 58/59 passed. The replan continuation test spread the display-only `action` field into the strict public recovery input and correctly received `driver_recovery_fields`.
- Pass 2: 60/61 passed. The new 30ms preserved-deadline fixture expired during the initial failed attempt before automatic replan persisted, so `snapshot().recovery` was null and the test raised `Cannot read properties of null (reading 'decisionId')`.

No final PASS is claimed. The next source-supported test hypothesis is to allow a substantially larger original deadline for initial failure/replan persistence, then wait beyond that already-armed deadline before explicit continuation. No third edit or test was made. No native helper, model/provider, live workflow, production default observation, or build ran.
