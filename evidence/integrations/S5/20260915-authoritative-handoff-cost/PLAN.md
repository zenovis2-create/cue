# Authoritative handoff cost coverage plan

Done: authoritative accounting binds the actual terminal handoff inventory into its existing cutoff digest and refuses `completeAtCutoff`/`totalUnits` when the disposition of handoff cost is not authoritatively known; it does not infer that every handoff is separately billable. The focused accounting gate and connected measured-fact/outcome gates exit 0, current source builds through the root-coordinated build, and an independent reviewer approves final hashes.

False done: accepting a caller-populated `handoffUnits: 0`, a generic completion-total estimate, or handoff existence alone as proof of zero/nonbillable handoff cost.

Attempt cap: three diagnosed correction passes. Each pass runs the focused authoritative-accounting test first, then the connected evaluation measured-fact/outcome tests. A failed pass requires a new hypothesis; a regression outside owned files is reported to root before broadening ownership.

Allowed changes: `daemon/src/evaluation/authoritative-accounting.ts`, `daemon/test/integration-evaluation-authoritative-accounting.test.ts`, and this evidence directory. No budget, driver, migration/schema, checklist, provider, native, model, network, or live changes/calls.

Replay/idempotency: retain `cue-accounting-cutoff-v1` and its public fields. Bind bounded canonical handoff rows through the existing cutoff inventory digest using existing receipt/attempt maxima, so fixed-cutoff replay either reproduces identical evidence or fails closed. No mutable handoff status or caller declaration grants coverage.

Gate from `daemon`: `npm exec vitest run -- test/integration-evaluation-authoritative-accounting.test.ts test/integration-evaluation-measured-facts.test.ts test/integration-evaluation-outcome.test.ts test/integration-evaluation.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`.

Failure handling: keep the prior source only when the measured gate improves. If the connected consumers require changes outside ownership, preserve the exact failure and request root coordination rather than weakening the new unknown disposition.
