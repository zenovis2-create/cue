# S5 manual evaluation baseline implementation

Date: 2026-09-12 (Asia/Seoul)

## Completion contract

- A declaration accepts exactly the 12 own-data fields `baselineId`, `enrollmentId`, `runId`, `dataset`, `caseId`, `policy`, `candidate`, `metric`, `environment`, `accountLimits`, `enrolledAtMs`, and `authorityRef`.
- The store deep-freezes the canonical request and requires the synchronous host callback `verifyExplicitUserBaselineAuthority`. Missing, false, throwing, async, malformed, proxy, getter, and unpinned-candidate inputs fail before a write.
- `authorityRef` and candidate are immutable `id`/`revision`/`digest` references. The stored run policy identity must exactly match the request, and the stored policy snapshot must pin `candidate.id`.
- The baseline declaration and `manual-baseline` enrollment append in one transaction while the run is queued/awaiting approval and has zero approval, execution, and orchestration-attempt rows. Direct manual enrollment remains denied.
- Exact replay returns the stored declaration, enrollment, and authorization without invoking the verifier. Rebinding conflicts. Reads use explicit bounded columns and revalidate canonical bytes and immutable lineage.
- Migration 029 denies late insert, update, delete, and replace. Core checks the current workspace and defaults closed unless its host runtime injects the verifier. No renderer/IPC surface was added.
- This authority grants no approval, execution, policy mutation, promotion, or trial-comparability authority.

## Verification

Final gate command order: TypeScript no-emit check; daemon build; focused Vitest files with `--fileParallelism=false --maxWorkers=1`; `node --check app/core.mjs`; source/dist migration SHA-256 equality.

Result after independent-review correction pass 2/2: 4 test files passed, 16 tests passed. The focused set covered baseline, existing enrollment invariants, trial projections, and Core. Assertions confirmed zero approval, execution, orchestration-attempt, and policy-mutation side effects. `git diff --check` for touched tracked paths and a trailing-whitespace scan for new files passed.

Migration source/dist SHA-256: `5A91BA416FA62724A72A5358EE662E53ACF883A57B0E7E890523CA664994F0A7`.

## Source hashes

```text
3CEBAB0802F38731CC6F8EB7C2BC8B582F4B9E5FC38452EB4A7D85C2EEF9E88A  daemon/src/evaluation/baseline.ts
016A80BD2F952A63307BF6264C9EEEA0F9BBA644F56BC8684F7B7F6AF5C40E35  daemon/src/evaluation/baseline-contract.ts
5A91BA416FA62724A72A5358EE662E53ACF883A57B0E7E890523CA664994F0A7  daemon/migrations/029_evaluation_baseline.sql
ADBB1A9CFE6FA54874423243AC8A39F3B3739F719980B8790D499F75AC6CFFDB  daemon/test/integration-evaluation-baseline.test.ts
5BFE8FBE2495313E8DCB6372058BCEC5CA878C63324928D341839EDBA7B7061D  daemon/test/integration-evaluation-baseline-core.test.ts
A218D5C91A85F400A3F03D644C3C26C6EAA76896537EAACF5497ED52B1B463A8  daemon/src/evaluation/enrollment.ts
BB8E92EA68748DE4D3BF256A1FA0D8CEF075D97B84F495A1250B53CE98C72657  daemon/src/ledger.ts
26939E76087BBB364CE6AB78ABFF62E4799AC9A5842567C2B6B01CEE88BA9A6B  daemon/scripts/copy-assets.mjs
8CF126F494DF325C90B843A22A78BED6A5463B1926E491FBCEE88654DB7D5CF4  app/core.mjs
01D78EB095CFC207B77CD30A2229A893BA2D494FF3D17F10B9C58FF50DEA65D7  app/core.d.mts
```

## Limits and shared-worktree note

- The callback proves only that the host verified the immutable authority reference; this implementation intentionally does not create or infer the external authority record.
- Existing uncommitted work was present in shared tracked files. Only the baseline import/construction/API lines, the manual enrollment branch, and migration registration/copy lines were added for S5; other workers' changes were preserved.
- No model, provider, native process, network call, renderer, IPC, documentation, or selection-policy source was used or changed by this implementation.

The artifacts and passing focused gate are ready for independent review.

## Independent review history

- Initial independent review: **BLOCKED**. The decoder accepted extra own-data fields in `authorization_payload`, so trigger removal followed by injected `approvalAuthority` or `promotionAuthority` fields was not detected.
- Correction pass 1/2: authorization decoding now requires exactly `verified` and `authorityRef`, validates `authorityRef` through the strict immutable reference parser, reconstructs the canonical authorization object, and compares its exact bytes. Returned values are built from that canonical object. A hostile regression injects both additional authority fields and requires a fail-closed read with zero approval/execution writes.
- The same review pass found that direct enrollment trusted matching declaration columns. The correction centralizes complete stored-row validation in `baseline-contract.ts`; both declaration reads and the enrollment manual branch validate canonical request bytes/digest, exact authorization, every indexed column, candidate and authority references. Enrollment additionally matches the actual policy's pinned candidate. Forged `{}`, `verified:false`, and extra-authority rows now produce zero enrollments.
- Correction pass 2/2: persisted rows are integrity evidence only. Public `createEvaluationEnrollmentStore(...).enroll` now unconditionally rejects `manual-baseline`, including a fully canonical forged SQL row with correct request digest, columns, and `verified:true`. Only the baseline store can append the canonical dataset and manual enrollment after the host verifier, exact policy/pin, case, and zero-lifecycle checks, inside the same transaction as the declaration.
