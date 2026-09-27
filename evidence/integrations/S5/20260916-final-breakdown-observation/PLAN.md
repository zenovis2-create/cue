# Final accounting breakdown observation correction

Status: maker plan, before product edits.

## Done

1. Preserve exact current filesystem bytes for both owned files as Base64 with SHA-256 and byte length.
2. Add one regression proving a legitimate `readRunOutcome` with final, classified base/retry/verification totals is rejected by `createEvaluationObservationStore` before the fix.
3. Make the smallest change in `evaluation/observations.ts`: validate canonical bounded non-negative decimal totals, reconcile classified components to `actualUnits`, keep all components null for non-final accounting, and require handoff to remain null because this outcome DTO has no authoritative handoff-attribution input.
4. Reject fabricated totals, bad arithmetic, noncanonical/overflow strings, accessors/proxies through the existing exact-data boundary, and any attempt to infer billing finality.

## Attempts and gates

Cap: 3 implementation hypotheses. Every pass runs:

`npx --no-install vitest run test/integration-evaluation-observations.test.ts test/integration-evaluation-outcome.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`

Final pass additionally runs:

`npx --no-install tsc --noEmit`

Pass 1 must be the red regression. Pass 2 is the minimal validator fix. If it fails, pass 3 must use a new hypothesis grounded in raw output. A regression or weaker gate is rolled back; repeated failure is handed to root. No build, provider, local-model, port, price, or migration action.
