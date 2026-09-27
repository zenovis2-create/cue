# Independent review: authoritative handoff cost coverage

Date: 2026-09-15
Result: PASS

## Scope

The implementation prevents silent omission of terminal handoff cost coverage while preserving known ledger totals and fixed historical accounting cutoffs. It does not invent a billable handoff charge or claim that a handoff is free.

## Findings

- The existing `cue-accounting-cutoff-v1` remains authoritative. Reservation, receipt, retry, attempt, and revision maxima are kept distinct; later rows are disclosed separately and do not rewrite the historical snapshot.
- Handoff coverage is restricted to the exact historical accounting item set and exact attempt/receipt lineage. Missing or ambiguous lineage yields explicit unknown reasons.
- Handoff payload hashes and receipt/attempt identity are checked before coverage is emitted.
- New monetary measured-fact capture must retain the derived handoff unknown reasons; removing them is rejected. Existing stored v1 facts remain readable and replayable.
- No billability or charge amount is inferred from handoff existence. `billability` remains `unknown`.

## Verification evidence

Focused independent gate: `pass3.log` records exit 0, 4 files passed, 42 tests passed, duration 4.83 s.

Build gate: `build.log` records `npm run build` in `daemon`, exit 0.

Final source/test hashes from maker evidence:

- `daemon/src/evaluation/authoritative-accounting.ts` — `2db2cfe13da005deaa4d8f17a8b1e01ff85079697a6aae0e42590c5bd8836af9`
- `daemon/src/evaluation/measured-facts.ts` — `37c54fa5a21e9a3d7a640eecc71cbd94f44238e382a461c6dc1715336531b9e1`
- `daemon/test/integration-evaluation-authoritative-accounting.test.ts` — `4fcb2e1ab4f74cc5fa70683cdddbed8c2a51cc8d5b2efdcefece71e35d585b57`
- `daemon/test/integration-evaluation-measured-facts.test.ts` — `c1c2a76b99366983e10c74c8aaeeb2ced35de3d2f7531ad0537071c37dca57ef`

## Limitation

This closes disclosure of omitted handoff cost coverage. Authoritative allocation of a separate handoff charge remains open; S2-03 and S5-03 are not complete.
