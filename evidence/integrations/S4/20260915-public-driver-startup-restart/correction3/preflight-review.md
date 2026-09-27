# Independent correction-3 delta audit — durable response observations

Verdict: **CLEAR for the root's one actual gate at the pinned files below.**

Reviewed 2026-09-15 (Asia/Seoul). This audit covered only the correction-3 observation-persistence delta. No actual/OS termination, build, provider, Electron, local-8085, or network operation was run.

## Pins

| Path | SHA-256 |
|---|---|
| `daemon/test/fixtures/integration-public-driver-startup-crash-child.mjs` | `ab8e5095fe8b1a829248f0e6482f322c49f092934c4a90bb8fc42cf41267818f` |
| `daemon/test/integration-public-driver-startup-restart.test.ts` | `db10b8e4543fb7837408104924b2f33f2ecfcfc612c675963cd18fed8e45279f` |

## Delta findings

- The observation record path must be absolute, its parent must already exist, and path-relative containment rejects the scenario root itself and every path below it.
- The genuine `effect` response is paired with the independently observed first-child identity, appended, and synchronously written before any effect-response assertion.
- The genuine `restart` response is paired with the independently observed second-child identity, appended, and synchronously written before any restart-response assertion.
- `afterEach` rewrites the same ordered snapshot before scenario-root deletion, preserving observations collected before a later failure. An observation-write failure marks the scenario root retained and is included in aggregate cleanup failure.
- Handshake identity frames remain validated in memory and are explicitly excluded from this response-evidence artifact. This matches the narrowed contract and does not fabricate response evidence.

The recorded offline evidence reports fixture syntax exit 0, focused Vitest exit 0 with 3 passed and 1 actual-gated skipped, and TypeScript no-emit exit 0. Those gates were not repeated because the final source pins are unchanged from the supplied correction-3 gate record.

The actual run requires both:

- `CUE_ACTUAL_PUBLIC_DRIVER_RESTART=1`
- `CUE_PUBLIC_DRIVER_RESTART_OBSERVATIONS_RECORD=<absolute existing-parent file outside the cue-public-driver-restart-* scenario root>`

The previously required cleanup receipt variable remains required:

- `CUE_PUBLIC_DRIVER_RESTART_CLEANUP_RECORD=<absolute existing-parent file outside the cue-public-driver-restart-* scenario root>`

**CLEAR applies only while both pinned source files remain unchanged.**
