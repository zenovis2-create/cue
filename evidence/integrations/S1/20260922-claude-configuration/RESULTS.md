# Batch87 — explicit Claude configuration/account handoff

Date: 2026-09-22. Implemented and tested directly by the current assistant; **self-review only, not independent review**. Original checklist remains **44 total / 33 closed / 11 open**.

## Implemented

- `app/claude-configuration.mjs` and `.d.mts`: host-only resolver, exact request/session/environment validation, identified profile selection, bounded freshness, canonical/reparse-free explicit directory layout, private one-use issuance and pre-use drift checks.
- `daemon/src/adapters/claude-cli-executor.ts`: mandatory available resolver before launch; rejection of former launch-supplied environment; exact attempt/candidate/subject/account/model/worktree binding; immutable launch snapshot across async configuration lookup; cancellation and envelope checks after final installation measurement.
- Build relocation keeps the compiled executor importing the original app configuration issuer (no duplicated WeakMap/module copy).
- New filesystem fixture/configuration tests and extended executor/SQLite ownership/import regressions; [host contract](../../../../docs/integration/CLAUDE_CONFIGURATION.md).

The trusted callback must supply the authorized CLI-specific session/config mapping. This implementation **does not supply a real Claude authentication observer** and never infers authentication from profile metadata. The callback is unavailable by default and no candidate was registered or enabled. No credentials are read, copied or created by production code. Tests create only explicit noncredential fixture files.

## Source review and corrections

1. Initial build failed because the new test installation descriptor omitted its required `executable` metadata. Added explicitly synthetic metadata rather than weakening the production type. `build-pass1.log` retained; `build-pass2.log` passed.
2. First focused run: 49 pass / 1 fail. The test expected three installation checks but duplicate lookup correctly performs a fourth before refusal. Corrected that exact count; no production gate was loosened. `focused-pass1.log` retained; `focused-pass2.log` passed 51 tests including compiled import at that revision.
3. Direct self-review found installation remeasurement could cross envelope expiry or observe cancellation after the executor's earlier check. Two new tests first failed (`final-boundary-red.log`, mocked spawn occurred); moved the final envelope check and added cancellation recheck after configuration consumption. Preserved earlier batch86 cancellation completion barrier.
4. Direct self-review found `await` on a synchronous untrusted session record could invoke a `then` getter/proxy before exact-shape validation. New test observed two traps (`session-boundary-red.log`); resolver now awaits only genuine host Promises. Final case rejects direct thenables/proxies with zero traps. Host code and native Promise execution remain trusted, not a general sandbox.

All failures and intermediate successful runs are retained. One correction per identified blocker; no exhausted repeated hypothesis. No new skip or test exemption.

## Final verification

Working directory: `daemon/`.

`npm run build` — **exit 0**, `build-final-bytes.log`.

```text
npx vitest run test/integration-claude-configuration.test.ts test/integration-claude-cli-executor.test.ts test/integration-claude-cli-owned.test.ts test/integration-claude-cli-protocol.test.ts test/integration-native-compiled-imports.test.ts test/integration-provider-installation.test.ts test/integration-provider-installation-binding.test.ts test/integration-account-binding.test.ts test/integration-runtime-contract.test.ts test/integration-driver-provider-lifecycle.test.ts test/p45.test.ts --fileParallelism=false --maxWorkers=1 --reporter=verbose
```

**Exit 0, 11 files, 98 passed / 3 existing skipped**, `regression-final-bytes.log`. The skips are the existing Windows OS cwd limitation and two opt-in installed-provider identity probes (`CUE_PROVIDER_INSTALLATION_LIVE_TEST` unset). No provider model or account request is performed. P45 includes existing local native AppContainer regression; installation/config positive cases use mock signature/assertion boundaries, and Claude process tests use fake children (with actual SQLite session registration in the owned case). Real Node compiled import passed.

Coverage includes missing/null/forged/reused/cross-attempt/cross-account/model/subject/worktree configuration; expiry/future/overlong TTL; selected profile membership; profile/directory/installation drift; junctions; ambient home, nonexplicit/extra environment and overlapping roots; getter/proxy traps; concurrent resolution; async launch mutation; abort/expiry before spawn; previous cancellation race; protocol/ledger/runtime/account guards.

Do not add counts from intermediate runs: they overlap. This is not a whole `npm test` result, live Claude login/compatibility/qualification, proof of OS isolation, remote termination/billing, or release acceptance.

## Remaining boundaries

- Production authorized session/account source and exact-version supported isolated layout remain unimplemented; the injected fixture callback is not a replacement.
- Candidate measurement/admission/registration, actual provider execution and independent cleanup/acceptance evidence remain open.
- One-use objects and per-resolver attempt fences are process-local; durable driver/restart ownership remains separate. Metadata checks are not atomic protection against a hostile write-and-revert race.
- Qwen remains OFF; subscription allowance remains 4/4 spent; model/provider/service/account requests in this batch: **0**. No commit/push/publication or unrelated cleanup.
- Independent review and original parent checklist closure remain pending. Existing history and preimages are preserved.

Closeout byte comparison detected that the edit tool normalized mixed newlines in `copy-assets.mjs`. Its exact preimage line endings were restored after asserting normalized content equality; the script now differs by only the intended import-relocation line. The final-byte build and all 11 files were rerun successfully (same counts). Document history byte checks and relative-link checks passed. This newline-only restoration is not an additional runtime change.

Current source/evidence hashes are in `pins.sha256`. New source files did not exist before this batch; existing-file preimages are under `preimages/`.
