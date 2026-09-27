# Independent review — recovery observation integrity

Verdict: **PASS for the bounded backend integrity fix**.

The frozen change closes the authority gap. A failure observation is copied from exact own data before clock or proof callbacks can mutate it. The four classification fields that influence retry/replan decisions are persisted under `cue-recovery-classification-v1`: `retryableHostCode`, `quotaResetAtMs`, `independentQualityFailure`, and `priorCandidateEligible`. Decision creation decodes the complete canonical outer record and nested authority, rereads current observation/proof availability, requires exact authority and proof-digest equality, and derives decision facts from the saved authority. Alternate-candidate status is observed once, frozen, and reused.

The existing migration-required outer schema remains `cue-failure-observation-v1`; no new migration or unsupported schema version was introduced. A historical observation without classification authority cannot create or replay an active recovery branch. A previously persisted stop remains a safe sealed result.

## Evidence and pins

- Final source SHA-256: `daemon/src/orchestration/recovery-policy.ts` = `bd35e5d614da53a031320ac81196b296b8f81cfcc4c9a756f03fd744b19f502f`.
- Final test SHA-256: `daemon/test/integration-recovery-policy.test.ts` = `9b91729b79f689e04ca1e2fb9db01794a822f932136db5bba026114237d5ef6d`.
- Both full byte preimages match `final-pins.json`: source `06eb66d823b26648ce471f2b5e23a2b95942cf859bd4b36772ffb5855e8ea5cb`; test `4af2a98ce22eeb1ca2b5150eeba06619d3c43b5075fbf57aab744722b3e32be5`.
- All eight maker preimage, final-source, and raw-log hashes were independently recomputed with zero mismatches.
- Maker revision 2 build is valid against the frozen hashes and exited 0. Its four-file gate passed 80/80.

## Independent gate

From `daemon/`:

`npx vitest run test/integration-recovery-policy.test.ts test/integration-recovery-claim-limits.test.ts test/integration-replan-budget.test.ts test/integration-driver.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`

Result: exit 0; 4 files passed; 80/80 tests passed. Raw output is `logs/independent-gate.log`, SHA-256 `3cd0e526449385759bc6fa704cf83b1096061de41d32c95b00f69bf432ce5ad3`. The separate exit receipt is `logs/independent-gate.exit`, SHA-256 `c1e97067c5f479a44a6f57297a0a8f87a59d181c3c529910f8bf059094bc3abb`.

The focused tests exercise classification promotion and demotion, mutation after callback return, proxy rejection without traps, missing/malformed/extra durable authority, one-call candidate observation, proof continuity, attempt and budget races, cumulative claim limits, replanning limits, and connected driver recovery regressions.

## Qualification boundary

This PASS covers injected host observations and the durable recovery policy path. It does not qualify a real provider's failure classification, proof source, credentials, native process observation, UI, Electron, local model, server, or network behavior. It does not close broad S4 completion or establish that any production host currently supplies these trusted classification facts.
