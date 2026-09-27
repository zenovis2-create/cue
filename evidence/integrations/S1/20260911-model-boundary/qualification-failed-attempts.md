# Controlled qualification: stopped after two attempts

Status: NOT QUALIFIED. No third execution or implementation patch was performed for this handoff.

Command (daemon working directory):

```text
npx vitest run test/integration-model-boundary-qualification.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
```

Both executions exited 1, with 2 tests passing and 1 failing. The original errno test was not changed or deleted.

## Attempt 1: 2026-09-11 17:50:13 local

Verbatim failure/result excerpt retained from tool session 73002 (chunk 5d173a); no separate complete terminal logfile was created:

```text
 ✓ test/integration-model-boundary-qualification.test.ts > fixed model-client controlled qualification observations > M1 production rejects code/tool/url fields and cannot select a probe 9286ms
 ✓ test/integration-model-boundary-qualification.test.ts > fixed model-client controlled qualification observations > diagnostic hold requires true boolean and missing host acknowledgement still cleans 8505ms
 × test/integration-model-boundary-qualification.test.ts > fixed model-client controlled qualification observations > M2/M3 denied file operations plus same-listener host controls and no confined TCP success 4115ms
   → temp/delete: expected [ 'EPERM', 'EACCES' ] to include 'ENOENT'

 FAIL  test/integration-model-boundary-qualification.test.ts > fixed model-client controlled qualification observations > M2/M3 denied file operations plus same-listener host controls and no confined TCP success
AssertionError: temp/delete: expected [ 'EPERM', 'EACCES' ] to include 'ENOENT'
 ❯ test/integration-model-boundary-qualification.test.ts:133:130

 Test Files  1 failed (1)
      Tests  1 failed | 2 passed (3)
   Start at  17:50:13
   Duration  22.14s (transform 20ms, setup 0ms, import 36ms, tests 21.96s, environment 0ms)
```

Diagnosis/correction: host seeded `taskRoot/temp/probe-existing.txt`, whereas AppContainer remaps the child TEMP to `profilePath/Temp`. Host seed and post-exit inspection targets were changed to the package Temp. Assertions were not relaxed. The exact first-attempt test SHA was not separately saved; the second execution overwrote the JSON artifact.

## Attempt 2: 2026-09-11 17:51:07 local

Verbatim failure/result excerpts retained from tool session 28810 (chunks f3a3ff and dfae9c); no separate complete terminal logfile was created:

```text
 ✓ test/integration-model-boundary-qualification.test.ts > fixed model-client controlled qualification observations > M1 production rejects code/tool/url fields and cannot select a probe 8996ms
 ✓ test/integration-model-boundary-qualification.test.ts > fixed model-client controlled qualification observations > diagnostic hold requires true boolean and missing host acknowledgement still cleans 8288ms
 × test/integration-model-boundary-qualification.test.ts > fixed model-client controlled qualification observations > M2/M3 denied file operations plus same-listener host controls and no confined TCP success 5783ms
   → expected undefined to be defined

 FAIL  test/integration-model-boundary-qualification.test.ts > fixed model-client controlled qualification observations > M2/M3 denied file operations plus same-listener host controls and no confined TCP success
AssertionError: expected undefined to be defined
 ❯ test/integration-model-boundary-qualification.test.ts:137:124
    135|       }
    136|       for (const item of acl as { exists: boolean; content: string; pa…
    137|         expect(item.exists).toBe(true); const own = item.packageRules.…
       |                                                                                                                            ^
    138|         expect(own!.type).toBe('Allow'); expect(own!.rights & 0x1200a9…
    139|         for (const rule of item.packageRules.filter(rule => rule.type …

 Test Files  1 failed (1)
      Tests  1 failed | 2 passed (3)
   Start at  17:51:07
   Duration  23.29s (transform 20ms, setup 0ms, import 36ms, tests 23.12s, environment 0ms)
```

Reached assertions imply the 16 create/append/overwrite/delete refusal checks and host post-exit target contents/new-file absence checks passed before line 137. They are not a separately retained raw measurement record. The TCP post-control/assertions occur after the failed ACL assertion and were not executed. Thus this attempt does not prove M3.

## Evidence retention gap and proposed next bounded correction

`controlled-qualification.json` contains only the passed M1 and diagnostic timeout observations. The M2/M3 record is appended after all assertions; on failure, probe JSON, host ACL output, SID names and post-exit contents were not saved. Raw ACL/SID text is **not retained**, and no package SID/name mapping is claimed as observed.

Static hypothesis: `Get-Acl` may expose a resolved NTAccount in `IdentityReference.Value`; filtering that display string by `S-1-15-*` can omit the actual package ACE. An absent ACE or other extraction problem remains possible until independent inspection.

Proposed patch, NOT APPLIED: replace the display-string filter with explicit SID normalization, failing if translation fails:

```powershell
@($a.Access | ForEach-Object {
  $sid = $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
  if ($sid -like 'S-1-15-*') {
    @{sid=$sid;rights=[int]$_.FileSystemRights;type=$_.AccessControlType.ToString()}
  }
})
```

Before any next execution, append raw controlled probe/ACL/post-exit/listener observations to the artifact before assertions and persist failures explicitly. This is a data-retention correction, not relaxation of RX or file-denial assertions. Review the extraction defect independently before authorizing another bounded unit.

Current SHA-256 (read after attempt 2):

| File | SHA-256 |
|---|---|
| daemon/test/integration-model-boundary-qualification.test.ts | 80CD059D29A3D229C7B8774C5357EE116C8A61D1BEEDCF2A27A113CE1229208A |
| daemon/src/model-only-launch.ps1 | 5A2DC5C7019E6DDD5DFA44554056CFE7BFA5B18D068DBE29E58A28C1DA973060 |
| daemon/src/model-only-client.cjs | 52129525E66E891068B15A1928A170ED7B6BB4DC35E7C6BA0AFC4EDB294EB015 |

The launcher changed only for the explicitly authorized ProbeHarness post-exit inspection hold. Production rejects the new field, the hook requires Boolean true, and absent host acknowledgement takes the five-second cleanup path. These passing tests do not qualify the provider or all network protocols.
