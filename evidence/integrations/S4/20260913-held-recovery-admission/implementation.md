# Held recovery admission implementation

The preserved before-behavior reproduction in `RESULT.md` passed 1/1 and showed an open held case receiving a replan decision. The implementation now shares one integrity-checked disposition reader across decision issuance/replay, replan revision application, and the final replacement-claim admission read.

Behavior:

- no held row preserves legacy recovery;
- `held` throws `recovery_held_open` before a decision, revision, or replacement attempt is inserted;
- eligible-for-disposition requires an exact deterministic final seal and remains admissible;
- reconciled-stop is policy-sealed at decision time and cannot replay/apply/claim a prior non-stop action;
- corrupt, unknown-state, or seal-mismatched rows throw `held_recovery_corrupt`;
- the claim check runs after host callbacks and final retry/revision reads, immediately before writer lease or attempt mutation.

Attempt 1 exposed a fixture-time error (`retry_future_claim`) before the held check because the test used an observation time later than its frozen trusted clock. Attempt 2 corrected the fixture time without changing product behavior and passed.

Validation:

- `npx vitest run daemon/test/integration-held-recovery-admission.test.ts daemon/test/integration-recovery-policy.test.ts`: 2 files, 12 tests passed.
- From `daemon/`, `npx vitest run test/integration-retry-backend.test.ts test/integration-held-recovery.test.ts`: 2 files, 12 tests passed.
- From `daemon/`, `npx tsc -p tsconfig.json --noEmit`: exit 0.

An initial retry/held command launched from the repository root was invalid for three fixture cases because those tests resolve `migrations` and `dist` relative to the daemon directory. The same scoped tests passed from their required daemon working directory; this was a command-context failure, not a product regression.

Frozen source hashes:

- `daemon/src/held-recovery.ts`: `1636C03619D8FDA330102D2394F720976E0FF93E33AD8A55A52B2420038EE58C`
- `daemon/src/orchestration/recovery-policy.ts`: `06EB66D823B26648CE471F2B5E23A2B95942CF859BD4B36772FFB5855E8EA5CB`
- `daemon/src/orchestration/store.ts`: `1DFBF90935FFCAE35ABEDA888AB6E9D1DEC16E03A4309F757C484A876CFCC2B3`
- focused test: `0F63F6FA68F41590515477266A0F49ACDB95E06258AAD741805052FE6A4B8C4F`

This proves the bounded store/policy admission paths. It does not claim full driver dispatch coverage or any native/live behavior.
