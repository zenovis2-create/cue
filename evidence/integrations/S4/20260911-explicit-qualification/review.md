# Independent explicit qualification review

Reviewer: broker_review, 2026-09-11. PASS for the new protected operation and maker-added collector guard hook. Completion gate: focused offline tests, five source hashes, and bounded contract review. Correction cap 2; used 0. Product files read-only; Qwen requests 0.

The reviewer previously authored the collector foundation. This is an independent review of reuse_pure's new operation and guard/abort/deadline issuance delta, not a new independent certification of the reviewer's original collector implementation.

## Independent gate

From daemon: `npx vitest run test/integration-qualify-generated-json.test.ts test/integration-model-qualification.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`.

Exit 0, 16 PASS, start 22:13:38 KST, duration 59.08 seconds. App operation tests use explicit module mocks with a real temporary AppDaemon/SQLite. Collector tests execute real controlled Windows diagnostics with fixture transport/subject, force fixture evidence, and make no Qwen call. Maker build 0 is attributed to implementation.md; no redundant build was run.

## Source hashes

| File | SHA-256 |
| --- | --- |
| app/qualify-generated-json.mjs | ACBDA3264BB80D6124DB15F7D0F95191F134F77342DE06C2750E4B1C98202D04 |
| app/qualify-generated-json.d.mts | 71E4CE1657DFFC7BEB2434AA478A7F521EFFB1C99005B7772BAB5D00CE9DEEED |
| daemon/src/model-qualification.ts | CD5FAD3BAAEDEDA5D0F13B74465BE0BF5506B7FA63420D6B037E28FBA87B84AE |
| daemon/test/integration-qualify-generated-json.test.ts | ED3AD0DB21442823FB247C1804B96F71D1CF3B48DD2EAD0BB570D4ACB46BC991 |
| daemon/test/integration-model-qualification.test.ts | 637C3A5CA319A0792D53F049C5C52878C92E0F5A8BD96AE847980C47A535EAA9 |

## Contract findings

No actionable blocker within the protected host API scope. Exact own-data input schemas reject proxies/accessors/extra fixture seams. Authentic generation membership and AppDaemon identity are required; the same open ready daemon DB must match the real configured ledger path. Install/dependency roots match generation roots, control root matches compiled source location, and loaded host path/runtime/version match this process. Nested descriptors are copied and frozen; one operation per daemon binds the full signature and generation identity.

Construction launches nothing. Collect retains one Promise after success, failure, or pre-abort; no reset/retry is exposed. Only the default collector factories are used. Checker must return live, eligible, clean, failure-free before model starts; abort or current-generation failure stops progression. Collector exceptions report unresolved cleanup without closing the caller DB. Caller must await and close in finally.

The new collector hook requires synchronous true when supplied and runs before collection and inside the immediate issuance transaction. False, Promise/thenable, or exception cannot issue evidence. Immediately before writes, journal bytes are rechecked, the guard runs, and abort plus the original 180-second deadline are checked. The new actual diagnostic fixture test confirms issuance-time drift leaves raw artifacts while capability rows remain zero. Historical rows are not relabeled. Existing collector compatibility permits omission of this hook; the new public host operation does not.

## Limits

WeakSet membership proves module issuance, not pre-import freshness. Actual guarded-entry ordering remains a separate mandatory integration condition. This API does not brand a protected-installation descriptor: root/control/current-host bindings are checked here, native path membership and fixed PowerShell constraints are delegated to subject measurement. config.worktreeRoot and task/profile root descriptor fields are validated and signature-bound but are not used by this collector, whose existing owned diagnostic paths remain fixed. This review does not claim those unused paths equal AppDaemon ownership paths.

Mocked live-shaped results are not live qualification evidence. No actual project Electron startup, real loaded SQLite closure, current live M issuance, workflow acceptance, billing, or performance proof is established here. Model-request bound is one per operation/daemon instance; it is not a cross-restart durable quota. The earlier canary's two-request allowance remains exhausted.
