# Initial-default engine wiring

## Done

Done means the real engine uses a configured conservative default only for a fresh trusted no-statistics observation over a null empirical estimate, preserves exact legacy behavior without config, persists/replays exact configured provenance atomically with ordinary budget and attempt selection, and all required denial/rollback cases pass. Every pass runs `npm run build` and `npx vitest run test/integration-initial-default-engine.test.ts test/integration-initial-selection-baseline.test.ts test/integration-initial-default-store.test.ts test/integration-engine.test.ts test/integration-attempt-selection.test.ts` from `daemon`.

## Revision contract

- Maximum implementation revisions: 3.
- Raw first-call build/test output and terminal exit status go directly to `logs/revision-N-{build,tests}.log`.
- Each failure gets a new hypothesis; coordinate checker before the final revision.
- After revision 3, restore exact source/fixture preimages and remove an unsafe new test.

## Scope and preimages

- `daemon/src/orchestration/engine.ts`, preimage SHA-256 `6e6f0915c21422ebe937668dccae1f62e4011c46473960125b83180f17dee33c`.
- `daemon/test/fixtures/initial-selection-ledger.ts`, preimage SHA-256 `b900703c03718b24e4efd90734282cad879599ed98a4764b9a9bdff2f196b949`.
- New `daemon/test/integration-initial-default-engine.test.ts`, absent before edits.

Paid exploration and module/migration 041 remain unwired and out of scope.
