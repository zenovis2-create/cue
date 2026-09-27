# Independent review — legacy held-retry admission

## Verdict

**PASS for the bounded orchestration-store admission guard.** The preserved reproduction showed a decision-free retry returning `launchRequired:true` and inserting both the replacement attempt and retry link while the prior attempt remained held. The frozen store now reads held disposition for ordinary retry lineage as well as recovery-decision lineage at the final admission point.

## Frozen sources and gate

- `daemon/src/orchestration/store.ts`: `267B755F0C6CE4EC4267B522686878D77305FA19AD12354A72B0045FDEAA5E02`
- `daemon/test/integration-held-retry-admission.test.ts`: `077D3D371F2D370C474A40956E2C72306B786C33092D05D42955D04C7105FEF5`

Independent command, run from `daemon/`:

```text
npx vitest run test/integration-held-retry-admission.test.ts test/integration-held-recovery-admission.test.ts test/integration-retry-backend.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
```

Result: **3 files, 19/19 tests passed**. Scoped `git diff --check` passed. The root-owned shared build was not run by this reviewer.

## Findings

After claim authorization, retry classification and clock callbacks, retry revalidation, cap checks, recovery revision reads, and the final run-state read, the store constructs a de-duplicated set from `retry.previousAttemptId` and `recoveryDecision.prior_attempt_id`. It applies the shared integrity and deterministic-seal reader to every member before writer-lease, revision-step, attempt, recovery-activation, retry-link, orchestration-step, or run mutation. No host callback occurs after this snapshot.

The focused real-ledger fixtures show that an open row and a row created by the final authorization callback both throw `recovery_held_open`. Reconciled-stop throws `recovery_held_reconciled_stop`, and a mismatched final seal throws `held_recovery_corrupt`. Each negative leaves the replacement attempt, retry link, and recovery activation absent, keeps the prior step failed, and leaves `write_in_progress=0`; therefore it returns no false launch authority. No-held legacy and exactly sealed eligible cases remain admissible. Exact replay of an already inserted retry remains inert with `launchRequired:false` and performs no second launch admission.

The ordinary retry and recovery-decision sources are each exercised through their valid production lineage in the combined test set. The two-distinct-ID set iteration is verified by direct source inspection rather than by fabricating a cross-lineage database state that the normal API does not produce. The implementation does not choose one source over the other and de-duplicates identical prior IDs.

## Scope

This proves the store transaction's admission and rollback behavior with migrated temporary SQLite ledgers and mocked host authority. Budget reservation and execution preparation occur later and were not invoked. No native process, model/provider, network, cleanup, external-effect observation, or historical gate ran.
