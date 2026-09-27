# Driver change-observation exclusion

## Done contract

- Focused command: `npm exec vitest run -- test/integration-change-records.test.ts test/integration-driver.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` from `daemon`.
- Attempt cap: 2; every pass runs the exact command.
- Done means an actual orchestration driver run backed by the real SQLite ledger and change store records an identity-replaced target as `moved`, blocks with the existing `change_observation_unknown` reason before creating a retry/recovery decision or another plan revision, launches no replacement attempt, and retains its unresolved writer lease and journal evidence. The production condition also covers `unknown`, `outside-manifest`, and `type-changed`; allowed `unchanged`, `modified`, `created`, and `deleted` behavior remains covered by the related change-record suite.
- Failure gets one new hypothesis and retry; second failure is reported.

No native, provider, or model call is permitted. Build is deferred to the root after shared source freeze.
