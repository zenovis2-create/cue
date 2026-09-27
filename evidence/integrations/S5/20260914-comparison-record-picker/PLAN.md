# S5 comparison-record picker maker plan

Done is `npx vitest run test/integration-evaluation-record-picker-core.test.ts test/integration-evaluation-ui.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1` from `daemon` exit 0, `node --check` for `app/core.mjs`, `app/ipc.mjs`, and `app/renderer/renderer.js` exit 0, `npm run build` from `daemon` exit 0, and uppercase SHA-256 pins for the eight owned source/test files.

Attempt cap: 2 substantive maker passes.

Every pass runs the two focused tests and JavaScript syntax checks. The final stable pass also runs the daemon build once.

On failure, retry only with a concrete new hypothesis. If the second substantive pass fails, preserve the failure evidence and hand the blocker to the root instead of expanding scope.
