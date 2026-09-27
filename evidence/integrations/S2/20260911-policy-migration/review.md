# S2 monetary policy test migration — independent review

Date: 2026-09-11
Reviewer: native agent `transport_review`, not the implementer.
Verdict: **PASS for the policy-test migration**. This is neither a full-release verdict nor an exception to unrelated safety gates.

## Scope and rationale

Inspected the Git diff of `daemon/test/p2.test.ts` and `daemon/test/release.test.ts` against integration spec r3. `docs/INTEGRATION_SPEC.md:22` explicitly supersedes token-only/no-currency behavior with sourced monetary cost accounting plus tokens/quotas. The now-implemented SQLite budget module gives the replacement behavioral assertion a concrete target.

P2 removes only the obsolete source-word ban for USD/dollar/price patterns. Its state/token assertions remain. Release R7 replaces its monetary-pattern ban with a test showing the token threshold blocks independently of unused monetary capacity, and exhausted monetary reservations reject an additional reservation even while zero token usage remains below the token threshold.

This is a product-policy migration, not another attempted portability repair of the old grep command. The removed assertion's product premise no longer applies. No production behavior, forbidden-source scanner implementation, scanner positive control, isolation check, process check or Codex pin was edited in this diff.

## Independent verification

Working directory: `C:/Users/User/cue/daemon`.

```text
npx vitest run test/p2.test.ts test/release.test.ts --testNamePattern 'P2-3|R-7' --reporter=verbose --fileParallelism=false --maxWorkers=1
2 pass, 31 intentionally skipped, exit 0

npx vitest run test/release.test.ts --testNamePattern 'R-2 scans' --reporter=dot --fileParallelism=false --maxWorkers=1
1 pass, 13 intentionally skipped, exit 0
R-2 POSITIVE_CONTROL_RED observed=true
```

The second command independently confirms the retained scanner detects its injected forbidden string. Skipped cases are not claimed as passing. The parent's complete P2/release result is not substituted for independent execution in this report; independent checks here are proportional to the changed contract. The budget implementation was separately reviewed with build and 9 focused tests in the neighboring budget review.

## Reviewed SHA-256

| File | SHA-256 |
| --- | --- |
| `daemon/test/p2.test.ts` | `0311DFD7DF61928FA7D803DCAB2721C44924A565E4C3FA7AFF38F6479425AC69` |
| `daemon/test/release.test.ts` | `71303652E9AAE7B9187BC2A34F137DEBF3C8261C728EADA45E39DA4D42AD82FA` |

R7 verifies independent accounting foundations, not a live provider's spending limit or dispatch integration. Those remain separate integration obligations. No application source was changed by the reviewer.
