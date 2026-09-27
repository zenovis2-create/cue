# Maker receipt

Scope: immutable pre-approval evaluation dataset/case/run enrollment only.

## Results

- Initial focused gate: `npx vitest run test/integration-evaluation-enrollment.test.ts test/integration-evaluation.test.ts` — exit 0, 2 files, 17 tests passed.
- Independent review then failed the unit because an automated arm was not checked against the bound policy mode and the reader selected unbounded columns.
- Corrected focused gate: `npx --no-install vitest run test/integration-evaluation-enrollment.test.ts test/integration-evaluation.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` — exit 0, 2 files, 18 tests passed.
- Typecheck: `npx tsc --noEmit` — exit 0.
- Build: `npm run build` — exit 0; migration 026 copied to build assets.
- Scoped `git diff --check` — exit 0. A prior repository-wide check reported pre-existing trailing whitespace in `README.md`, outside this unit and unchanged here.
- Corrections: 2/2 used. Correction 1 moved a case-existence integrity guard before object construction for TypeScript narrowing. Correction 2 binds automated arms to the actual policy mode, rejects unsupported manual baselines, and bounds the enrollment read projection.

## Source hashes (SHA-256)

- `daemon/src/evaluation/enrollment.ts` `A218D5C91A85F400A3F03D644C3C26C6EAA76896537EAACF5497ED52B1B463A8`
- `daemon/migrations/026_evaluation_enrollment.sql` `2B4DA917F74904101EA31F32AC9FE118E1B833D3FDA66F3991F11C9458C4701A`
- `daemon/src/ledger.ts` `4B04D0029E20E20891251236F5C0E5FF0BEA420D2A60D62CF54596C49AC89432`
- `daemon/scripts/copy-assets.mjs` `934E1D59A602CD26E6495FEDCD9A78F9AB0C886396D78AE67D7C847211B54884`
- `daemon/test/integration-evaluation-enrollment.test.ts` `914FE3E2A58C974F5F3E05846968F96D8633F140F0CD233FD4BE0053E97410DE`

## Truth boundary

The current ledger has no canonical executed-input bytes/digest to compare with the dataset case. Enrollment therefore stores `inputBinding: claimed-not-verified` as a fixed value. It does not create trial measurements, pricing, model/tool revisions, observation revisions, promotion authority, or evidence that the declared input was executed.

Both current policy variants bind one of `efficiency`, `performance`, `value`, or `speed`; enrollment requires that exact mode. They contain no immutable manual-execution authority, so first-time `manual-baseline` enrollment fails with `evaluation_enrollment_manual_baseline_unsupported`.
