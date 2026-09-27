# Initial selection maker result

Status: **NOT SHIPPED — exact production rollback after revision cap**.

The attempted backend added a separate `cue-initial-selection-v1` strategy, conservative no-statistics baseline, one-candidate run-level exploration authority, dual ordinary/exploration reservations in the real engine claim transaction, and immutable provenance. It was not retained because the three-revision gate never reached the new behavioral assertions: revisions 2 and 3 used invalid integration plan fixtures (`requirement-coverage`, then `array-size`).

## Revision receipts

- Revision 1: build exit 0; tests exit 1. Existing coverage 48 pass/1 fail because the pre-040 upgrade fixture queried an absent new table; new suite had a parse error.
- Revision 2: build exit 0; tests exit 1. Existing 49 tests passed; all 7 new tests stopped at `invalid_plan:requirement-coverage`.
- Revision 3: build exit 0; tests exit 1. Existing 49 tests passed; all 8 new tests stopped at `invalid_plan:array-size`.

Raw first-call outputs and exit codes are under `logs/`. The full final failed candidate is under `preimages/revision-3-failed/`; revision 2 is under `preimages/revision-2/`.

## Rollback receipt

`daemon/src/orchestration/engine.ts` and `daemon/src/ledger.ts` were restored byte-for-byte to their captured session preimages. The new store, migration 040, and integration test were removed. Restored SHA-256 values are engine `6e6f0915c21422ebe937668dccae1f62e4011c46473960125b83180f17dee33c` and ledger `19bcb46c6c3d0c02b2f6b4cf828c1d277072def59ff4e158f2e8535ce394e47e`.

## Limitations

Cold-start defaults and separately authorized exploration remain unimplemented. UI/IPC authorization, trusted provider statistics/price ingestion, live provider calls, local invocation behavior, and Electron/native paths were not changed or qualified.
