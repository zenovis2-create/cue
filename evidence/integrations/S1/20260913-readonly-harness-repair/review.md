# Independent offline harness-repair review

## Verdict

**PASS for the offline harness repair.** No `--run`, PowerShell, native helper, AppContainer, ACL, network, model, provider, or cleanup operation was invoked. This verdict does not authorize another Unit A boundary attempt and supplies no production or public qualification claim.

The corrected runner cannot reuse the consumed manifest: its runner and test hashes differ from the frozen historical pins, and `authorizeProbeStart` checks every pin before its authorization callback creates the evidence directory or exclusive intent marker. The behavioral test invokes this same exported function used by the real main path and proves a mismatched old runner hash leaves the callback count at zero. Imports compute paths and hashes and load the guarded client helpers; they do not enter the main `--run` branch.

## Preservation and hashes

The archived originals are byte-identical to the consumed versions:

- Archived runner: `35AA35FD4BB15D93FA828EFA4E3ACCD2FFCCF69EBB936CEEA913AB04607A693B`
- Archived test: `71D96C974F832FBD186B71B4483A771551809BC33ED20E7A0FB16F049598FDAC`
- Archived manifest: `2E120EFC324A20EB42642A641EB7862EE98CD5125FCDBC2078D2A0B61E283311`

The active historical manifest remains `2E120EFC324A20EB42642A641EB7862EE98CD5125FCDBC2078D2A0B61E283311`. The consumed intent remains `485F2913D4A52FF00BDF100D95A138021EA54765AE714E9DE9B5F65A571D2C08`, and its failed result remains `0EB338E0A70D96724EB385C8BD5175A2D32DE8C545753E29B396994ADE643A39`.

Corrected offline sources:

- Runner: `C6C689FCD6ED28BE4577EE42DE826C3EBA7C77A394E0FB939A99462D4B4D75FF`
- Test: `48E05FCF3FC8DA4011C61A6E103C6F81FA8A346BAD7C8C554F27F80C46852CC5`

## Contract review

All four host PowerShell sites use `observeHostPowerShell`: ACL preflight, captured launcher execution, post-ACL observation, and profile observation. The adapter overwrites `env` with exactly `{SystemRoot, WINDIR}` and retains bounded status, signal, structured error, stdout, and stderr. The AppContainer payload remains a separate ordered eight-key environment containing `APPDATA`, `HOME`, `LOCALAPPDATA`, `TEMP`, `TMP`, `USERPROFILE`, `SystemRoot`, and `WINDIR`.

Raw diagnostics are assigned before each corresponding guard or later interpretation. Exception failure receipts include the diagnostics collected up to the throw. Normal terminal PASS and FAIL receipts now use `buildTerminalReceipt`, which copies the complete diagnostics object into the serialized result. The behavioral JSON round-trip test confirms `aclPreflight`, `launcher`, `aclAfter`, and `profileCheck` survive a normal failed terminal result.

The focused suite contains some source-shape assertions for fixed scope, but the repaired security-sensitive seams have executable tests: exact environment injection, bounded raw preservation, classifier precedence, old-manifest rejection before callback, terminal receipt round-trip, strict port parsing, and exact access-denial classification. The dependency injection exercises the same `observeHostPowerShell`, `authorizeProbeStart`, and `buildTerminalReceipt` functions called by the actual runner path; there is no alternate test-only authorization implementation.

Independent command: `node --test scripts/reuse/readonly-verifier-boundary-probe.test.mjs`

Result: **9/9 passed**.

The repair makes a future, separately authorized harness retain the evidence missing from the consumed attempt. It does not explain that historical failure, alter production ACL behavior, reopen the one-attempt marker, or establish that a future native run will pass.
