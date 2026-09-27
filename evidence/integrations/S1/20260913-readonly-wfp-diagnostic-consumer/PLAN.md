# Read-only WFP diagnostic consumer

## Done contract

- Focused command from `daemon`: `npm exec vitest run -- test/readonly-wfp-diagnostic.test.ts test/integration-readonly-wfp-bootstrap.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`.
- Attempt cap: 2; every pass runs the exact focused command.
- Done means strict bounded parsing covers the exact captured frame and UInt64 maximum plus missing, duplicate, malformed, foreign-binding, extra-field, byte/event/JSON overflow cases; integration proves diagnostics cannot promote a failed worker or change identity/cleanup authority.
- Failure receives one new hypothesis and retry; a second failure is reported.

No WFP/provider/native API is called. The result is informational and no database, acceptance, readiness, or qualification predicate is changed.
