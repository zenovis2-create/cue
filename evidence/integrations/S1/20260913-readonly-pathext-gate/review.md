# Independent PATHEXT gate preflight

## Verdict

**READY for one separately authorized execution after the root confirms the source freeze.** No `--run`, PowerShell, native helper, AppContainer, ACL, network, model, provider, or cleanup operation was invoked during this review. Earlier markers and attempt caps remain unchanged.

Exact command: `node scripts/reuse/readonly-verifier-pathext-gate.mjs --run`

The gate owns only `D:\Temp\User\Cue.ReadonlyVerifier.PathextGate1` and `evidence/integrations/S1/20260913-readonly-pathext-gate/actual-attempt1`. The cap is one attempt and one launcher call with no retry.

## Frozen closure

- Runner: `B06A08AAF302CC9B63C6AE5F5F261A07BD744D0F194819298B15C3D85F328F63`
- Test: `C79846773752AA67C6EF1DF39A6A22ED733B47D41D4E2D9593D97A4BD387ACFD`
- Client: `530651732FD977FC32D44463A8128D40F7DEB4FA8BAD797778F4F7D08B950587`
- Production launcher: `16813F36A1DCBED9EAF4014A324EDCF72289693F5C8FC92A8F27512038A13774`
- Host adapter: `AD287C573FA1BD0CE096F09AA265C310527CA77C2607CB2E0172CEE3A57CDF3B`
- Process launch: `9920B9D3C2A217F6520F314E4665CE36DA314DE505B462DBE4A4C9A4980FD419`
- Change-snapshot host: `7ADD688300E442947B46B07F5351E5D39211999CBCED4FB26CC662E323BAD8A7`
- Process termination: `34375676C3688BE459E03009BF55F130E7794A9576F166D662BA9E4518AEB93A`
- Native manifest: `7036911619F81A85D0850CA361FF883E8430AFA079F46DBE24A9C264140920FB`
- Native helper: `CDC021FC3B912C771C54EFA9ECD5C2AB6874A7D7D02BB15C2882CAFB34F38555`
- Node: `9A4EB5F1C29C6A2E93852EAD46B999E284A6A5CA8BAB4D4E241D587D025A52DE`

All pins independently match. Verification occurs before authority imports, evidence-directory or marker creation, owned-root creation, PowerShell, or native activity. The owned root, marker, and result were absent at review time.

## False-green and failure review

All host PowerShell observations use fixed `{SystemRoot, WINDIR, PATHEXT: '.EXE'}`; the isolated payload remains the prior eight-key environment. The gate persists expected nonce and command-line digest before launch. PASS requires the host loopback positive control, zero isolated accepted connections, exact access-denial errno, expected project/runtime values, unchanged bytes, exact root SDDL and identity, positive PID with verified death, exactly one nonce-bound cleanup frame, exactly one nonce-bound exit-0 frame, profile count zero, and clean classified host observations.

Cleanup parsing is exact-count and fail closed. Missing or malformed worker output becomes `null` instead of throwing, so native root, post-ACL, and exact-profile observations still execute and are retained before the final FAIL decision. Raw bounded observations and expected nonce/digest are included in terminal and exception receipts. The frozen gate uses the unchanged production launcher as its actual boundary.

Independent command: `node --test scripts/reuse/readonly-verifier-pathext-gate.test.mjs`

Result: **14/14 passed**. Behavioral coverage includes closure pinning, environment override rejection, raw receipt survival, LF/CRLF exact frames, missing/malformed worker results, strict errno, PID/cleanup source gates, and loopback argv semantics.

This direct-launcher experiment cannot establish coordinator behavior, durable identity-store persistence, production registration, acceptance, P13, entitlement, or public qualification.
