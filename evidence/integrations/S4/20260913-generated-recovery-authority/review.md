# Independent review contract

- Done: verify the bounded source diff against root-captured full preimages; inspect the real generated host -> orchestration driver -> durable recovery-policy store path; pass the safe focused generated-host Vitest suite; pass the final daemon build under the assigned build owner; confirm immutable failed/clean terminal, receipt, handoff, artifact, diagnostic, timestamp, and source-reference lineage after SQLite reopen; confirm unknown cause/effects produce a sealed stop with no second launch or qualification claim.
- Reviewer correction cap: 2 passes per diagnosed issue.
- Per pass: record the exact command and outcome; run the safe focused generated-host Vitest suite; run the final daemon build only when assigned and when no concurrent build is active.
- Failure handling: preserve each failed result, form a new source-backed hypothesis before another correction, and never run native/model/network/live/UI tests or `integration-isolated-local-model.test.ts`.

## Maker failure record received at handoff

1. Focused pass 1 failed because the explicit automatic-approved test wrapper omitted the retry authority clock (`retry_host_missing`); maker added it.
2. Focused pass 2 reached the intended behavior but the test queried a nonexistent `source_ref` column; maker corrected the test to decode the persisted observation payload.
3. Maker did not claim PASS and did not run a third pass because its cap was exhausted.

## Verdict

**PASS.** No blocking correctness, security, persistence, or scope issue remains in the bounded change.

The generated JSON host now supplies `host.recovery` to the existing orchestration driver. The driver therefore constructs `createRecoveryPolicyStore` with this authority and uses the durable automatic-approved branch instead of the legacy retry classifier. The default generated host configuration still omits `recoveryMode` and `retry`, so its default remains manual. The test-only wrapper is the sole explicit automatic-approved opt-in in this unit.

The authority is read-only and adds no table. It requires one exact failed/clean receipt and handoff, verified terminal integrity, exactly one authorized handoff artifact, and exactly one terminal activity. It validates canonical activity bytes, exact root/data key allowlists, database `event_id` binding, attempt/run/task/ordinal lineage, an allowlisted persisted diagnostic code, and a nonnegative nonfuture observation time. Its `generated-recovery:<sha256>` reference is 83 characters and binds the attempt, terminal ordinal, exact activity-byte digest, receipt, and handoff. Reads rederive the complete proof after reopen. Cause and external effects remain `unknown`; retryability, independent quality failure, and prior-candidate eligibility remain false; quota reset and candidate observation remain null. These facts force the existing `unsafe-or-unknown-state` stop branch and do not claim automatic retry qualification.

The hostile fixture verifies the actual driver/store persistence path: one producer launch, no second attempt/checker launch, durable failure observation, sealed stop decision, unverified acceptance, stable reopen proof, foreign attempt/context rejection, stale-reference rejection after tamper, extra secret-field rejection, event-id mismatch rejection, future timestamp rejection, and null candidate authority.

## Independent commands

- `daemon> npm exec vitest run -- test/integration-generated-json-host.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`
  - Exit 0; chunk `e51825`; 1 file, 19/19 tests passed; 13.20 seconds reported by Vitest.
- `daemon> npm run build`
  - Exit 0; chunk `9d0b93`; `tsc -p tsconfig.json && node scripts/copy-assets.mjs` completed.
- `git diff --check -- app/generated-json-host.mjs daemon/test/integration-generated-json-host.test.ts`
  - Exit 0; no output.
- Root-captured preimages rehashed exactly as `preimages.json` records:
  - `app/generated-json-host.mjs`: `223B8A990D9915775DCDE85CCDC88AC1F0344BF82D15796CB53C76D01FD6E6E2`
  - `daemon/test/integration-generated-json-host.test.ts`: `0745E9E0E10EA50D829A3764D31E1082562C7E1680E99B793010D7F61165FBB9`

## Final bounded file hashes

- `app/generated-json-recovery-authority.mjs`: `60F2BCD52272607EACF8EB0D2CD6DEC5F9D44B5064792D6FCD1B3C3A2A1F36B4`
- `app/generated-json-recovery-authority.d.mts`: `B15E088BC0059BFA404E8D9387B924C735344012FB0E62DF0F3BF9D597D1072D`
- `app/generated-json-host.mjs`: `3C92B646D397A4B9285D1CCC6BD2CB143423A601FCA55B420FCF65FE814E0D2A`
- `daemon/test/integration-generated-json-host.test.ts`: `B87DAAE3C37592D0189A63910049C3034021724C233CCB3E4C3567DD52100F39`

## Limits

This review used the synthetic generated-host executor boundary with real SQLite persistence. It made no native/model/network/live/UI call and did not run `integration-isolated-local-model.test.ts`. It does not claim provider, native process, billing, default automatic recovery, or live-workflow qualification.
