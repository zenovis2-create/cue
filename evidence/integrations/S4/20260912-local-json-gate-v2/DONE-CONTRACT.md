# Done contract: local JSON Electron gate v2

Done means a distinct v2 runner and offline auditor are ready for independent review. The v1 runner and its failed evidence remain unchanged. No model, native workflow, cleanup, Electron, or inference process is executed during implementation.

The v2 contract permits at most two Qwen requests in one future reviewed execution: one qualification request and one workflow producer request. It permits no retry, resume, alternate ledger, synthetic admission, public IPC bypass, or extra workflow invocation. It requires owned empty data/workspace/evidence roots, exact owned Electron profile, a frozen current source/installation identity, durable native identity before service authorization, verified cleanup and receipt before checker launch, accepted evidence before completion, and strict close/reopen readers.

The final auditor must bind the persisted requirement contract to the exact generated target and observation: run, plan, policy, requirement, producer task, input SHA-256, target ID, parameters digest, checker ID, pin-derived checker revision, and source revision. It must reject mutated policy, input, checker, target, or evidence lineage.

## Attempt cap

At most two implementation corrections. Each failed pass requires a new hypothesis.

## Every pass

1. `npx --no-install vitest run test/integration-local-json-electron-gate-v2.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`
2. `npx --no-install vitest run test/integration-generated-json-host.test.ts -t "runs shared-ledger" --reporter=dot --fileParallelism=false --maxWorkers=1`
3. `npm --prefix daemon run build`
4. Scoped `git diff --check` over the new runner, its test, and this evidence directory.

Only after an independent verdict and a newly frozen v2 script/installation identity may root decide whether to execute the future two-request gate.
