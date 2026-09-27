# Recovery observation integrity plan

## Done

The change is done when the daemon build and focused four-suite gate exit 0, and tests prove complete classification authority is snapshotted before callbacks, immutable across observe/decision, hostile proxy/accessor values cause no traps, legacy observations cannot authorize a non-stop decision, and unchanged valid recovery still works.

## Revision contract

- Maximum tested revisions: 2.
- Every revision runs from `daemon`: `npm run build`, then `npx vitest run test/integration-recovery-policy.test.ts test/integration-recovery-claim-limits.test.ts test/integration-replan-budget.test.ts test/integration-driver.test.ts`.
- Raw first-call output and exit status go directly to `logs/revision-N-build.log` and `logs/revision-N-tests.log`.
- Failure gets one new hypothesis. After revision 2, stop and restore exact source/test preimages if the candidate is unsafe.

## Scope

- `daemon/src/orchestration/recovery-policy.ts`
- `daemon/test/integration-recovery-policy.test.ts`

Full preimages were captured before edits. SHA-256: source `06eb66d823b26648ce471f2b5e23a2b95942cf859bd4b36772ffb5855e8ea5cb`; test `4af2a98ce22eeb1ca2b5150eeba06619d3c43b5075fbf57aab744722b3e32be5`.
