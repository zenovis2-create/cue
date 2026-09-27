# S4 Unit 2 change recovery independent review

Verdict: **BLOCKED — do not wire to production**.

Reviewed only `daemon/migrations/037_s4_change_recovery.sql`, `daemon/src/change-records.ts`, `daemon/src/held-recovery.ts`, `daemon/src/verification/integration-verification.ts`, their three direct test files, and the Unit 2 design. No product file was edited. The review used isolated temporary worktrees and SQLite ledgers; it did not run a model, provider, native executor, external service, or user file.

## Blockers

1. **Observation of a legitimate change set crashes before recording any final fact.** `change-records.ts:47` selects change-entry scalars and `preimage` but omits `payload`; line 49 immediately executes `Buffer.from(row.payload)`. The independent legitimate SQLite fixture passed the new target-preapproval gate and reproduced `ERR_INVALID_ARG_TYPE: Received undefined` in both observation scenarios. This prevents collision-safe postimage comparison, held reconciliation, and integration verification from operating.

2. **The claimed direct suite is not green on the current filesystem.** All three cases in `daemon/test/integration-change-records.test.ts` fail at `change_targets_not_preapproved`. Its fixture registers three target contracts (`a.txt`, `b.txt`, `new.txt`), while each capture supplies only a subset. The current implementation requires the capture target count to equal the entire contract count. Result: 3 failed, 4 passed across the three named direct files, rather than 7/7.

3. **A later unknown filesystem observation can be masked by older known history.** `held-recovery.ts:22` computes readiness with `COUNT(DISTINCT ordinal)` over every non-unknown historical observation. It does not select the latest observation per ordinal. Once any known row exists for an ordinal, a later `unknown` or `outside-manifest` row does not lower the count, so a held case can become eligible despite current state being unknown. The independent regression is present but currently stops earlier at blocker 1.

4. **Security-relevant observation scalars are not immutably bound to their payload.** Migration 037's `change_observation_payload` trigger checks only observation ID, change-set ID, ordinal, status, and object kind. It does not bind canonical parent, canonical realpath, file identity, byte length, SHA-256, observed time, or the stored observed bytes to the hashed payload. Those scalars feed restore/current-state decisions. Similar incomplete bindings remain in `change_set_payload` (targets, limits, creation time) and `change_entry_payload` (restorable reason and preimage semantics). The hostile scalar-drift regression is present but currently stops earlier at blocker 1.

5. **Integration verification accepts injected caller boolean authority.** `integration-verification.ts:6-7` takes an arbitrary `IntegrationFactObserver` directly from the caller, and line 15 treats `isChangeObservationCurrent(...) === true` as the final current-manifest fact. There is no ledger registration, observer revision/identity lookup, observation payload, timestamp, or durable digest for that assertion. This violates the design requirement that verification read registered observers and that callers cannot submit the desired fact.

6. **The database pass trigger can trust asserted payload facts instead of recomputing the full journal.** `verification_pass_payload` checks booleans embedded in the new result payload. `verification_pass_authority` only requires at least one change observation per change set and at least one non-unknown external observation; it does not require the latest complete change snapshot, reject external conflicts/unknown history, or independently join the required evidence-policy outcomes. A direct SQL writer with otherwise legitimate lineage can therefore assert `changesCurrent`, `effectConflict=false`, and `evidence=pass` without the journal coverage demanded by the design.

7. **Final verification lineage is incomplete.** The adapter checks only the producer attempt's revision and one handoff. It does not establish terminal handoff/launch identity for every producer and verifier consumed by the revision, bind the original approval/requirements/budget scope and cumulative limits, prove writer ownership settled, or require registered checker identity. A caller-provided `checkerRevision` is merely copied into the result.

## Evidence

- `npm run build`: passed.
- `npx --no-install tsc -p tsconfig.json --noEmit`: passed.
- Direct tests (`integration-change-records`, `integration-held-recovery`, `integration-verification`): **3 failed, 4 passed**. All failures were the preapproval fixture mismatch.
- Independent hostile review: **2 failed** with the legitimate runtime crash at `change-records.ts:49`; this occurs before the two intended negative assertions.
- Independent reopen gate: passed on an actual temporary migrated ledger; `PRAGMA integrity_check` returned `ok` and `PRAGMA foreign_key_check` returned no rows.
- `git diff --check` for the assigned files and review evidence: passed.

The executable reproductions are in `change-recovery-review.test.ts`. They intentionally encode the required fail-closed expectations and should remain red until the product blockers are fixed.

## Required next pass

Fix the observation projection/runtime crash first, repair target-contract test setup to exercise the intended capture subsets, select only the latest change observation per ordinal during reconciliation, fully bind scalar columns to immutable payloads, and replace caller boolean verification with a registered durable observer result. Then rerun the direct and independent hostile tests and add a direct-SQL false-pass fixture covering latest unknown/conflicting observations and incomplete evidence lineage.

