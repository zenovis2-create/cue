# Decision-backed recovery claim limits result

The suspected production gap is refuted for valid store-created recovery scopes. `registerScope` requires an existing retry contract and requires its `maxAttemptsTotal` and `deadlineMs` to equal the recovery scope. At replacement claim time, the store rereads and validates that contract, takes its final trusted clock after claim authorization, and applies cumulative attempt and deadline caps before inserting the attempt or activation.

The real SQLite/store fixture proves:

- `now == deadlineMs` rejects with `retry_deadline` and writes no replacement attempt or activation;
- consuming the remaining cumulative attempt slot rejects with `retry_attempt_limit` and writes no replacement attempt or activation;
- advancing the trusted clock to the deadline from the final claim-authorization callback is observed and rejected;
- an otherwise identical in-limit replan replacement is admitted as the positive control;
- the valid production fixture contains both the retry contract and recovery scope required by `registerScope`.

Command, from `daemon/`:

```text
npx vitest run test/integration-recovery-claim-limits.test.ts
```

Final result: 1 file, 4 tests passed. Attempt 1 failed at test transform because a fixture helper omitted a closing TypeScript generic `>`; attempt 2 corrected that fixture syntax and passed. No product source changed.

Hashes:

- recovery policy source: `06EB66D823B26648CE471F2B5E23A2B95942CF859BD4B36772FFB5855E8EA5CB`
- orchestration store source: `267B755F0C6CE4EC4267B522686878D77305FA19AD12354A72B0045FDEAA5E02`
- focused test: `6FA1D861D044C7FF2ED57236FAAB3364F01FE3A0DA91725AD13518898F2C0FB8`

Scope limit: this verifies decision-backed replan claim limits through the existing retry-contract authority. It does not add monetary-budget claims, exercise full driver dispatch, or claim broader checklist completion. No shared build, native process, model/provider, network, or live gate ran.
