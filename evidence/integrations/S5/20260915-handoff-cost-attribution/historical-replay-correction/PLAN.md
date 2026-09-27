# Historical replay correction plan

## Done

- Capture and commit still require the attributed orchestration receipt revision to be the attempt's current latest revision.
- Projection reconstruction during historical read validates the exact stored receipt and handoff lineage without comparing it to later revisions outside the captured projection cutoff.
- Regression proves a captured fact remains readable after revision 2 is appended, while a new capture using revision 1 is rejected as stale.
- Focused handoff-accounting and measured-facts suites exit 0, followed by `npm run build` exit 0.
- Final source and test hashes are recorded and an independent checker reviews the correction.

## Attempt cap

Two correction passes.

## Every pass

Run the two focused integration suites. A failure permits one retry only with a new evidence-based hypothesis; otherwise hand the exact blocker to root.

## Change boundary

Only `daemon/src/evaluation/handoff-accounting.ts` and the already checker-added regression in `daemon/test/integration-evaluation-measured-facts.test.ts`. No schema, ledger, host, documentation, or compiled-asset changes.
