# Independent local selection policy review

Code/focused verdict: PASS after one diagnosed maker correction. Shared build/compiled registration gate pending unrelated concurrent type errors; see final follow-up when complete.

The initial 022 binding guard allowed first binding to a real run with write_in_progress=1 when no approval or orchestration attempt existed. Actual compiled Node reproduction returned firstBindingWhileWriteInProgress:true (tool 9b900d). Maker added the separate local_policy_execution_guard: write flag, legacy execution_event and session_handle all reject first binding. Its additive name also upgrades an already-initialized earlier draft trigger set. Independent source review accepts this correction; API and direct SQL regression covers each fence and retains exact existing binding replay after execution starts. Task state running alone is intentionally not used as a proxy for approval/execution.

Independent focused gate: `npx --no-install vitest run test/integration-local-selection-policy.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`, exit 0, 8 passed, 387 ms at 2026-09-11 21:18:20 KST (tool 01cfcd).

Exact version/mode/IDs/limits schema uses descriptor-only data and rejects proxies/accessors/extra monetary fields. Four modes retain a fixed distinct producer/checker candidate pair; selectLocalCandidate states ranking:not-performed and authority:none and requires each current host-supplied check. It does not observe capabilities or establish independent principals itself, infer prices/quality, or optimize among models. Those host checks cannot be treated as model-supplied proof.

Canonical frozen snapshots and metadata hashes are checked on read. Persisted CAS and safe revision bounds protect append updates; SQLite triggers prohibit update/delete/replace. Binding resolves exact policy ID/revision/digest and is replay-only thereafter. Caller transaction rollback removes first bindings. Bidirectional SQL exclusion prevents a run from simultaneously receiving monetary and local policy bindings without changing historical monetary JSON. Reopen preserves exact policy versions. Schema/hash corruption paths were inspected; this focused suite does not inject every stored corruption or stress simultaneous connections, and no privileged-database rewrite resistance is claimed.

Reviewer made no product edits and no model calls.

Hashes:
- daemon/src/selection/local-policy-store.ts SHA256 8D7130AF42EB86EC18DBCCA3D34534D583AAAB14BE03EE19E6EB64CFB0F8296C
- daemon/migrations/022_local_selection_policy.sql SHA256 1CD81753DF3FDF0DBAD668C4F927C71A5978636F17327067AE37BB41E7B2825A
- daemon/test/integration-local-selection-policy.test.ts SHA256 DBDBAB7E9C0D923D61EFCB03C04E01D490034759528DC86A7D33CA2A31F2E726

## Final shared build gate

Final `npm --prefix daemon run build`: PASS, exit 0 (tool 92e82d), after owning makers confirmed their concurrent type corrections. The first attempted root-level `npm run build` had no script and did not execute a compiler. The first daemon build then failed on unrelated engine.ts:145 acceptance literal typing and integration-local-host-settings.test.ts:45 narrowed accounting typing; no asset copy ran on that failure. Those actual failures are retained here rather than reported as a first-pass green build. No source changes or broad regression rerun by reviewer.

Actual Node ESM import of current compiled openLedger, temporary disk database open/close/reopen, without manual migrations: PASS (tool 8127fc). Both local_selection_policy_snapshot and local_selection_run_policy exist, and additive local_policy_execution_guard exists after reopen. Migration 022 source and built copy match byte-for-byte: SHA256 1cd81753df3fdf0dbad668c4f927c71a5978636f17327067ae37bb41e7b2825a. Final bounded review verdict PASS, with the fixed-pair/host-check scope described above.
