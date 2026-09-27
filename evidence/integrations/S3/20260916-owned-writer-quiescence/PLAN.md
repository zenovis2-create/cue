# Owned writer quiescence gate

Scope: add a model-free Windows integration test that launches a real Node writer in the Git staging worktree and exercises the public orchestration driver, real Git staging, native staged-file publication, and the native owned-writer quiescence gate. No provider, Qwen, unknown Codex binary, application driver, engine, or product edit is in scope.

Done means the focused test records the launched process PID and OS creation time, proves the writer is in the isolated execution worktree, and proves a matching-live or unknown writer prevents staged reconciliation, cleanup, receipt finalization, and lease release. After the exact process identity is observed exited, native restoration and staging cleanup must complete before publication reconciliation and lease release. All temporary roots must have an exact trusted prefix and be removed after child exit.

Attempt cap: 2 implementation passes.

Every pass runs only:

`npm --prefix daemon test -- --run test/integration-owned-writer-quiescence.test.ts`

The root agent owns the coordinated shared build after source freeze. This worker will not run it.

On failure, the next pass must use a different concrete hypothesis. If the second pass fails, stop and hand the logs and three-line failure summary to the root agent. Keep a change only when the focused gate improves.

Maker and checker are separate: an independent source-bound review is required after the source and evidence are frozen.
