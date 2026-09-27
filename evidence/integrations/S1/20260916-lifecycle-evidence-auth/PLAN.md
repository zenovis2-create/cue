# Unit 1 lifecycle evidence admission plan

## Done contract

Provider-terminal and billing-finalized lifecycle rows are appended only after a deployment-supplied verifier authenticates immutable evidence bytes and echoes the exact receipt reference/digest, provider/account, current subject, and run/task/attempt/candidate binding. Missing, malformed, non-final, mismatched, mutated, thrown, or timed-out verification appends zero rows. Client cancel acknowledgement remains non-terminal. Projection authority stays `{processKill:0,budgetRelease:0,acceptance:0}` and this offline unit does not claim live provider qualification.

## Attempt contract

- Edit-pass cap: 2.
- Every pass: `npx --no-install vitest run test/integration-provider-lifecycle.test.ts test/integration-driver-provider-lifecycle.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` from `daemon/`, then `npx --no-install tsc --noEmit`.
- A failure requires a new hypothesis. Keep a change only when the focused gate improves; otherwise revert the Unit 1 hunk or hand off.
- Independent review is owned by the root agent; the maker does not score its own work.

## Exact filesystem preimages

Captured before Unit 1 edits at Git HEAD `8e2afa6366e3af62f7115b2c67be799130f8dfdf`:

| Path | State | SHA-256 |
| --- | --- | --- |
| `daemon/src/orchestration/provider-lifecycle.ts` | untracked working-tree file | `56334581ae3d72fefb7c4ee4b642223a54c418012939ac5a16ba338818826a9b` |
| `daemon/test/integration-provider-lifecycle.test.ts` | untracked working-tree file | `a335718c92498a24967c18ee0044d2f9bbf1f8cc76e4809afbe2a8a8a3fa0755` |
| `app/orchestration-driver.mjs` | untracked shared working-tree file; frozen for `staging_cleanup71` | `dbab79d0ad1e0cfeb373fc6b40a89d5436374897e26ed0bcbdbab0230c2ce8a6` |
| `daemon/src/orchestration/provider-lifecycle-evidence.ts` | absent | n/a |
| `daemon/test/integration-driver-provider-lifecycle.test.ts` | absent | n/a |

The shared driver will receive only the coordinated `recordLifecycle`/composition hunk after explicit handoff. Staged-cleanup functions are out of scope.

The explicit post-cleanup handoff preimage used for the Unit 1 hunk was `ee129d31d86dd4aed36e9cccfa1fa8d9f2baa0f28338a4a86e43354edea5d4ab`. The retained cleanup call is `stagingCoordinator.cleanupActive(deferred)`.
