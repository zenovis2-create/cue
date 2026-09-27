# Current frozen source regression

Root independent final gate, 2026-09-12. Product makers frozen before UI preflight. No model, provider or native executor calls.

Command from `daemon`:

```text
npx --no-install vitest run test/integration-recovery-policy.test.ts test/integration-retry-backend.test.ts test/integration-budget.test.ts test/integration-local-invocation-budget.test.ts test/integration-evaluation-authoritative-accounting.test.ts test/integration-evaluation-measured-facts-core-containment.test.ts test/integration-driver.test.ts test/integration-acceptance.test.ts test/integration-acceptance-history.test.ts test/integration-generated-output.test.ts test/integration-generated-acceptance-host.test.ts test/integration-change-records.test.ts test/integration-held-recovery.test.ts test/integration-integration-verification.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
```

Exit 0, 13 matched files, 127/127 passing, 28.73 seconds (`8d2ad2`, `70a0a7`). The final filter in that command was misspelled and matched no file. Root checked the actual filename and ran the omitted suite separately:

```text
npx --no-install vitest run test/integration-verification.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
```

Exit 0, 1 file, 2/2 passing (`95c57d`). Total distinct coverage: 14 files, 129/129. This does not include all repository tests or real end-to-end execution.

Final authoritative-accounting source SHA-256: `a6668c3d20d6b8fb963b4957c488197f7918a62088478246532f8831823a5935`.
Migration 037 source and copied asset both: `40db0af5db2aad8bce52a4dfed1219a2a1ec68ba4a11d8e447237044d10c927a`.

Semantic scope remains the separate independent reviews: accounting is disconnected/read-only; journal/recovery is disconnected groundwork with filesystem race limitations; integration inspection always returns unknown and SQL pass is disabled. Full release completion is not established.
