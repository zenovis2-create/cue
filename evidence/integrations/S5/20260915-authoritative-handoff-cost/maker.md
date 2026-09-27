# Authoritative handoff cost coverage maker evidence

Date: 2026-09-15

## Result

The change closes the silent-omission disclosure defect without claiming a handoff charge or changing known ledger totals. `captureCurrent` and `projectAt` retain their existing v1 cutoff, snapshot, totals, and replay behavior. A separate `cue-handoff-cost-coverage-v1` projection validates the exact fixed accounting snapshot, then checks only its accounting attempt IDs against immutable handoff/receipt/payload lineage. Existing unrelated attempts or handoffs are outside that fixed item set.

Each exact terminal handoff receives `billability: unknown` and a deterministic `handoff-cost-disposition-unavailable:<attemptId>` reason. Missing terminal lineage receives `handoff-lineage-unavailable:<attemptId>`. Neither state asserts that handoff is separately billable, included in the attempt bill, or free.

New monetary measured-fact captures must include these derived uncertainty reasons. Existing stored `cue-evaluation-measured-fact-v1` facts remain readable and replayable because the new capture-time disclosure rule is not retroactively imposed during historical read validation. `trialReady` remains false.

## Verification

The implementation used all three planned correction passes. Failure history and hypotheses are retained in `pass1.log` and `pass2.log`; `pass3.log` records the final 4-file, 42/42, exit-0 gate. No native, provider, model, network, local-model, live call, migration, budget, driver, or documentation change occurred.

The root-coordinated current build passed with exit 0; `build.log` records the command and compiled hashes. Independent review remains separate. This maker does not claim S2-03 or S5-03 complete: authoritative allocation of actual handoff cost remains absent. The improvement makes that absence explicit and consumed by new measured facts.

## Final source hashes

- `daemon/src/evaluation/authoritative-accounting.ts` — `2db2cfe13da005deaa4d8f17a8b1e01ff85079697a6aae0e42590c5bd8836af9`
- `daemon/src/evaluation/measured-facts.ts` — `37c54fa5a21e9a3d7a640eecc71cbd94f44238e382a461c6dc1715336531b9e1`
- `daemon/test/integration-evaluation-authoritative-accounting.test.ts` — `4fcb2e1ab4f74cc5fa70683cdddbed8c2a51cc8d5b2efdcefece71e35d585b57`
- `daemon/test/integration-evaluation-measured-facts.test.ts` — `c1c2a76b99366983e10c74c8aaeeb2ced35de3d2f7531ad0537071c37dca57ef`

Full byte preimages are in `source-before/`; their hashes match the manifest and the pre-edit pins.
