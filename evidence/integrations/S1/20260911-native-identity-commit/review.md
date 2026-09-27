# Native identity commit gate — independent offline review

Reviewer: `/root/broker_review`. Date: 2026-09-12 KST. Scope: maker's native identity commit delta only; no product edits, native launches, qualification command, or model calls.

## Result

PASS for the bounded source/offline contract. Ready for the final build and separately owned Windows proof; this is not actual native runtime qualification or recovery approval.

Independent command (cwd `daemon`):

```text
npx vitest run test/integration-native-identity-commit.test.ts test/integration-native-execution-identity-store.test.ts test/integration-generated-json-local-host.test.ts test/integration-generated-json-host.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
```

Exit 0: 4 files, 34 tests passed; start 00:05:33 KST, duration 12.57 seconds. `npx tsc --noEmit`: exit 0. The identity commit suite mocks process launch and uses real SQLite; these gates do not establish real FileTime values.

## Reviewed contract and correction

- Both executor invocation entries now reject `db.inTransaction` before resolving a binding or spawning/recording a launcher. This was a reviewer blocker: rejection only at later identity persistence could leave an OS process whose session row was rolled back. The added BEGIN/ROLLBACK regression covers both lanes and asserts zero binding calls, no child, and zero session rows. Earlier maker results remain historical.
- Protected launcher/guardian identity comes from the owned process objects' creation times; the client observation comes from the existing suspended-process handle observation. Strict host frame parsing rejects proxies, accessors, invalid IDs and non-positive/out-of-range FileTime values. Store lineage ties launcher PID to the exact owned session and requires three distinct process IDs.
- Required host bases are snapshotted; task/profile paths must match their expected native child paths. Context role must be `model`. Recorded boundary pins must match the selected control bundle. Recorded identifiers are structural evidence, not authority to kill a process or delete a path.
- First matching model/checker request synchronously commits the identity before invoking transport or writing `authorize_check`. Abort is checked before and after commit. A failed write blocks service; a post-commit abort preserves the committed historical identity without granting service.
- Cancellation bounds the caller's wait at five seconds and rejects unresolved completion. It does not resolve or replace the original native result/completion promise. Cleanup observation separately bounds result waiting at five seconds and persists `unknown`; it never promotes an unresolved native exit to clean.
- Production qualification legs use these executors and fixed host bases. Direct diagnostic legs only validate/link the added host frame and retain raw journal data. They have no identity-store commit or ACK gate; this change does not claim persistence before diagnostic execution.
- Measurement source/probe footprint includes the new helper, identity store and their focused tests. Current app composition passes the mandatory bases. The review does not relabel older native receipts or modify failed live ledgers.

## Source binding and remaining proof

All 12 entries in adjacent `hashes.json` were independently SHA-256 checked after the gate and matched. Principal hashes:

| File | SHA-256 |
| --- | --- |
| native-identity-commit.ts | 68D3B4BCB6BED3DF9B898265914A0B2FEEA4FF5DCECC57C67D3B6DD8D4D27A2A |
| isolated-local-model.ts | D7FD594E205FFFEB6896D06589409DD8E724FF6E4C3DDFB534ADAABBFD10301A |
| isolated-json-checker.ts | 9E64A45D9F58A9AA50082F412EA33F1D91DB63757A3E32258826AF127356231D |
| model-only-launch.ps1 | 83142D09009418737961FB6D1D0456714A940871242FD566D935AD456FEACF6D |
| integration-native-identity-commit.test.ts | CC751C8CCD17E385B6E629CC3C68000F1C014266BD35F4DDF2A9C7FADFFB5EB2 |

The pending independently owned proof should perform exactly one model executor with a supplied stub transport and one fixed checker, compare all three live PID/FileTime pairs through targeted OS observation, verify durable commit before service, and independently observe their owned cleanup. No Qwen call is needed. Rebuild the compiled snapshot first; the offline gate alone does not prove that compiled assets contain this correction. Broader existing native suites are unnecessary unless that proof fails or leaves a specific gap.
