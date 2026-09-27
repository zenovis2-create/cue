# Adapter diagnostic regression plan

Done means `daemon/test/integration-isolated-model-diagnostics.test.ts` exercises the real isolated local-model adapter through a mocked spawned child and real SQLite, covering cancellation versus timeout, first-failure retention, sanitized unknown transport errors, malformed protocol frames, the native final-close predicate, and successful completion without a diagnostic code. No native process, model, or network call may occur.

- Attempt cap: 2 edit-and-gate passes.
- Every pass: run `npm exec vitest run -- test/integration-isolated-model-diagnostics.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1` from `daemon`, then `npm exec tsc -- --noEmit -p tsconfig.json` from `daemon`.
- Failure rules: do not run the real-native `integration-isolated-local-model.test.ts`; stop after two failed edit-and-gate passes and report the remaining concrete failure; do not change production code.
