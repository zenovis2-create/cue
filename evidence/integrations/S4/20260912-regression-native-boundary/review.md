# Independent review: native boundary regression fixes

Date: 2026-09-12 KST  
Verdict: **PASS**

## Scope and source audit

Reviewed only `daemon/src/change-snapshot-host.ts`, `daemon/test/integration-guarded-entry.test.ts`, the existing boundary tests selected by the implementation contract, and the implementation evidence. No application or daemon source was changed by this review, and no build or broad suite was run.

`change-snapshot-host.ts` now routes the reviewed helper through `runProcessSync`, the existing sealed synchronous process boundary. The boundary resolves an absolute executable with `resolveSealedExecutable`, rejects executables inside registered writable worktrees, spreads the caller's options, and finally forces `shell:false`. The journal host retains its fixed runtime path, reviewed SHA-256, import-time validation, immediate pre-execution and post-execution hash checks, empty argument list, JSON stdin, UTF-8 output, hidden window, five-second timeout, 24 MiB process-output cap, and 16 MiB protocol/data cap. The change removes the extra direct `spawnSync` use without weakening helper selection or response validation.

The guarded-entry fixture now creates and copies the four native asset paths required by the current installation identity closure:

- source helper executable and manifest;
- compiled helper executable and manifest.

It verifies source and compiled hashes agree before launching the child. These are copies of the repository's reviewed test assets, not fabricated native identity responses. The fixture still imports only its synthetic module after generation capture, retains single-attempt/concurrent rejection, and treats its Electron run as an ordering test rather than proof of the actual installed application.

No guard weakening or new caller-controlled executable path was found.

## Independent gate

Executed once from `C:\Users\User\cue\daemon`:

```powershell
npx --no-install vitest run test/p4.test.ts test/p45.test.ts test/integration-change-records-native.test.ts test/integration-native-journal-wiring-review.test.ts test/integration-guarded-entry.test.ts test/integration-installation-identity.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
```

Result:

```text
Test Files  6 passed (6)
Tests       53 passed | 3 skipped (56)
Duration    27.03s
Exit code   0
```

The three skips remain explicit and are not counted as passes:

- P4.5 OS current-working-directory query: skipped on Windows because `Win32_Process` does not expose cwd;
- installed Orca worktree round-trip: conditional installed-environment gate;
- real vendor Codex through AppContainer: conditional real-installation gate.

The selected positive tests did exercise the reviewed Windows snapshot helper, native file identities and bytes, junction/root replacement/hard-link/sparse/ADS rejection, the Node guarded-entry ordering fixture, and the actual Electron guarded-entry ordering fixture. They did not invoke a model, provider, real Codex sandbox execution, download, or paid service.

Scoped `git diff --check` passed. Per the bounded assignment, the build was not rerun; root had already resolved the unrelated build blocker separately.

## Frozen hashes

| File | SHA-256 |
|---|---|
| `daemon/src/change-snapshot-host.ts` | `5b45d38462cbd220c9c27b464391e95143e131e2d4ed7cf23183195a6a510f43` |
| `daemon/test/integration-guarded-entry.test.ts` | `98650578d8f103485ed3240aed58b4260cb7813d46b7d66d2763a0d755e98e63` |

This verdict covers only the two native-boundary regression fixes. It does not convert the three conditional skips into evidence, prove publisher authentication or atomic hash-to-execute, or establish whole S4/S0-S7 completion.
