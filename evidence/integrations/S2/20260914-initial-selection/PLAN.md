# Initial selection and exploration implementation plan

## Done

The feature is done when `npm run build` and the focused Vitest gate below all exit 0, migration fresh/reopen/tamper/REPLACE checks pass, and `final-pins.json` contains SHA-256 pins for every changed production/test/evidence source.

## Revision contract

- Maximum implementation revisions: 3.
- Every revision runs: `npm run build` then `npx vitest run test/integration-initial-selection.test.ts test/integration-selection.test.ts test/integration-budget.test.ts test/integration-engine.test.ts test/integration-policy-store.test.ts test/integration-attempt-selection.test.ts` from `daemon`.
- Preserve raw output and exit status in `logs/revision-N-build.log` and `logs/revision-N-tests.log` on the first call and poll any session to terminal.
- A failed pass gets one new hypothesis. Keep a revision only if this measured gate improves; otherwise restore exact preimages. After a stable maker pass, a separate checker runs a wider gate.

## Production scope

- `daemon/src/selection/initial-selection-store.ts`: versioned conservative default, run/policy binding, explicit exploration authorization, and atomic idempotent exploration reservation.
- `daemon/src/orchestration/engine.ts`: opt-in real selection and dual reservation wiring; omission and local path remain legacy.
- `daemon/src/ledger.ts`: migration 040 installation.
- `daemon/migrations/040_initial_selection.sql`: append-only immutable schema and lineage guards.
- `daemon/test/integration-initial-selection.test.ts`: real ledger/store/engine integration coverage.

## Preimages

`preimages/engine.ts` and `preimages/ledger.ts` are full byte copies captured before edits. The new store, migration, and test were absent before edits. Initial SHA-256: engine `6e6f0915c21422ebe937668dccae1f62e4011c46473960125b83180f17dee33c`; ledger `19bcb46c6c3d0c02b2f6b4cf828c1d277072def59ff4e158f2e8535ce394e47e`.

## Known integration limit

This backend contract does not add UI/IPC authorization controls or live provider price/statistics ingestion. A trusted host must supply those facts through the new engine hook and store API.
