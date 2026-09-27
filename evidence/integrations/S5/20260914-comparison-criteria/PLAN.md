# Configurable descriptive comparison criteria maker plan

Done is the exact configurable nine-field criteria object accepted through Core and IPC, persisted by the existing immutable comparison store, and returned/displayed only as a sanitized saved projection. Legacy requests without criteria retain the nine existing defaults. Performance mode requires an explicit non-null stored-unit ceiling. The targeted three-test gate, syntax checks for the three changed JavaScript modules, and one final daemon build must pass.

Substantive implementation attempt cap: 2. Pass 1 implements the bounded contract and tests. Pass 2 is permitted only for a concrete failure or review correction; every failure is preserved in `maker.md`.

Every pass runs `npx vitest run test/integration-evaluation-criteria-core.test.ts test/integration-evaluation-ui.test.ts test/integration-evaluation-comparisons-core.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1` from `daemon`, plus `node --check` for `app/core.mjs`, `app/ipc.mjs`, and `app/renderer/renderer.js`. After stable source, run `npm run build` once from `daemon`.

Failure rule: record the exact command, exit code, and bounded cause in `maker.md`; make only a directly justified correction in pass 2. If pass 2 still fails, stop and report the exhausted cap without broadening scope.
