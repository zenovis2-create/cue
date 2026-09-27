Done: an actual temporary Git coding change publishes once, then an authority-derived exact-target reconciliation restores the execution worktree and permits verified cleanup. Extra/mismatched changes retain the worktree and lease.

Attempt cap: 2 implementation passes.

Every pass: `npm test -- --run daemon/test/integration-git-staging-factory.test.ts daemon/test/integration-git-staging-driver.test.ts` from `daemon`, then `npm run build` from `daemon`.

Failure handling: retry only with a new hypothesis; otherwise preserve the locked worktree and hand the unresolved evidence to the root agent.

Rollback: exact pre-edit bytes and SHA-256 hashes are stored in `preimage/`; restore only these owned files if the measured gate regresses.
