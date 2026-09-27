# Independent review: Claude process launch boundary

Verdict: scoped architecture fix passes. The current `claude-cli-executor.ts` SHA-256 is `B384BB8AF24A907D8C65F34B8D3B7FA0FBFDF74CF64191B0B08B9AA0C944D217`. The saved preimage SHA-256 is `0860253FA0C23F34AB4C1726EA9570A147944F79EA1C1F6A91994A200E5944D3`. Comparing those files shows only removal of the `node:child_process` type import and inlining the unchanged spawn options at the `spawnOwned` call. `spawnOwned` in `daemon/src/process-launch.ts` remains the launch and durable session ownership boundary. No new direct spawn path or lifecycle change was introduced by this patch.

Independent built-graph commands, both exit 0:

- `npx vitest run test/p45.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`: 4 passed, 1 platform skip. This includes the S-1/S-3 child-process-boundary check that had failed in the broad tail.
- `npx vitest run test/integration-claude-cli-protocol.test.ts test/integration-claude-cli-executor.test.ts test/integration-claude-cli-owned.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`: 19/19 passed.

Root's coordinated `build-post-claude.log` records build exit 0. These checks use local fixtures and owned fake processes; they do not establish live Claude qualification or exercise a provider, account, or network call. No concrete defect found in this bounded change.
