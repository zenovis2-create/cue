# Independent review — outcome collection

Verdict: PASS for the bounded historical evaluation-input backend on the final hashes below. This is not a live execution, performance evaluation, cohort enrollment, policy promotion, or provider billing proof. Reviewer: broker_review; implementation: reuse_pure. No product edits, rebuilds, model calls, native helpers, or historical ledger repairs were performed by this review.

## Final verification

- `npx vitest run test/integration-evaluation-outcome.test.ts test/integration-evaluation.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`, cwd daemon: **22 PASS**, 2 files, 2026-09-12 02:01:51 KST, 1.97 seconds (tool a13c67). Ten collection tests and twelve comparison tests.
- `npx tsc --noEmit`, cwd daemon: exit 0 (abbe49).
- Source and test hashes independently match the maker's final receipt. Current compiled JavaScript exists after the root's final shared build (92c055); its hash is recorded separately, not asserted equal to TypeScript.

| File | SHA-256 |
| --- | --- |
| daemon/src/evaluation/run-outcome.ts | F78128B66F3FEB4194F847349F19D74B875FF18D97F271C2BE03E9C2C366A072 |
| daemon/test/integration-evaluation-outcome.test.ts | 49DEE4CF2670D667D62D5EB8A2BE7BD128ED0CC8DD6DA344B44F5E09EEAF9B1D |
| daemon/dist/src/evaluation/run-outcome.js | E08A91956196543DB2E2BE91DDAA20BAF422522FCE5663B978AA3118698AA714 |

## Contract findings and resolution

The collector rejects an existing transaction and opens its own synchronous SQLite read snapshot. Missing runs return null; malformed, contradictory, corrupt, or over-limit stored evidence returns a fixed unavailable result. It uses existing strict policy, plan, selection, and acceptance readers. A completed parent alone is insufficient for success: strict historical acceptance is required, and accepted evidence conflicting with parent state or cancellation is rejected. Failed attempts remain in history; cancellation is labeled from the stored cancel marker and does not imply clean completion.

SQL preflight covers the enumerated validator inputs before their readers materialize payloads, including repeated acceptance blob references. The real missing orchestration_step row/byte preflight was corrected and has an independent overflow regression: 4097 steps with no attempts returns coverage-limit before the invalid plan is read. Limits are 1024 attempts, 4096 enumerated source rows, 8 MiB enumerated payload/blob/path/step strings, and 1 MiB public output. These are not a blanket database-size, CPU-time, or filesystem-time bound.

Valid namespaced task and candidate identifiers retain actual plan membership checks and are projected to null plus digest when their text is unsuitable for publication. Independent review also found raw policy.id could publish a valid slash-containing policy ID. The maker's second bounded contract correction applies the same null/idDigest projection. The final real-SQLite namespace regression includes policy/private and verifies its text is absent while the policy binding remains valid.

Accounting keeps local committed dispatch intents separate from monetary units; it does not manufacture a currency, price, or actual provider-call count for local work. Monetary reservations/receipt payloads are checked against indexed lineage and revisions. Latest actual receipts are not double-counted, missing actuals remain null, and final coverage requires every attempt's reservation and final actual receipt. Partial known actual totals are not presented as complete final costs. Cost breakdown, quality and elapsed time remain unmeasured/null; conversion to a trial is explicitly unavailable.

The result is deeply frozen and digest-stable across repeated reads/reopen. Tests cover unchanged SQLite total_changes, acceptance corruption, contradictory state, policy corruption, outer transactions, strict getter-free inputs, retries, cancellation, unknown billing, namespace privacy and both overflow paths. Comparison tests retain descriptive-only behavior and no promotion eligibility.

## Limits and preserved history

The strict acceptance reader may call realpath through the stage-envelope reader. Therefore this backend is not filesystem-free: deleted or inaccessible historical stage paths can make the observation unavailable. It does not invoke a new OS process/native helper or model. Stored cleanup flags are historical evidence, not a new OS absence observation. The source digest covers the public safe projection, not the entire ledger or installation generation. Safe-looking identifier strings are permitted metadata; this is not arbitrary semantic secret detection.

The earlier proposed stage_run_id extra-join was withdrawn after checking that the strict binder requires stage_run_id to equal the attempt ID before reading the child. No unnecessary join or weaker strict reader was retained.

Maker history is preserved in result.json: two initial fixture failures (FK-bound corruption fixture, duplicate stage-attempt overflow fixture) preceded 21 PASS. A separate bounded production correction addressed step preflight and namespace compatibility, reaching 22 PASS. Independent review then diagnosed the policy ID projection issue; the final correction above also passed 22 tests and typecheck.

The previous independent gate at 01:57:21 KST passed 22 tests in 2.01 seconds on source A7DB1D39483082786F717F3BE1CAE529E970EBE88FD24054910EB6BDE9DBAC53, test 41AB862D2415363DFF614AD99C1D35E76C629FB18910A7612C192F79B9FD77B6, compiled 54753DB5C3FCD300C3F0F5C6C8D7BB860642FC2DE37258B46FEF707F09838524. An actual compiled-module in-memory smoke confirmed 4097 steps returned coverage-limit without changing total_changes. Its surrounding audit command exited 1 only because the reviewer additionally requested a nonexistent declaration file; tsconfig does not emit declarations. This was an audit-script assumption, not a product failure. Those earlier hashes and smoke are historical and do not replace the final source-bound gate above.
