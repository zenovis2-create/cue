# Independent review — recovery claim limits

## Verdict

**PASS; the suspected production gap is refuted for valid store-created recovery scopes.** This was a test-only verification. No production source changed.

## Frozen evidence

- focused test: `F761DA3E492A9C5D899ADE49740E4C3F18A84B84B499255DC48116810C9EA4E6`
- recovery policy: `06EB66D823B26648CE471F2B5E23A2B95942CF859BD4B36772FFB5855E8EA5CB`
- orchestration store: `267B755F0C6CE4EC4267B522686878D77305FA19AD12354A72B0045FDEAA5E02`
- plan: `D929482493F8AC0D4E01A1D72800C1336B9CB3D8FD9E65562C57DAAF0EC5E61C`
- result: `5EABE27ADE75D0AC41557EF751CCEBAD4D495CF807C7D5869B97DF3ECD3CEA5D`

Independent gate, from `daemon/`:

```text
npx vitest run test/integration-recovery-claim-limits.test.ts test/integration-recovery-policy.test.ts test/integration-retry-backend.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
```

Result: **3 files, 21/21 tests passed**. Scoped `git diff --check` passed. The first maker pass failed only on a TypeScript fixture syntax error; the second passed. A later wording-only rename corrected an overclaimed test name without changing behavior.

## Findings

The real migrated SQLite fixture creates a valid retry contract, matching recovery scope, persisted recovery decision, and appended revision before exercising claim. At `now == deadlineMs`, the final claim rejects with the deadline error and inserts neither replacement attempt nor recovery activation. Consuming the remaining cumulative attempt slot rejects with `retry_attempt_limit` and likewise leaves no replacement writes. Advancing the trusted clock to the deadline from `authorizeClaim` is observed by the final clock read and rejected. An otherwise identical in-limit revised claim returns `launchRequired:true`, establishing that the negative fixtures reach the intended limit boundary rather than failing on invalid lineage.

Source inspection confirms `registerScope` requires an existing retry contract and exact equality for `maxAttemptsTotal`, `deadlineMs`, requirements, plan, and policy bindings. Missing-contract rejection is source-inspected; it was not separately exercised as a negative runtime test. The focused test accurately claims only that its valid fixture contains both bound rows.

## Scope

This verifies cumulative attempt and deadline enforcement for decision-backed replan claims through the existing retry-contract authority. It does not test monetary budget exhaustion, full driver dispatch, execution preparation, native processes, model/provider calls, network behavior, or a live workflow. Root owns any shared typecheck/build gate for this test-only addition.
