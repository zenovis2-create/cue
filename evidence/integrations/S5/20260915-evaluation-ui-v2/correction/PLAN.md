# Evaluation UI v2 correction plan

## Preserved preimages

- `evaluation-fixture.mjs`: `9A3E7798847E16789168A2F0734756C2ED444EA9064DEE23428C162F177A482A`
- `evaluation-scenarios.mjs`: `887CEBE797F2CB685700EFC52DA08261F2DA0CD14D968857E09DF63B0EC74ECA`
- `electron-proof.mjs`: `C483567B0840634B6EACB8F1AC459E27093B8B1FAAFB16F7442F7B82CEE7B5B1`
- `offline-test.mjs`: `3CC443E6C019BCF98C065C7D1789C61BD904C6AE6062AAF4374A8BBD17C46C5A`

The earlier v2 scripts and all failed receipts remain untouched.

## Done contract

- Each offline invocation creates a new exclusive receipt directory under this correction directory; its SQLite backup target is absent before `VACUUM INTO`.
- Evaluation IPC operations persist a bounded ordered receipt containing only ordinal, operation, available, and public reason. No private Core error is inferred or exposed.
- Electron and offline harnesses consume the same exported exact guard-tag sequence, including both prepare requests and the final cleanup check.
- Any scenario failure records bounded current DOM status and SQLite row/revision counts before backup and close.
- Cleanup-visible guard scope remains fixed.
- The current policy fixture remains unchanged unless stable evidence identifies a concrete mismatch.
- Offline execution waits for root's explicit source/build freeze.
- After that signal, syntax checks for the four correction scripts and `node evidence/integrations/S5/20260915-evaluation-ui-v2/correction/offline-test.mjs` must pass.
- Product files, shared tests, build outputs, prior receipts, providers, network, model, approval, execute, Stop, and native helpers remain untouched.

## Caps

- Offline correction cap: 2 distinct corrections.
- Actual Electron cap: the existing 1 remains untouched and requires a separate root review.
- On failure, retain the exclusive receipt and switch hypothesis or report blocked.

Correction 1 aligned the shared guard sequence before execution. Correction 2 is the final offline correction: the first frozen run proved revision 2 and coverage succeeded, then exposed a false Korean status-string wait and an offline-only block-scoped cleanup guard. The correction waits for the current-run text to change and keeps `guardCheck` in cleanup-visible scope.
