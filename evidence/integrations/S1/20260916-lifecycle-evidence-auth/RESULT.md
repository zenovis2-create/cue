# Unit 1 maker result

Status: reviewer corrections applied; implementation frozen for final independent review.

The production driver now serializes lifecycle admission per attempt. It validates a bounded, descriptor-only lifecycle snapshot before enqueue, so indexed getters, hostile kind coercion, and compact shared graphs cannot execute or expand at the boundary. `provider-terminal` and `billing-finalized` require one `provider-receipt` reference and a deployment verifier verdict bound to the resolved evidence bytes, receipt SHA-256, catalog provider/revision, persisted account reference/digest, current subject digest, and exact run/task/attempt/candidate. Immediately before append, the transaction re-reads the running attempt, current catalog evaluation, and persisted account identity. Missing, invalid, non-final, mismatched, changed, thrown, or timed-out verification appends no lifecycle row. Cancel request and client acknowledgement remain separate observations and cannot create provider terminal or billing finality. Projection authority remains zero.

This is an offline admission seam. It does not qualify a real provider, authenticate any historical fixture, or close S1-04/S4-01.

## Gates

- Focused command after reviewer corrections: 2 files, 20/20 tests passed. This includes real public-driver callback tests for delayed mutation, ordered terminal/billing callbacks, missing verifier, current-subject drift, persisted-account mutation, close during verification, accessors, and compact shared graphs.
- Retained driver synthetic provider evidence and binding-conflict rollback: 2/2 passed; the rollback assertion counts terminal/final rows separately from valid cleanup observations.
- `node --check app/orchestration-driver.mjs`: exit 0.
- Focused `git diff --check`: exit 0.
- `npx --no-install tsc --noEmit`: exit 0 after the coordinated build.

## Final SHA-256 pins

| Path | SHA-256 |
| --- | --- |
| `app/orchestration-driver.mjs` | `92f214c340fd0fe330ee3c042c392da8fe2854c6009ef0d35a179f5490c05527` |
| `app/orchestration-driver.d.mts` | `a7081dde45f57c229ccd763c987b43659872ac642919cfc2035d3f17bbe0d9be` |
| `daemon/src/orchestration/provider-lifecycle-evidence.ts` | `9481e6f13622bcc039ae4fdae9207f83344371537400c0b3b67b2d3b42359c3d` |
| `daemon/test/integration-provider-lifecycle.test.ts` | `67fcdeb85b5c6d27b359de0587a54d99e999cb05acf842e771b1068c778c1bda` |
| `daemon/test/integration-driver-provider-lifecycle.test.ts` | `6663c4ecde343fc6ece9ea7c1ac72fc7890b9ea4fd055fa208d2635d9f1fa423` |
| `daemon/test/integration-driver.test.ts` | `d5dbe8445b045416fd8004f4c0e68ddb2f7f8a0cc0c91b1fa9a98c9a882a8623` |
