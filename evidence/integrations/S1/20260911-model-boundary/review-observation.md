# Effective child boundary observation — independent review

2026-09-11. Maker `reuse_cli`; independent reviewer/executor `cue_fit`. Parent transcribed the terminal review; this is not a self-review.

```text
cwd: daemon
npx --no-install vitest run test/integration-model-boundary-observation.test.ts test/integration-model-boundary-hardkill.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
2 passed, 6.81 s
```

| Source | SHA-256 |
| --- | --- |
| model-only-launch.ps1 | 82d1ca43810b4521202c851d73084740f34a3fcb614175655da699eec3e52c4f |
| integration-model-boundary-observation.test.ts | 4d96cb15f07205d3bfbf0d41f0cb0ca7e6fbdef50ad8c22280b1f084018f58fe |
| integration-model-boundary-hardkill.test.ts | ce59c5c117e8afc40cb6582228d2448fb8eea0caa432b185566ce7e9f5d3d365 |

The exact child is observed after suspended assignment and private DACL sealing, before resume. Native token readback confirms AppContainer true, the generated package SID and no capabilities. Effective Job flags are `0x2008` with active limit 1, kill-on-close, no breakaway and the exact child as sole member. Process creation time is read again to detect identity races. Loopback exemption is queried explicitly and must be false. API failure/mismatch prevents resume. The controlled probe correlates its actual PID with this observation and profile-write EPERM. Guardian hard-kill cleanup remains passing. No blocking finding in this scope.

Native buffer/handle cleanup was inspected. Implementation references [token information classes](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ne-winnt-token_information_class), [Job query](https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-queryinformationjobobject) and [loopback exemption query/free contract](https://learn.microsoft.com/en-us/windows/win32/api/netfw/nf-netfw-networkisolationgetappcontainerconfig). No policy, firewall or exemption mutation was performed.

The record deliberately emits qualification unknown. Earlier child UNKNOWN and network ETIMEDOUT results remain non-qualifying; this result adds effective OS state and cleanup evidence, not complete model/provider qualification or a real model broker connection. The maker also ran a successful daemon build; the independent command above is the scoped native gate.
