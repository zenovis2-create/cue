# Implementation results

## Scope

Repaired `daemon/src/evaluation/measured-facts.ts` and added focused measured-fact integration regressions. Core wiring, migrations, and trial-readiness behavior were unchanged.

## Result

- First capture rejects caller-supplied authoritative snapshot shapes and always captures the current accounting inventory internally after dependency checks.
- Persisted authoritative accounting records the fixed cutoff and digest returned by the accounting store; caller totals and cost classes are not trusted.
- Exact replay for an existing immutable fact tuple returns the stored fact without a fresh host capture or latest-observation check.
- Changed fact tuples and enrollment/observation tuple occupancy conflicts return `evaluation_replay_conflict`.
- Stored authoritative accounting is reconstructed with `projectAt(runId, storedCutoff).historical` and compared byte-for-byte; current disclosure is excluded.
- Stored-row tampering is rejected. `trialReady` remains `false`.

## Verification

Correction hypotheses used: 1 of 2. The first pass exposed TypeScript nullable narrowing and one overly narrow test expectation; both were corrected without changing the contract.

- `integration-evaluation-measured-facts.test.ts` plus Core-containment test: 9/9 passed.
- TypeScript no-emit check: passed.
- Scoped `git diff --check`: passed.
- Combined measured-facts, authoritative-accounting, and containment run: 14/15 passed. The sole failure was the concurrent migration reopen defect `trigger readonly_verifier_identity_hash already exists` at `ledger.ts:73`; it is outside this unit and already assigned to the migration owner.
- No build or live Electron/model/provider/network/native call was run; root owns the joint build after the migration source freezes.

## Frozen hashes

- `daemon/src/evaluation/measured-facts.ts`: `072072079F1F6B571DD77727BD8BA9AA3EC9FB98D5C097DDB1FAD1CF0107FA57`
- `daemon/test/integration-evaluation-measured-facts.test.ts`: `67D5C34CA2C09CCB683B5AF949589DFCE2D69A9DFF29049819AED7DA81590CAE`

## Positive monetary fixture addendum

Independent review required a positive authoritative monetary path. The focused maker test now creates two real budget reservations and latest provider-final receipts across base and verifier attempts. It proves omission of either reservation is rejected, a false caller class is discarded while the persisted classes are derived as `base` and `verification`, and a later receipt revision leaves both `read` and exact tuple replay byte-identical at the stored cutoff. `npm --prefix daemon test -- integration-evaluation-measured-facts.test.ts` passed 9/9; its configured pretest TypeScript build also passed.
