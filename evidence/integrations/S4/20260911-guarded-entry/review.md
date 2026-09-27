# Independent guarded-entry review

Reviewer: broker_review; 2026-09-11. Verdict: PASS for the bounded ordering primitive. Product files were read-only; no model calls or actual project startup occurred. Completion gate: exact three-file hashes, independent focused tests, and explicit integration limitations. Diagnosed correction cap: 2; used: 0.

## Source identity

| File | SHA-256 |
| --- | --- |
| app/guarded-entry.mjs | 9A7E954B633259211B870D6BC6FA526F0CE65F48BAD7954C28B763AC78EE17C1 |
| app/guarded-entry.d.mts | FA94FE3B7392A3310BCB2FF5F7D87CA6AAD9B35C3D7CD5ECCED1876B1012FC8C |
| daemon/test/integration-guarded-entry.test.ts | 10C3EF61BA32E9B3500F04329FEE4DD0B6E2ED69737BE323EF8DD58A754BE7F8 |

## Independent gate

From daemon: `npx vitest run test/integration-guarded-entry.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`.

Exit 0, 4 PASS, start 21:52:04 KST, duration 1.54 seconds. Node success, loader failure, and file-drift subprocesses reject concurrent/repeated attempts. Actual Electron subprocess succeeds on the synthetic installation fixture. Runtime observations: Node 24.18.0 / ABI 137; Electron 44.2.0 / embedded Node 24.20.0 / ABI 149. Test helper and guarded-entry bytes are actual copied sources; native dependency bytes are explicitly synthetic and never loaded.

Maker build 0 was reported by the parent; no redundant independent broad build or native suite was run. An attempted read of implementation.md found no evidence directory yet; this did not affect source review or tests.

## Findings

No actionable correctness blocker within the declared primitive contract. Paths derive from the entry URL; caller paths/reset controls are absent. The attempt latch is set before loader validation/capture, so invalid, failed, and pending attempts remain consumed. Installation capture occurs synchronously before the loader callback. The awaited loader result is released only after assertCurrent succeeds. Returned wrapper is frozen; declaration preserves the loaded value generic and exposes the existing immutable installation guard.

## Limits and required integration

Exactly one attempt is per canonical module instance. Query aliases or alternative module identities can instantiate another latch; trusted startup must use the canonical URL as documented. This helper does not detect product/native modules already loaded before it, sanitize preload mechanisms, undo loader top-level side effects, or prove hostile write-and-revert absence. Entry/helper/builtins and exclusive installation management remain trusted prerequisites.

Future wiring must import this entry before product/native modules, load definitions inside its callback, initialize only after its post-load check, and retain guard checks at issuance/dispatch boundaries. No package main/default entry wiring, real project Electron startup, SQLite addon loading, qualification issuance, or workflow acceptance is established by these four tests.
