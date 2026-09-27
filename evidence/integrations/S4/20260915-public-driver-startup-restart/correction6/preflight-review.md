# Independent correction-6 preflight — shared complete restart host

Verdict: **CLEAR for the root's capped actual 4 after the final combined source/runtime freeze confirms these pins.**

Reviewed 2026-09-15 (Asia/Seoul). No actual/OS termination, build, retained-root access, provider, Electron, local-8085, or network operation was run.

## Pins

| Path | SHA-256 |
|---|---|
| `daemon/test/fixtures/integration-public-driver-startup-crash-child.mjs` | `b7f96fd6297e660aa45e5aca24b1dfebeff3c07b60e043384bc15b2a85a113cb` |
| `daemon/test/integration-public-driver-startup-restart.test.ts` | `9f190884922983200eb9fc58f240c77b72004b67b4a0806420a34639ca62754c` |

## Preimage verification

- `preimage-fixture.base64` decoded to 13,745 bytes with SHA-256 `e3ccd1d492885b2e5f4d1fb1aee8800242eafb64efe6c9656456c2e2424c8d73`.
- `preimage-test.base64` decoded to 19,867 bytes with SHA-256 `8192234f3004a6d075eeca31df86d9c76511026c3836e109cfc966e030449ef9`.

These byte-complete backups match correction 5's frozen source pins.

## Shared-host audit

- `createRestartHost(counts)` is exported from the executable fixture and used directly by both the actual restart branch and the offline regression. The fixture body remains guarded by its entry-point check, so importing the factory does not execute ownership, ledger, native-write, or provider paths.
- The shared host satisfies the current constructor contract with `authorize`, `openStagedAttempt`, `readStagedReplacement`, and `execute`. Each method has a distinct counter and fails closed if unexpectedly called. Runtime candidate resolution likewise increments the launch counter and refuses.
- The offline regression constructs the real public driver with that exact shared host, calls public `start('workflow')` and `snapshot('workflow')`, requires `driver_prepare_missing` from each, and asserts the complete counter object remains `{launches:0, authorizeCalls:0, opens:0, reads:0, executeCalls:0}`.
- The executable restart branch uses the same factory, records both refusals separately, and includes all five counters in the durable restart response. The actual assertion requires each counter to remain zero.
- Existing durable task, blocked attempt, held transition/payload, lease, recovery, receipt, acceptance, replacement, result, and target-postimage assertions remain present.

## Diagnosis boundary

Actual 3 directly proved constructor rejection because its restart fixture omitted required staged-open/read methods. Correction 6 repairs that exact defect. Actual 2's immediate exception remains unknown because actual 2 retained no stderr; the correction-5 source review identified a latent snapshot refusal but did not retroactively establish actual 2's cause. The correction-6 metadata states this distinction accurately.

## Offline evidence

Maker evidence records fixture syntax exit 0, TypeScript no-emit exit 0, and focused Vitest 7 passed / 1 actual-gated skipped. The independent focused Vitest pass also exited 0 with 7 passed and 1 skipped; its concise record is in `preflight-offline.log`.

**CLEAR applies only at the two pins above and after the root's final combined freeze confirms all production/runtime/build inputs for actual 4.**
