# Original contract closure audit plan

Done: each proposed original checklist closure has an explicit trace from the original requirement wording to current production source and a focused existing test, the focused test command exits 0, and the review distinguishes implemented record/fixture behavior from empirical or live claims. A06 closes only if account/model identity is explicitly bound and refused outside authority. S5-03 remains open if actual producer accounting can omit handoff cost despite the manually populated trial field.

Attempt cap: one focused test run unless that run discovers a product issue. No production, test, or checklist edits are authorized for this audit.

Focused gate, from `daemon`: `npm exec vitest run -- test/integration-selection.test.ts test/integration-attempt-selection.test.ts test/integration-stage-envelope.test.ts test/integration-orchestration.test.ts test/integration-budget.test.ts test/integration-cost-capacity-observation.test.ts test/integration-evaluation-measured-facts.test.ts test/integration-evaluation.test.ts test/integration-evaluation-outcome.test.ts test/integration-evaluation-authoritative-accounting.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`.

Every pass records the raw test log, exit status/counts, source SHA-256 pins, exact claim limits, and a definitive close/open list in `review.md`. The already independent driver 95-test gate and separate current-source build exit 0 are cited rather than rerun.

Failure handling: a focused failure or missing source authority keeps the affected checklist item open. With the cap consumed, report the exact defect to the root owner rather than editing source or tests.
