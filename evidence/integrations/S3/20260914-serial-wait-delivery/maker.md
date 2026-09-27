# Maker evidence — serial wait-response delivery after failure

## Finding and correction

The preimage's post-claim delivery guard covered `entry.cancelled`, driver closing, retained parallel cancellation controls, handle presence, and host support. Serial task timeout and execution-error paths call `cancelActive` with an ephemeral fallback item, leaving `entry.request` and `entry.handle` retained while `entry.cancelled` remains false. The pre-fix focused reproduction therefore invoked the host and returned `delivered-observed` after the durable root task was already blocked by timeout.

The candidate adds one durable-state check after `store.claimWaitResponse`: it reads the exact prepared run's root task through `entry.run.taskId` and permits a new host invocation only while that row is `running`. This is also after any synchronous claim-authority callback. The existing recovery path explicitly restores the root task from `blocked` to `running` when an approved recovery is applied, so the fence does not reject the established active recovery flow. No attempt map, lifecycle field, durable-reference API, receipt, observation, or replay rule changed.

## Tests

Two tests were added:

- Serial task timeout with `finish=false`, `cleanup=false`, and a held runtime proves the exact attempt stays unresolved, its 10-unit reservation remains, a valid wait response commits its claim, host delivery remains zero, no observation is fabricated, and replay stays `blocked-unresolved`.
- Serial receipt-path exception with unknown cleanup proves the same facts under `orchestration_execution_failed`.

Existing successful serial and parallel delivery, synchronous stop, delayed acknowledgement after a begun send, historical replay, parallel timeout/cancellation, and automatic recovery tests remain in the required gate.

## Execution ledger

1. Pre-fix reproduction: exit **1**. Actual result was `delivered-observed` where `blocked-unresolved` was required. Raw first-run output: `logs/reproduction-prefx.log`; exit: `logs/reproduction-prefx-exit.txt`.
2. Implementation revision 1 build: exit **0**. Raw output: `logs/pass1-build.log`; exit: `logs/pass1-build-exit.txt`.
3. Implementation revision 1 focused gate: exit **0**, **4 files passed, 75 tests passed** (73 baseline plus 2 new). Raw output: `logs/pass1-tests.log`; exit: `logs/pass1-tests-exit.txt`.

The implementation cap was 2 revisions; 1 was used. No unchanged rerun or second revision was needed.

## Scope and limitations

This is deterministic driver/SQLite fixture evidence. It does not qualify live providers, native/Electron behavior, local models, restart/resume behavior, or external delivery infrastructure. Approved recovery remains protected by the existing full focused regression gate; this unit does not add a separate recovery-time wait-delivery scenario.
