# Batch97 — default-app local contract producer

2026-09-22. Direct implementation and self-review; no independent review.

## Implemented

- New `daemon/src/evaluation/local-contracts.ts`: fixed local producer, no injected measurement/clock/provider callbacks. Reads actual Node OS/process version fields and bounded regular-file bytes of its own code and the native existing-file checker. Checks FD/path identity, byte limits/EOF and observed metadata changes. Measures disk bytes, not loaded memory or all executable dependencies.
- Code-bound exact-artifact0..1 metric definition and actual local environment snapshot, registered through existing immutable tables. No migration. Same metric definition reuses original revision/time; each explicitly requested environment observation gets a host-generated revision.
- Environment is permanently `complete:false`, `local-process-at-capture-only`, with missing execution input/sandbox/provider/model/account/price/contention. A declared metric is not a collected quality score. All result readiness/promotion flags remain false.
- Default `Core.captureLocalEvaluationContracts()` works without measuredFactHost. Existing injected measurement-host paths remain untouched. This producer does not invoke them and does not manufacture account/price/fact evidence.
- Exact field-free `local-contract-capture` IPC and safe reference-only output. Raw local OS/code metadata remains in the ledger, not renderer output. Getters/proxies/authority upgrades fail closed.
- Explicit UI capture and separate metric/environment-reference copy button; no automatic capture/enrollment/approval/execution. Account reference fields remain untouched. Pending/stale/error handling and incomplete/partial-save disclosure.
- Registrations are individually immutable, not a two-table atomic bundle. Failure of environment registration may leave the metric saved. Failure is exposed without deleting records or auto retrying.

## Verification

Final commands from daemon/: `npm run build`, then `npx vitest run <37 paths in test-files.txt> --fileParallelism=false --maxWorkers=1 --reporter=verbose`.

- `build-final.log`: exit0.
- `regression-final.log`: **37 files /326 passed /0 failed /0 skipped /0 unhandled errors**, exit0; start21:01:20 +09:00;146.75 seconds.
- New suite: **10 tests**. Actual local OS/process and TS/compiled-JS disk-byte hashes, real temporary SQLite/Core, immutable replay/reopen, invalid/backward clock, transaction boundary, injected environment INSERT failure with surviving metric, strict/redacted IPC, actual JSDOM→structuredClone→IPC→Core→SQLite capture and explicit reference copy, failure/stale-response behavior.
- The UI prepared-run response is synthetic to exercise form availability; the local observations and persisted contracts themselves come from the real fixed producer. No provider, model, login, account, native tool or service call is made by this capture.
- Reconciliation and exact source/test/build/doc/preimage/log pins in `summary.json`, `pins.sha256`, `pins-verified.log`.
- Prior focused3-file44pass/1fail and subsequent local10pass overlap the final run and are not additive.

## Preserved failure

`focused1.log`:1 failed/44 passed. The new DOM test submitted a goal immediately after renderer startup, before asynchronous selection preferences completed. The existing preparation guard correctly refused it; the expected prepared run never appeared. `startup-race-source.ts` preserves the exact failing test.

One correction hypothesis: wait for the selection initialization status before submitting. Test-only synchronization fix, no product guard/timeout/skip relaxation. `focused2.log`:10pass, then full selected final37/326pass. No second hypothesis needed.

## Scope and remaining work

This completes only the default-app local contract source, not a production measuredFactHost. complete:false intentionally blocks ready-trial conversion. The next code work is execution-input evidence bound to approved goal/seed/checker contract and actual attempt staging/launch, then verifier quality, queue-through-cleanup timing, complete execution context, observed account/price/final cost evidence and host composition.

Disk-code hashes do not prove the code currently loaded into process memory, full dependency integrity, provider compatibility or sandbox qualification. Node os.arch reflects the Node binary architecture, not an independently observed physical CPU/kernel. These distinctions are documented.

No whole-suite rerun: batch89 full regression predates90–97. Native Electron/manual acceptance, assistive-technology audit, independent review and representative live paired evaluation remain open. Final tests do not cover every filesystem fault injection branch or establish live measurement quality.

Original checklist33/44 closed,11 open; Qwen OFF, subscription4/4 exhausted, real service/model/account calls0. No credential/home edits, commit, push, publication or unrelated cleanup.
