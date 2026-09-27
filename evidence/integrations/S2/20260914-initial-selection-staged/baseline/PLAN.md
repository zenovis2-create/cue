# Initial-selection baseline prerequisite

## Done

This prerequisite is done when, before any product edit, `npm run build` and `npx vitest run test/integration-initial-selection-baseline.test.ts test/integration-engine.test.ts test/integration-budget.test.ts` exit 0. The baseline must prove a real existing engine launch, exact replay with one ordinary reservation and one launch, and transaction rollback when synchronous preparation fails.

## Revision contract

- Maximum fixture revisions: 2.
- Every revision runs the build and exact three-suite command above from `daemon`.
- Raw first-call output and terminal exit status are saved directly under `logs/revision-N-{build,tests}.log`.
- On failure, retry once with a new fixture hypothesis. After revision 2, stop and remove the new fixture/tests if unsafe.

## Scope and preimages

Only `daemon/test/fixtures/initial-selection-ledger.ts` and `daemon/test/integration-initial-selection-baseline.test.ts` may be created. Both paths were absent before this unit; no product source has a preimage because product edits are forbidden.
