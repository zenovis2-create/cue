# Independent checker review — serial wait delivery fence

## Preimage finding

The production preimage has a real serial-only gap. `cancelActive(entry)` builds a temporary fallback item for `entry.request` / `entry.handle` when the serial attempt is absent from `entry.activeAttempts`. The cancellation promise is assigned only to that temporary item's `control`. It is not retained on the entry. In contrast, parallel attempts are durable for the lifetime of the prepared entry because their item (including `control`) remains in `entry.activeAttempts`.

After a serial task timeout or an exception, `drive()` blocks the durable root task and calls `cancelActive(entry)`, but it does not set `entry.cancelled`. If cancel/reconcile cannot prove settlement, the attempt can remain `running` with unknown ownership. The current `deliverWaitResponse()` admission checks `entry.cancelled`, `closing`, and only `active?.control`; therefore the serial fallback has no control marker to consult. Because `entry.handle` remains present, a newly committed response claim can reach `host.deliverWaitResponse()` for that unresolved serial handle.

This is narrower than a generic per-attempt control-state problem. The safety fact already persisted for both timeout and execution-error paths is the exact run's root task state: the driver changes it from `running` to `blocked` before/while cancellation is attempted. A narrow durable root-task-state fence closes the serial gap without adding an API, changing `EngineAttempt`, or inventing a durable-reference field.

Preimage source pin: `app/orchestration-driver.mjs` SHA-256 `70B70B5823A6EB0EF58B3EF7F03CABD97721BC8C754658E6CBD17A43219122BA`; the full byte-for-byte copy is stored at `preimages/app/orchestration-driver.mjs` with the same digest.

## Bounded acceptance criteria

1. For a synthetic serial task timeout whose cancel/reconcile does not settle ownership, the root task is durably `blocked`, the exact attempt remains unresolved/running, and a subsequently accepted wait response is claimed but produces zero host delivery calls and zero delivery-observation rows. Its first result and exact replay are both `blocked-unresolved`.
2. For a synthetic serial execution exception with the same unresolved-ownership condition, the same assertions hold.
3. Delivery admission reads the exact attempt's run and checks that run's durable root task row after the claim and immediately before invoking the host. Host delivery is eligible only when that row exists and is still `running`, alongside the existing in-memory/handle/host checks.
4. Existing eligible delivery still reaches the owned live serial handle and records a valid acknowledgement as `delivered-observed`.
5. Existing exact historical replay remains delivery-free and reports the previously observed state.
6. Existing delayed/late valid acknowledgement behavior remains unchanged: cancellation or state transition during the in-flight host call cannot fabricate acknowledgement integrity.
7. Approved recovery must restore the root task to `running`; the replacement eligible attempt can receive delivery. The fence must not permanently poison a prepared run merely because an earlier attempt failed.
8. Parallel cancellation behavior remains guarded by its retained `active.control`; the change must not weaken or replace that check.
9. No new public API, `EngineAttempt` field, or durable-reference mechanism is introduced.

## Evidence limits

The authorized focused tests may substantiate only synthetic SQLite/runtime serial timeout and serial error cases plus the existing fixture-based delivery/recovery invariants. They do not qualify S3 broadly, a real provider, process restart/reopen ownership recovery, native execution, Electron, or network behavior.

## Current verdict

Preimage: **FAIL — confirmed serial post-timeout/error delivery admission gap.**

Final candidate: **PASS for the bounded synthetic scope.** The source adds only the exact prepared run's durable root-task `state === 'running'` requirement after the response claim and before host invocation. The two new tests cover serial timeout and serial execution-error paths with unresolved cleanup, retained reservations, committed claims, zero host delivery, zero delivery observation, and exact `blocked-unresolved` replay.

The independent focused gate was run once from `daemon` and exited **0**: **4 files passed, 75 tests passed**. Complete raw output is `logs/independent-focused-gate.log` (SHA-256 `A00F30CAEAEDE2ED233A82E0E656E1274D62AD8D1EB9E28E5899CF51AFE0CA56`); the captured exit file is `logs/independent-focused-gate-exit.txt` and contains `0`.

All 15 entries in `final-pins.json` were independently rehashed successfully. Final product pins are `app/orchestration-driver.mjs` SHA-256 `79D44E00EF70E9D28ACFE54A71FBCEE5EBC2BDD39198141D65BF35B511076CDF` and `daemon/test/integration-driver.test.ts` SHA-256 `9CDE48C27B8EED53A1A2372EF4DAECA0EF993C36E995A43CB35F755E4641266F`; the source preimage remains byte-identical to its recorded full copy.

Approved recovery compatibility is source-inspected and regression-backed rather than directly demonstrated by a recovery-time wait-delivery scenario: `applyRecovery()` restores the root task from `blocked` to `running`, existing automatic/manual recovery tests pass, and the existing eligible serial delivery test passes. The evidence therefore supports the fence's compositional compatibility, but it does not positively test routing a wait response to a replacement recovery attempt.
