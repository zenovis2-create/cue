# Independent correction-5 preflight — restart diagnostics and close race

Verdict: **CLEAR for the root's capped actual 3 after its final combined source/runtime freeze confirms these pins.**

Reviewed 2026-09-15 (Asia/Seoul). No actual/OS termination, build, retained-root access, provider, Electron, local-8085, or network operation was run.

## Pins

| Path | SHA-256 |
|---|---|
| `daemon/test/fixtures/integration-public-driver-startup-crash-child.mjs` | `e3ccd1d492885b2e5f4d1fb1aee8800242eafb64efe6c9656456c2e2424c8d73` |
| `daemon/test/integration-public-driver-startup-restart.test.ts` | `8192234f3004a6d075eeca31df86d9c76511026c3836e109cfc966e030449ef9` |

## Preimage verification

- `preimage-fixture.base64` decoded to 13,566 bytes with SHA-256 `0fbba6f74353d6bac91a6ea29f0136ca07b1a703da8514a55c1a23aa827ee879`.
- `preimage-test.base64` decoded to 16,824 bytes with SHA-256 `a2c5ccd9d4dfdb76e98f4d6a49daeb08228aa11fa4bcdc983fe53f693eb41677`.

These are byte-complete correction-4 source preimages and match the prior frozen pins.

## Restart semantics

- The restart fixture invokes the fresh public driver's `start('workflow')` and `snapshot('workflow')` separately and records each expected `driver_prepare_missing` refusal.
- Durable task state is read separately from the ledger as `ledgerTask`; it is no longer conflated with an unavailable fresh-driver in-memory snapshot.
- The actual assertion still requires task/attempt blocked state, cleanup unverified, one unsealed held case and transition, one lease, zero receipt/acceptance/replacement/result, one blocked recovery, zero relaunch/authorization/resend, preserved target bytes, and a hash-valid held payload.
- A focused regression independently confirms a fresh driver's public snapshot refuses without preparation and does not invoke runtime or publication effects.

## Diagnostic persistence

- Stderr capture is attached at spawn and accepts only the remaining bytes up to the 64 KiB bound; it never concatenates the full incoming chunk.
- The registered close promise records closed state, exit code, and signal in the child receipt.
- `nextOwned` awaits bounded close after any frame failure, then persists identity, bounded stderr, exit code, signal, and combined failure before rethrowing a diagnostic error.
- Spawn/identity/handshake failure likewise records the bounded diagnostic and writes partial observation evidence. `afterEach` rewrites remaining partial state.

## Exact cleanup race

- If the child already has an exit code or signal, cleanup only awaits its registered close event.
- If observation finds the exact PID absent, cleanup gives the already-exiting child a bounded close-event opportunity and sends no signal.
- If the PID is present with a different creation identity, cleanup fails with `public_driver_restart_identity_changed` before `terminateVerifiedTree` and sends no signal.
- Only a present PID with the exact creation identity is passed to exact termination with expected creation time.
- Focused tests cover both absent-before-close success and present-mismatched refusal.

## Offline evidence

Maker evidence records fixture syntax exit 0, TypeScript no-emit exit 0, and focused Vitest 7 passed / 1 actual-gated skipped. The independent focused Vitest pass also exited 0 with the same 7 passed / 1 skipped result; raw output is in `preflight-offline.log`.

The retained actual-2 root was not accessed or modified by correction 5 or this review.

**CLEAR applies only at the two source pins above and after the final combined freeze confirms all runtime/build pins for actual 3.**
