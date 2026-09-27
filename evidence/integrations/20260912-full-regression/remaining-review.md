# Independent final fixture review

Date: 2026-09-12 KST  
Verdict: **PASS for the three corrected regression fixtures**

## Original failures

The preserved full-suite report `integrated.json` recorded 190 files, 1,257 passing tests, six failures in three files, and five skips. The six failures were:

- one default-startup expectation that omitted the now-required `nativeRecoveryFactory` option;
- four isolated journal-packaging imports that did not copy the compiled host's real `process-launch.js` dependency;
- one independent-connection orchestration claim test that raced concurrent ledger opening and failed with `database is locked` before reaching its intended claim contention.

The failed full-suite report remains unchanged and is not relabeled as passing.

## Source audit

`integration-default-startup.test.ts` now requires the exact two-option Core construction object containing both `orchestrationFactory` and `nativeRecoveryFactory`. It retains the same daemon identity assertion, definitions-only import checks, four generation checks, window creation, failure cleanup, retry denial, and forged-generation rejection. The fix updates the fixture to the current strict startup interface; it does not loosen startup behavior.

`integration-journal-packaging.test.ts` copies `dist/src/process-launch.js` beside the isolated compiled `change-snapshot-host.js`. That is the host's real static dependency. The fixture still copies the reviewed helper and manifest, validates source provenance and digests, requires frozen metadata and the isolated compiled path, and verifies missing helper, changed helper, and changed manifest fail closed. It does not replace the dependency with a stub or fabricate helper authority.

`integration-orchestration.test.ts` opens worker A and waits for its `ready` message, then opens worker B and waits for its `ready` message. Each ready signal is emitted only after that worker has independently opened the same ledger and constructed its store. Neither worker claims before the unchanged barrier: both remain waiting on the parent message, and the parent still sends `go` to both workers in one `forEach` after both are ready. The unchanged result assertions require exactly one `claimed`, one `task_not_ready`, one orchestration attempt, and one workspace-write lease. The fixture therefore removes concurrent migration/open timing from a test of claim contention without serializing the claims themselves. Concurrent migration startup is not fixed or claimed.

No application or daemon product source was edited by these corrections.

## Exact independent gate

Executed once from `C:\Users\User\cue\daemon`:

```powershell
npx --no-install vitest run test/integration-default-startup.test.ts test/integration-journal-packaging.test.ts test/integration-orchestration.test.ts --reporter=json --outputFile=../evidence/integrations/20260912-full-regression/final-fixtures-review.json --fileParallelism=false --maxWorkers=1
```

Result: exit 0. The durable report contains three test-result files with **20/20 tests passed**, zero failed, and zero pending/skipped. Vitest's JSON aggregate reports `numTotalTestSuites: 4` and `numPassedTestSuites: 4` even though `testResults` contains the three explicitly selected files; this review reports both fields without rewriting them.

Durable result: `final-fixtures-review.json`  
SHA-256: `ac71b7f713061008fcf20e01b32f13f362c89ce6417881004274b377c8e4a0cf`

## Frozen fixture hashes

| File | SHA-256 |
|---|---|
| `daemon/test/integration-default-startup.test.ts` | `aef257ab4eadbc54b7a9e099a87e206a7075cc263fd7f5b8d212164628693971` |
| `daemon/test/integration-journal-packaging.test.ts` | `fdc1458a4624d78f040792ed15d944356d37af8dbeb9f88ea6e5899086cd6b3b` |
| `daemon/test/integration-orchestration.test.ts` | `413440badc651f2d502644decba10c6e15598c1c6706d4fe89d9f0fb012d8a4e` |

No full-suite or build command was run for this review. This PASS closes only the six fixture failures from the preserved integrated report; it does not turn that historical full-suite execution into a green run or establish whole S0-S7 completion.
