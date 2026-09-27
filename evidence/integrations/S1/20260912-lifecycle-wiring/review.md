# S1 Unit 3 lifecycle wiring — independent review

Recorded: 2026-09-12 KST  
Reviewer verdict: **PASS (bounded offline component)**

No unresolved correctness finding remains at the reviewed hashes. This verdict covers the Unit 3 runtime/driver lifecycle seam and its SQLite-backed projection. It does not establish a live Codex/provider terminal state, provider death, billing finality, native/Electron behavior, remote/network behavior, P13, or completion of the wider M-gate.

## Reviewed contract and scope

- Read `DONE-CONTRACT.md`, maker `RESULTS.md`, the runtime implementation and declaration seam, driver wiring, provider-lifecycle store/projection, and their focused tests.
- Did not call a real Codex binary, provider, model, native/Electron surface, network, or worktree.
- Independently exercised the frozen Unit 3 source with the combined runtime/driver/provider/engine gate and a reviewer-owned hostile fixture.

## Initial findings retained

The first inspected revision was blocked on three concrete boundaries:

1. `RuntimeHost.recordLifecycle` permitted an async result even though a runtime timeout cannot cancel arbitrary side effects inside a trusted host promise.
2. Adapter-submitted `references` reached an array `.map` before a descriptor-only snapshot, so a hostile nested accessor could execute.
3. The driver appended the lifecycle event and reference bindings in separate transactions, so a later binding conflict could retain the event and an earlier binding.

Correction 1 resolved each finding. The final host persistence callback is synchronous, references are densely snapshotted before local iteration, and the driver wraps event plus every reference in one outer immediate transaction. The failed initial assessment remains part of this review history; it was not treated as passing evidence.

## Final source assessment

- `daemon/src/integration-runtime.ts:9-27` recursively snapshots plain data using descriptors, rejects proxies/custom prototypes/accessors/symbols/sparse arrays, and bounds depth, keys, and strings before any adapter-owned nested value is iterated.
- `daemon/src/integration-runtime.ts:81-82,140-173` defines host lifecycle persistence as synchronous, queues at most 256 writes, closes continuation after a sink failure, accepts only adapter-owned `provider-terminal` and `billing-finalized`, and rejects forged cancel/cleanup/seal kinds at runtime rather than relying on TypeScript.
- `daemon/src/integration-runtime.ts:220-240` records one cancel request and records client acknowledgement only after the owned adapter cancellation resolves. Acknowledgement does not create provider terminal, cleanup, billing, or success evidence.
- `daemon/src/integration-runtime.ts:242-275` accepts only run/subject-bound cleanup receipts, bounds cleanup observation, leaves timeout/failure as unknown, and cannot be changed by a late verifier result. Local cleanup only emits `cleanup-observed`.
- `daemon/src/integration-runtime.ts:296-330` observes late launch/control failures, keeps ownership, and never turns cancellation or local cleanup into successful execution.
- `app/orchestration-driver.mjs:100-115` derives run/task/candidate scope from the persisted running attempt and commits the event and all reference bindings in one immediate SQLite transaction.
- `app/orchestration-driver.mjs:346-350` reopens the durable projection by trusted attempt scope. The focused reopen test observes no new launch or resend.
- The supported persistence boundary is intentionally synchronous. The runtime cannot cancel arbitrary side effects hidden inside an unsupported async persistence callback. The actual product driver path is synchronous SQLite persistence, so this limitation does not create a late driver write within the declared host contract. Async cleanup verification remains bounded; only runtime acceptance is fenced.

## Independent hostile evidence

Reviewer fixture: `review-hostile.test.ts` with `review-vitest.config.mts`.

- Nested reference accessor: rejected with `runtime_lifecycle_input`; `getterHits=0`, host writes `0`.
- Nested reference proxy: rejected with `runtime_lifecycle_input`; all configured proxy traps remained `0`, host writes `0`.
- Synchronous host sink throw with two already queued emissions: both promises rejected, sink calls `1`, `unhandledRejection=0`.
- Cleanup verification timeout: returned `unknown`; a later valid-looking clean receipt changed neither runtime state nor lifecycle write count.
- Lifecycle bound: exactly 256 serialized writes were accepted; write 257 rejected with `runtime_lifecycle_closed`.

The product tests independently cover distinct cancel request/acknowledgement, no fabricated provider evidence from completion, forged internal-kind rejection, fail-closed sink behavior, pre/during/late cancellation ownership, event/reference atomic rollback, durable reopen with zero launch/resend, lifecycle ordering/replay/terminal rules, and local-cleanup separation from provider death/billing.

## Commands and results

Independent combined regression:

```text
cwd daemon
npx --no-install vitest run test/integration-runtime-contract.test.ts test/integration-driver.test.ts test/integration-provider-lifecycle.test.ts test/integration-engine.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
4 files / 75 tests PASS / exit 0
```

Independent hostile fixture, final run:

```text
cwd daemon
npx --no-install vitest run --config ../evidence/integrations/S1/20260912-lifecycle-wiring/review-vitest.config.mts --reporter=verbose --fileParallelism=false --maxWorkers=1 --testTimeout=5000
1 file / 4 tests PASS / exit 0
```

Independent typecheck:

```text
cwd daemon
npx --no-install tsc -p tsconfig.json --noEmit --pretty false
exit 0
```

Maker build evidence in `RESULTS.md`, bound to the same five Unit 3 hashes below, reports `npm run build` exit 0. Per the review assignment, the build was not duplicated after verifying those hashes. A concurrently owned S3 backend changed after the independent 75-test run; it did not change any pinned Unit 3 file.

Reviewer harness setup produced two non-product startup failures before the final run: the daemon config excluded the out-of-tree fixture (`No test files found`), then the first reviewer config attempted to resolve `vitest/config` from the evidence directory. Neither attempt executed source tests. The final plain-object config above resolved the harness and passed 4/4.

## Reviewed hashes

| File | SHA-256 |
|---|---|
| `daemon/src/integration-runtime.ts` | `6210DA7F01CFE0841D94A1D172E6FFA968BF1503A97BFDBC3F3E6A67EBA8B982` |
| `daemon/test/integration-runtime-contract.test.ts` | `E5EB285AE147992B58EA65BC95F549ED4DD2D33CEEE48C32A9FB7AACC30A75AB` |
| `app/orchestration-driver.mjs` | `0141082B48CCC9B1731627E847EF604FD89F100A0B7623686F5AC6AFE7B8E7E4` |
| `app/orchestration-driver.d.mts` | `3468C9A1C4E0249D5479D130584BF806AAE8076456F60294DF1DCBCD7EF5C8E8` |
| `daemon/test/integration-driver.test.ts` | `587560F0E7B24D0AF0830D4DFD50C8346F92A8128702A30045D364590AC86F3D` |
| `daemon/src/orchestration/provider-lifecycle.ts` (review dependency) | `56334581AE3D72FEFB7C4EE4B642223A54C418012939AC5A16BA338818826A9B` |
| `DONE-CONTRACT.md` | `854BCFB2AB99A9A2B57BD93B7BE096B8AEEAE8D8212406CD7488EC36293F94D0` |
| `review-hostile.test.ts` | `AAF0539D2722F98842BD9EFF4D8A137ED7E8A1D9C0500B7BD293EE197D510AED` |
| `review-vitest.config.mts` | `ED77552EF78395510E373EE7862B53455149712065FD574D87C2BC6C112CB648` |

The reviewed product files are untracked in the supplied repository state, so Git cannot provide a meaningful baseline target diff for them. Exact before/after SHA-256 equality on the five frozen Unit 3 files is the review identity check; the reviewer changed only this evidence directory.
