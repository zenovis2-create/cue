# Independent claim-clock check

Verdict: PASS for the claim-clock correction and the migration-036 role/attempt-authority prerequisite. No product edits were made by this checker.

## Admission ordering

Reviewed `daemon/src/orchestration/store.ts` at the final `claim`/`caps` implementation.

- Retry classification and claim authorization complete before the final clock snapshot.
- `claimNow = retryClock()` is the final host callback on the ordinary retry path.
- After that snapshot, `checkPrevious`, `caps`, recovery seal/current-revision checks, run-state validation, write-lease checks, and inserts use database state only. `caps` itself has no callback.
- Attempt totals and per-task totals are therefore read after the callback boundary. The claim timestamp is also checked against the same final clock value.
- The complete sequence remains inside one `db.transaction(...).immediate()` call. A callback mutation made through the same ledger connection participates in that transaction; rejection rolls back both the mutation and the candidate retry.

The regression test makes the second trusted-clock callback insert a synthetic attempt that consumes the remaining total slot. The subsequent cap read rejects with `retry_attempt_limit`; the transaction restores the attempt count to one and leaves no `retry` attempt. The positive test admits one retry and reaches two total attempts.

## Verification

From `daemon/`:

`npm test -- --run test/integration-recovery-policy.test.ts test/integration-retry-backend.test.ts`

Result: exit 0; 2 files passed; 17 tests passed. The command also ran the TypeScript build and asset-copy pretest successfully.

Covered directly:

- final monetary slot reread after recovery callback;
- final retry slot consumed by trusted-clock callback, with atomic rollback;
- normal retry in the remaining slot;
- retry caps, deadlines, replay safety, concurrent previous-attempt consumption, and downstream rollback cases;
- migration-036 revision role readback (`model-producer`), immutable revision-step payload, immutable plan digest, immutable attempt/task lineage, and `foreign_key_check = []`.

## Migration-036 scope

This is sufficient approval for the S5 prerequisite named in this review: `readRevision` preserves the stored task role, and migration 036 prevents mutation of the checked revision and attempt authority fields. It is not a full approval of every migration-036 table, trigger, payload constraint, legacy-upgrade behavior, or delete/insert immutability path; those were outside this focused claim-clock review.

No concrete blocker found.
