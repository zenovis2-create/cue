# Native DAG staging result

**Implemented and focused gates pass.** The coordinator now accepts only the exact dirty paths produced by completed, clean, committed earlier writer tasks in the same run. It derives each prior target from immutable publication/attempt/cleanup lineage, verifies the current publication root's identity, unchanged HEAD, complete Git dirty set, and native file hash. The Git factory reads prior bytes with a bounded native-snapshot/read/native-snapshot check against the committed SHA-256 and length, seeds a new detached worktree, pins the seed digest in the attempt-owned record, and reconciles inherited plus current approved paths before cleanup. No user repository commit is made.

Migration `051_attempt_staging_task_authority.sql` adds immutable task-specific root contract digests before approval. Its replacement setup trigger retains the 047 candidate, lease, account, plan, root, and factory checks, and accepts an exact current-task digest in addition to the historical first-task digest. Migration 047 was not edited. Root owns `openLedger` installation/definition checks and packaged asset copy; the driver maker owns preapproval insertion for every writer.

Two diagnosed correction hypotheses were necessary. First, 047's run-level first-task root digest rejected writer 2's staging setup. Second, `change_observation.observed_bytes` was never populated, so seed bytes must be read from the current root only under immutable committed digest/length and native identity checks. Both are fixed without accepting arbitrary dirty files.

Root-coordinated `npm run build` pass7 exited 0. My focused command from `daemon/`: `npx vitest run test/integration-staging-task-authority-migration.test.ts test/integration-staging-authority-migration-definition.test.ts test/integration-git-staging-inherited-publication.test.ts test/integration-git-staging-factory.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1` exited 0, **4 files / 18 tests**. The new real Git test proves inherited bytes in the detached second worktree, current-target separation, restoration of both paths before cleanup, and refusal of publication-root drift. Migration tests prove fresh/reopened install, tamper refusal, and exact packaged 051 bytes. I independently ran `npx vitest run test/integration-native-proposal-dag.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`: **1/1 passed**, including two serialized completed writers, two verified staging cleanups/committed publications, independent verifier, and persisted final acceptance. No provider/model/network calls were made; vendor transport was a labeled offline fixture.

Limits: This change does not itself choose approved task DAGs or checker authority; the host/driver owner binds those. Unknown/uncommitted prior publication, missing verified cleanup, changed HEAD/root, extra Git dirt, native file mismatch, or failed seed reconciliation remain refusals. An external process racing the workspace can still cause a refusal; this implementation does not silently adopt its bytes.

Final owned SHA-256 pins:

| File | SHA-256 |
| --- | --- |
| `daemon/src/orchestration/staging-authority.ts` | `fdb4c331711c7f657dfd514e6bec08c03cb198dbb664354096d852828f2f799e` |
| `daemon/src/orchestration/git-staging-factory.ts` | `17b2b3f153c9903fcec5a3f0b8bb5e8559814d8354780c96cdf386e1efb79479` |
| `daemon/migrations/051_attempt_staging_task_authority.sql` | `ba4c94d715773bd9175b209671779f699b612b74b78cb0fc9fbfd2dcafcd68ca` |
| `daemon/test/integration-git-staging-inherited-publication.test.ts` | `dd6d97d7c6a14cc8a9f667c81d91bbf69738b6bcdedce32fb40c883b149d0bec` |
| `daemon/test/integration-staging-task-authority-migration.test.ts` | `b5f441b81e171f704f15fdbadbe7330d2c8dc09b8c9408d115315e1921d1067e` |
