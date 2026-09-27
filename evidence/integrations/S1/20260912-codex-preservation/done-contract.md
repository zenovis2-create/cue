# S1 Unit 1 Codex preservation done contract

Date: 2026-09-12
Mutation attempt cap: 2

## Done means

The offline Codex component regression proves that the common wrapper preserves the current launch arguments, isolated Codex home, exact owner/envelope binding, `cue_workspace` runner path, goal verification, stop-once behavior, and ordered teardown. Provider thread, turn, and tool-call identifiers are treated only as bounded opaque references and are sanitized before host activity leaves the controller. The S3 typed activity capability and durable session reference remain intact. A resolved adapter cancel is only a client cancel acknowledgement; it never establishes provider terminal state or cleanup.

The hostile matrix covers duplicate, foreign, and late item/turn events; malformed and oversized IDs; same-call reuse; terminal-after-call; concurrent calls; sink throws; pre-launch, during-launch, and repeated cancellation; `stop()` throws; failed goal verification; caller mutation/getters/proxies; and redaction or non-emission of secrets, stderr, prompts, and absolute private paths. Canonical tool and model identity comes only from host registration.

No test or verification may execute the real Codex binary, provider/model, native helper, Electron, network, or worktree execution.

## Every pass

From `daemon`:

```text
npx --no-install vitest run test/integration-codex-adapter-preservation.test.ts test/integration-executors.test.ts test/host-codex-controller.test.ts test/p10c-host-controller.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
npx --no-install vitest run test/integration-runtime-contract.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
npx --no-install tsc -p tsconfig.json --noEmit
npm run build
```

From the repository root, record SHA-256 for all six owned source/test files and run scoped `git diff --check` plus a scoped target diff review.

## Retry rule

Keep a mutation pass only when the measured hostile/regression gate improves. On failure, retry once with a new hypothesis. If the second mutation pass does not satisfy the gate, preserve the raw failure and hand it back for human disposition. Do not claim actual Codex preservation, P13, remote provider termination, billing finality, or remote cleanup completion from this offline component.
