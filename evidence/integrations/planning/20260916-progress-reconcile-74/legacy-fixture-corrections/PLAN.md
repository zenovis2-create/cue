# Legacy fixture corrections

Done means the two pre-existing suites express current production prerequisites without weakening account-identity or staging-migration guards:

- selection-preference positive prepares supply one immutable, currently observed catalog identity for their sole `agent` candidate;
- the real pre-025 upgrade fixture installs every shipped migration from 025 onward before invoking the current engine, while preserving its original pre-025 construction and legacy-membership assertions;
- no test is skipped and no production source changes.

Attempt cap: one edit pass before the authorized focused gate. Root owns permission and timing for `integration-selection-preference-core.test.ts`, `integration-attempt-selection.test.ts`, and TypeScript no-emit. A failure requires a new source-backed hypothesis or handoff rather than guard relaxation.

Exact preimages are stored beside this plan:

- `preimage-integration-selection-preference-core.test.ts`
- `preimage-integration-attempt-selection.test.ts`

The full-suite failures being corrected are `driver_account_identity_unavailable` in two positive Core preparations and `no such table: attempt_staging_setup` in the pre-025 upgrade case.
