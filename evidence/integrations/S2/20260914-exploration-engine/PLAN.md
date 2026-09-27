# Exploration engine wiring

Done means an explicit deeply snapshotted exploration request is validated against the immutable grant, selected through all ordinary filters, and atomically reserves ordinary plus exploration budgets before launch; exact replay is side-effect free, local and legacy paths remain unchanged, migration 041 opens fresh/reopened ledgers, and required denial/rollback/overrun cases pass.

Maximum implementation revisions: 3. Every pass runs `npm run build` and `npx vitest run test/integration-exploration-engine.test.ts test/integration-initial-default-engine.test.ts test/integration-initial-selection-baseline.test.ts test/integration-exploration-budget.test.ts test/integration-engine.test.ts test/integration-budget.test.ts`. Preserve raw output and exit status. A failing pass requires a new hypothesis; after revision 3 restore exact preimages if unsafe.

Preimages: engine 9e3d4edd2e6bf208f124418b283a2e0dcbe09b9c13cf7e155150ba82cf614cdd; ledger e3954a13055cbb818d5c5ba384e985c8262640504137c40cc18089baed143d48; new test absent.