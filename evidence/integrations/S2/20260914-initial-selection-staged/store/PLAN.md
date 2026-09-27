# Initial-default store layer

## Done

Done means `npm run build` and `npx vitest run test/integration-initial-default-store.test.ts test/integration-initial-selection-baseline.test.ts test/integration-policy-store.test.ts test/integration-selection.test.ts` exit 0; fresh/reopen reads validate canonical bytes and exact policy lineage; late/foreign/malformed/raw/REPLACE writes fail; hostile getters/proxies invoke no traps; and no engine or v1 policy/decision changes occur.

## Revision contract

- Maximum tested revisions: 2.
- Every revision runs the build and exact four-suite command above from `daemon` after the shared build slot is granted.
- Raw first-call output and terminal exit status go directly to `logs/revision-N-{build,tests}.log`.
- A failed revision gets one new hypothesis. After revision 2, restore the exact ledger preimage and remove unsafe new files.

## Scope and preimages

- New `daemon/src/selection/initial-default.ts`.
- New `daemon/migrations/040_initial_default.sql`.
- New `daemon/test/integration-initial-default-store.test.ts`.
- `daemon/src/ledger.ts` only registers migration 040.

Full ledger preimage SHA-256: `19bcb46c6c3d0c02b2f6b4cf828c1d277072def59ff4e158f2e8535ce394e47e`. The three new paths were absent.
