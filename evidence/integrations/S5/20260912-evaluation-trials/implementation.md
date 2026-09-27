# S5 durable observed-trial projection implementation

## Completion contract recorded before edits

- Done means the focused Vitest command, TypeScript no-emit check, daemon build, source/dist migration SHA equality, and scoped `git diff --check` all exit 0.
- Correction cap: 2 passes after the initial implementation.
- Every pass runs the same complete gate set.
- On failure, retry only with a new evidence-based hypothesis; if a measured gate regresses, remove the regressing change. After the cap, hand the unresolved failure to the human/checker.

## Results

Initial focused test run exited 1: all four new tests reached the same invalid fixture plan (`invalid_plan:requirement-coverage`). The product implementation was unchanged; correction 1 replaced the fixture's single role with the required planner/implementation/verifier chain.

Correction pass 1:

- `npx --no-install vitest run test/integration-evaluation-trials.test.ts test/integration-evaluation-observations.test.ts test/integration-evaluation-outcome.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1` — exit 0, 3 files / 19 tests passed.
- `npx --no-install tsc --noEmit -p tsconfig.json` — exit 1, strict typing rejected unknown-return and nullable dependency types.
- `npm run build` — exit 1 for the same TypeScript diagnostics; asset copy did not run.
- source/dist migration SHA check — exit 1 because the failed build had not created dist migration 028. Source SHA-256 was `77C62843A01D921AD8ED3BA66299BFEE3FCBBE698E98D4B065557C5000A7AC1D`.
- scoped `git diff --check` — exit 0 (line-ending warnings only).

Correction 2 made only explicit TypeScript narrowings and widened the internal reason accumulator. Final pass:

- `npx --no-install vitest run test/integration-evaluation-trials.test.ts test/integration-evaluation-observations.test.ts test/integration-evaluation-outcome.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1` — exit 0, 3 files / 19 tests passed.
- `npx --no-install tsc --noEmit -p tsconfig.json` — exit 0.
- `npm run build` — exit 0.
- `Get-FileHash -Algorithm SHA256 migrations/028_evaluation_trial_projection.sql; Get-FileHash -Algorithm SHA256 dist/migrations/028_evaluation_trial_projection.sql` — exit 0; both SHA-256 values are `77C62843A01D921AD8ED3BA66299BFEE3FCBBE698E98D4B065557C5000A7AC1D`.
- scoped `git diff --check` — exit 0 (line-ending warnings only).
- final source SHA-256: `daemon/src/evaluation/trials.ts` = `410B3B5508BA49E653A65E4708E6931CFAF3BBB013F537DB46593AAC3453ED12`.
- final test SHA-256: `daemon/test/integration-evaluation-trials.test.ts` = `73321D4D97C91E152C50767B30DF74E07DA1A1E9EB561A9EAF741C097BF00CA1`.

## Scope and limitations

The store accepts exactly `projectionId`, `enrollmentId`, and `observationId`. It reads and validates the immutable enrollment and observation, verifies their digests, lineage, run, and saved policy identity, and persists one append-only projection per enrollment/observation slot. Exact replay returns the original bytes; rebinding, duplicate slots, mutation, oversized payloads, recomputed payload tampering, reopen corruption, and outer transactions fail closed.

The assessment preserves a saved `success`, `fail`, `cancelled`, or `unknown` outcome when the observation contains a recorded outcome. Dataset, case, run, arm, policy, metric, environment, and account-limit references come only from the stored enrollment. No execution, approval, policy, comparison, promotion, provider, model, native helper, network, or user operation is called or written.

The current `cue-run-outcome-v1` contract stores tool/model revisions, quality, elapsed time, and all four cost components as null, and it stores no trusted price timestamp/source. Therefore every projection made from current records is intentionally and permanently `trial: null`, with stable missing-evidence reasons. This unit does not infer those facts, make existing data comparable, run a comparison, or grant promotion authority.
