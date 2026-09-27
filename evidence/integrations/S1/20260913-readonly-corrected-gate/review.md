# Independent corrected-gate preflight

## Verdict

**READY for one separately authorized execution.** The preflight performed no `--run`, PowerShell, native-helper, AppContainer, ACL, network, model, provider, or cleanup operation. The historical Unit A marker and cap remain unchanged; this is a new experiment with its own owned root and exclusive marker.

If authorized, the exact command is:

`node scripts/reuse/readonly-verifier-corrected-gate.mjs --run`

The attempt cap is one and there is no retry. Owned scope is `D:\Temp\User\Cue.ReadonlyVerifier.CorrectedGate1` plus `evidence/integrations/S1/20260913-readonly-corrected-gate/actual-attempt1`.

## Frozen closure

- Runner: `2992ED7DD8182A62415F689E766FC5D06867383B9E81E7F4826920702A2F1B2A`
- Test: `A45A99210FD40F40C635033B0C948AC5DF2122F9247427DD35191481C26C0400`
- Client: `530651732FD977FC32D44463A8128D40F7DEB4FA8BAD797778F4F7D08B950587`
- Production launcher: `16813F36A1DCBED9EAF4014A324EDCF72289693F5C8FC92A8F27512038A13774`
- Shared host adapter: `C6C689FCD6ED28BE4577EE42DE826C3EBA7C77A394E0FB939A99462D4B4D75FF`
- Compiled process launch: `9920B9D3C2A217F6520F314E4665CE36DA314DE505B462DBE4A4C9A4980FD419`
- Compiled change-snapshot host: `7ADD688300E442947B46B07F5351E5D39211999CBCED4FB26CC662E323BAD8A7`
- Compiled process termination: `34375676C3688BE459E03009BF55F130E7794A9576F166D662BA9E4518AEB93A`
- Native manifest: `7036911619F81A85D0850CA361FF883E8430AFA079F46DBE24A9C264140920FB`
- Native helper: `CDC021FC3B912C771C54EFA9ECD5C2AB6874A7D7D02BB15C2882CAFB34F38555`
- Node executable: `9A4EB5F1C29C6A2E93852EAD46B999E284A6A5CA8BAB4D4E241D587D025A52DE`

All manifest pins independently matched. The gate verifies them before dynamically importing the authority modules and before creating the evidence directory, marker, owned root, PowerShell process, or native helper call. At review time the owned root, marker, and result were absent.

## False-green review

The host positive control opens the fixed loopback listener, completes one ordinary host connection, resets its accepted count, and then requires the isolated worker's connection to fail with exactly `EACCES` or `EPERM` while accepted connections remain zero. Project read and runtime write require explicit successful values. Project create, overwrite, remove, rename, chmod, and sibling read/write require the same narrow access-denial evidence. Initial worktree file hashes and absence of created/renamed paths cover bytes; root SDDL and native root identity must match after launch.

PASS additionally requires a positive worker PID followed by verified death, exactly one nonce-bound cleanup frame, exactly one full nonce-bound exit-0 frame under LF or CRLF, profile count zero, and successful classified launcher/post-ACL/profile host observations. Signal, structured error, nonzero status, stderr, or empty required output fails closed. Raw bounded host receipts are persisted on exception and normal terminal PASS/FAIL paths.

The AppContainer payload retains the production eight-key environment. All four host PowerShell observations use exactly `SystemRoot` and `WINDIR`. The executable, embedded client bytes, unchanged production launcher, native root helper, and process-death observer are pinned.

Independent offline command: `node --test scripts/reuse/readonly-verifier-corrected-gate.test.mjs`

Result: **13/13 passed**. The executable security seams include behavior tests for environment injection, raw receipt survival, classifier precedence, pre-side-effect pin rejection, strict access errno, port argv semantics, and LF/CRLF exit-frame parsing; source-shape checks are supplemental.

This gate directly tests the launcher boundary. It does not invoke the TypeScript coordinator or durable identity stores and cannot establish production registration, code acceptance, P13, entitlement, or public qualification.
