# SID normalization bounded correction: failed, stopped

Authorized scope: normalize IdentityReference via Translate(SecurityIdentifier), propagate translation/readback errors, preserve raw observations before assertions, run only the affected case once. No launcher or production policy change in this unit.

Command, working directory `daemon`:

```text
npx vitest run test/integration-model-boundary-qualification.test.ts -t 'M2/M3' --reporter=verbose --fileParallelism=false --maxWorkers=1
```

Result: exit 1, 1 failed and 2 skipped. Start 2026-09-11 17:55:39 local, duration 13.93 seconds. Session 86629, final output chunk 5c72ed:

```text
 × test/integration-model-boundary-qualification.test.ts > fixed model-client controlled qualification observations > M2/M3 denied file operations plus same-listener host controls and no confined TCP success 13704ms
   → expected AssertionError: expected 1 to be +0 // Ob… { …(4) } to be null

AssertionError {
  "message": "expected 1 to be +0 // Object.is equality",
  "actual": 1,
  "expected": 0,
  "showDiff": true,
  "operator": "strictEqual",
}

 ❯ test/integration-model-boundary-qualification.test.ts:137:25

 Test Files  1 failed (1)
      Tests  1 failed | 2 skipped (3)
   Start at  17:55:39
   Duration  13.93s (transform 21ms, setup 0ms, import 37ms, tests 13.76s, environment 0ms)
```

Preserved raw artifacts, unique names (old artifacts unchanged):

- `controlled-qualification-a31a075e-2659-4c6b-9dcb-aebe2014ea07.jsonl`: observations written as obtained, before assertions.
- `controlled-qualification-a31a075e-2659-4c6b-9dcb-aebe2014ea07.json`: final aggregate and source hashes.

Distinct concrete failure: both pre/post ACL helper processes return status 1. Their retained stderr reports `CouldNotAutoloadMatchingModule` for `Get-Acl` / `Microsoft.PowerShell.Security`. `$ErrorActionPreference='Stop'` prevents accepting an incomplete ACL result. The prior NTAccount representation check was valid, but does not prove the historical missing ACE was caused by display-name filtering; prior raw output was absent. Current evidence reveals a separate module-loading problem.

Host seed acknowledgement was not released after the pre-readback failure, invalidating the confined mutation/network experiment. Actual host pre/post TCP controls reached the same 127.0.0.1:50790 listener and their exact nonces were received; that alone does not establish M3. No M2/M3 qualification claim is made. No additional execution or corrective implementation follows this failure.

SHA-256:

- Test: `12D3E920F955D59E35078D2DC615439D35728B5A092DE5A348853C4CE1DBCE98`
- Unchanged launcher: `5A2DC5C7019E6DDD5DFA44554056CFE7BFA5B18D068DBE29E58A28C1DA973060`

Independent reviewer `/root/cue_fit` and parent received the exact command, result, new cause and raw artifact paths.
