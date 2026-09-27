# Native recovery observer — independent offline review

Reviewer `/root/broker_review`, 2026-09-12 KST. Product source read-only; no actual helper, native executor, qualification or model invocation.

## Result and validation

PASS for the observation-only source/offline contract. No open blocker in this bounded unit. This is not native runtime evidence, cleanup approval or recovery authorization.

Command in `daemon`:

```text
npx vitest run test/integration-native-recovery-observer.test.ts test/integration-native-execution-identity-store.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
npx tsc --noEmit
```

Independent tests: exit 0, 2 files / 18 PASS, start 00:23:20 KST, duration 721ms. Typecheck: exit 0. Tests explicitly mock process launch and filesystem stat, including the default-wire cases that return a `native` label; those cases are wiring tests, not OS facts.

## Contract checked

- Exact own-data input schema rejects proxies, accessors and extra fields. Stored reference, run, candidate and subject must match before querying; exact canonical identity and session linkage are checked again around asynchronous work. An outer transaction or closed DB fails. The required synchronous installation guard is checked repeatedly; it is host authority and does not mean historical qualification remains current.
- Native request contains only a nonce and the three recorded PIDs. Fixed helper path, 16KiB output cap and remaining five-second timeout are passed through the sealed process launcher. No historical cwd, arbitrary script or request-supplied command is used. Cancellation/deadline discard results; this does not claim preemption of arbitrary synchronous host guard/filesystem operations.
- The helper obtains creation time and zero-time wait state from the same opened process handle, requests query/synchronization rights, and closes the handle in `finally`. Missing PID is distinguished from access/query failure; failures stay unknown. Integer FileTime is retained as canonical decimal text without Number conversion. Response nonce/order/PIDs and state-dependent time fields are checked.
- Process states distinguish matching alive, matching exited, PID reuse, absence and unknown. These are time-specific observations, not persistent guarantees or termination permission.
- Current helper-reported temp and local-app-data folders must reconstruct the recorded boundary paths. Every path component is checked; reparse/other/error stays unknown and only ENOENT establishes absence. This is sequential observation, not an atomic filesystem lock or protection against hostile change-and-revert.
- Fixture replacements are explicitly labelled `fixture`. Results are deeply frozen and have `authority: observation-only`; there is no receipt, acceptance, durable write, restart, process termination or file deletion API. The existing identity is unchanged. A future caller must independently decide and authorize any recovery action.
- Root asset-copy delta copies the fixed PowerShell helper into the compiled source directory. This unit is not inserted into historical M1–M3 evidence; its supplied current installation guard must cover the loaded observer and helper. No qualification receipt was changed or issued here.

## Resolved preliminary concern

An initial bare `powershell.exe` PATH concern was withdrawn after checking the actual call chain: `runProcessSync` delegates to `resolveSealedExecutable`, whose Windows `systemTools` table maps it to SystemRoot/System32/WindowsPowerShell/v1.0/powershell.exe before PATH lookup. The observer rejects non-Windows native querying first. No duplicate resolver change was required. This correction to the review is preserved rather than counted as a product defect.

## SHA-256 binding

| File | SHA-256 |
| --- | --- |
| daemon/src/native-recovery-observer.ts | B76B273CE1CD7EE81BA3512C4E098302D2653C776581303A4E7BA095045B2134 |
| daemon/src/native-process-observation.ps1 | DBF6ABB0D3B0343E03BF848A8564F54F34F7A96714D079BAB570E14FA3C567A4 |
| daemon/test/integration-native-recovery-observer.test.ts | 1BD63C7AB75EA1C8382B206AFCED10DBD003B587FD0AD726F9735EA4A0E7D154 |
| daemon/scripts/copy-assets.mjs | 14FD6F8EF3F25F6970F27B5F42859D8AAF411ABE911AC7E703A490D3C8DC8C15 |

Actual targeted helper behavior, same-handle Windows observations and helper shutdown remain for separately owned native proof. Prior commit-gate proof and exhausted live-model allowances were not reused.
