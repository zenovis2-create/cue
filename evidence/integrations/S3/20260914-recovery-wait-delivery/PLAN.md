# Recovery replacement wait delivery — bounded maker plan

Done is one public-driver integration scenario that prepares, approves, activates, and starts a run; records a trusted clean failure; applies approved automatic recovery; observes the root task running with a held replacement attempt; and proves a valid response is delivered exactly once to that replacement attempt, identity, and persisted durable reference. Exact replay and a recreated driver must not resend. A request bound to the prior failed identity must remain blocked with zero additional sends. The original absolute retry deadline remains unchanged.

Attempt cap: two test revisions. Every pass runs `npm run build` and `npx vitest run test/integration-driver.test.ts test/integration-request-queue.test.ts test/integration-driver-core.test.ts test/integration-local-driver.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` from `daemon`, capturing complete stdout, stderr, and exit status. A failing pass gets one correction based on a new hypothesis; otherwise hand off.

Scope is `daemon/test/integration-driver.test.ts`. `app/orchestration-driver.mjs` changes only if the intended scenario reproduces a product defect. This is synthetic SQLite/runtime evidence only; it does not qualify a provider, restart, native execution, Electron, network, or local model behavior.
