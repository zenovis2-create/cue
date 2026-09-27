# Independent A06 release-scope refusal review

## Verdict

PASS for the exact original A06 condition: `범위 밖 모델/계정/작업·예산 증액은 조용히 실행되지 않는다.` The production orchestration driver refuses each hostile change, or records a terminal refusal before adapter execution. This closes the negative execution property for the approved opaque account-reference boundary.

It does not prove that an opaque reference identifies a real account principal, that the principal owns an entitlement, that a provider consumed that identity, or that an execution completed and cleaned up. Those remain separate S0/S1 integration and live-qualification work.

## Independent gate

From `daemon/` I ran:

`npx --no-install vitest run test/integration-release-acceptance.test.ts test/capability-admission.test.ts test/integration-account-binding.test.ts test/integration-stage-envelope.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`

Result: exit 0, 4 files and 32 tests passed. No provider, local endpoint, native helper, Electron, network, or real credential was used.

Reviewed test SHA-256: `09C10C67CFE41CE6E9C9FB5F984697C1D4B9D141E989A099990F50DF4706952A`.

## What the public path proves

- An unapproved candidate model fails `driver.prepare` with `invalid_plan:scope-expansion`; adapter launches, attempts, write leases, budget reservations, and sessions remain zero.
- A child stage that expands a read-only parent to `file_change` reaches neither adapter launch nor session and leaves a durable snapshot reason. The fixture deliberately creates the baseline approval needed to reach stage admission, and legitimate attempt bookkeeping can exist. Therefore “activity 0” here means no prohibited execution activity beyond that disclosed admission baseline; it must not be reported as globally zero approval/attempt rows.
- Reopening the same run with the same candidate and measurement subject but a changed opaque authentication reference fails `driver.prepare` with `account_identity_conflict`; launch and all four queried activity counters remain zero.
- Raising the stored budget limit from 100 to 101 on reopen fails with `budget_policy_mismatch`; launch and all four queried activity counters remain zero.
- The positive control supplies the approved opaque reference to exactly one injected adapter launch. It creates no fabricated session and both settlement and close fail with `orchestration_cleanup_unverified`, so it cannot be used as evidence of successful execution or cleanup.

The activity query directly counts attempts, write leases, reservations, and sessions. Adapter launch count is the injected provider-boundary counter. The fixture does not query a native-identity table; its read-only synthetic stage installs no native callback or helper, so this gate supports no broader native-runtime claim.

## Scope judgment

The original A06 sentence is a refusal property, not a positive account-qualification requirement. The four hostile variants are no longer silently executed through the actual driver, and the positive control distinguishes admission from completion. Closing A06 on that narrow meaning is supported. Any wording that upgrades this result to principal identity, entitlement, real adapter consumption, live billing, or successful cleanup would be unsupported.
