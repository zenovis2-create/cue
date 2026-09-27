# S1 Unit 3 lifecycle wiring — results

Recorded: 2026-09-12 KST

Verdict: PASS for the offline Unit 3 implementation contract. This does not establish actual Codex/provider terminal state, provider death, billing finality, P13, or M-gate completion.

## Implemented boundary

- Runtime exposes an optional typed adapter lifecycle emitter for explicit `provider-terminal` and `billing-finalized` evidence only. The current Codex adapter emits neither because it has no authenticated provider receipt.
- Adapter lifecycle inputs and references are copied with descriptor-only bounded validation before enqueue. Forged runtime-owned cleanup/cancel kinds, proxies, accessors, sparse arrays, custom prototypes, and oversized reference sets are rejected.
- Runtime serializes at most 256 lifecycle writes. A prior write failure closes the queue. The supported host persistence callback is synchronous; the product driver writes SQLite state before returning.
- Runtime records cancel request once, client acknowledgement only after adapter cancellation resolves, and verified cleanup only as a local cleanup observation. Callback failure or cleanup timeout leaves cleanup unknown and prevents runtime settlement.
- Driver derives run/task/attempt/candidate lineage from the persisted attempt. Event and all reference bindings commit in one outer immediate transaction.
- `driver.lifecycle(attemptId)` reads the durable Unit 2 projection without preparing, activating, launching, resending, or contacting a provider.

## Hostile coverage

- Cancel request and acknowledgement remain distinct and duplicate cancel calls append neither duplicate event nor duplicate adapter cancellation.
- Explicit synthetic provider terminal/reference evidence persists; ordinary completion produces no provider event.
- Clean local cleanup leaves provider death and billing unknown.
- Lifecycle callback throw and cleanup timeout/failure stay fail closed.
- Adapter attempts to emit internal cleanup/cancel kinds, proxy/accessor input, or hostile reference arrays are rejected before persistence.
- A conflicting later reference rolls back the provider terminal event and every earlier binding in that emission.
- Reopened driver projection performs zero adapter launches or resends.
- Unit 2 tests retain stale lineage, replay, ordering, sealing, corruption, and cross-attempt ownership coverage.

## Commands and results

```text
cwd daemon
npx --no-install vitest run test/integration-runtime-contract.test.ts test/integration-provider-lifecycle.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
2 files / 33 PASS / exit 0

npx --no-install tsc -p tsconfig.json --noEmit
exit 0

npm run build
exit 0

npx --no-install vitest run test/integration-runtime-contract.test.ts test/integration-driver.test.ts test/integration-provider-lifecycle.test.ts test/integration-engine.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
4 files / 75 PASS / exit 0
```

An intermediate combined run failed because the simultaneously developed migration 033 integrity implementation used separate module-local connection capabilities in source and compiled modules. Its owner corrected that boundary using a connection-owned non-enumerable symbol, after which the unchanged Unit 3 combined gate passed 75/75. The intermediate result was not accepted as Unit 3 completion.

## Final source hashes

| File | SHA-256 |
|---|---|
| `daemon/src/integration-runtime.ts` | `6210DA7F01CFE0841D94A1D172E6FFA968BF1503A97BFDBC3F3E6A67EBA8B982` |
| `daemon/test/integration-runtime-contract.test.ts` | `E5EB285AE147992B58EA65BC95F549ED4DD2D33CEEE48C32A9FB7AACC30A75AB` |
| `app/orchestration-driver.mjs` | `0141082B48CCC9B1731627E847EF604FD89F100A0B7623686F5AC6AFE7B8E7E4` |
| `app/orchestration-driver.d.mts` | `3468C9A1C4E0249D5479D130584BF806AAE8076456F60294DF1DCBCD7EF5C8E8` |
| `daemon/test/integration-driver.test.ts` | `587560F0E7B24D0AF0830D4DFD50C8346F92A8128702A30045D364590AC86F3D` |
| `DONE-CONTRACT.md` | `854BCFB2AB99A9A2B57BD93B7BE096B8AEEAE8D8212406CD7488EC36293F94D0` |
