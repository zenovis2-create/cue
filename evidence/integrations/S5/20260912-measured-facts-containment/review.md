# S5 measured-fact Core containment independent review

Date: 2026-09-12 KST

Status: **PASS — containment only**

This review covers only the Core containment introduced after the Unit 1 measured-fact factory received its final **BLOCKED after correction 2/2** verdict. It does not approve migration 034, the direct factory, measured facts, trials, comparisons, promotion, or live-performance claims.

## Result

`app/core.mjs` no longer imports or constructs `createEvaluationMeasuredFactStore`. Both public Core methods, `captureEvaluationMeasuredFact` and `readEvaluationMeasuredFact`, synchronously throw `evaluation_measured_fact_component_unverified` without examining their arguments, looking up workspace state, invoking the runtime host, resolving evidence, validating terminal state, or writing a measured-fact row.

The containment test supplies every measured-fact host callback as a counting failure function. Core construction followed by capture with an extra `enable:true` field and read leaves the callback count at zero and the `evaluation_measured_fact` row count unchanged. The existing observation Core regression also expects the contained error and retains its other workspace/clock/transaction checks.

Reviewer validation:

- `integration-evaluation-measured-facts-core-containment.test.ts` and `integration-evaluation-observations-core.test.ts`: 2 files, 2/2 tests PASS.
- Independently observed `app/core.mjs` SHA-256: `bbc7e32b0424e654b8c3cd139a80a83ce8103477ca70f77c86570064c49a7c27`.
- Maker evidence reports nonincremental TypeScript, build, Core syntax, and scoped diff check PASS. The earlier missing compiled migration 036 was concurrent S4 shared-build state and was resolved by the normal build without changing the containment tests.

The measurement-contract registration APIs remain separately available when a host is configured. They do not construct or invoke the blocked measured-fact store, and they are outside this narrow containment decision.

No provider, model, native helper, Electron, network, paid, or credential call occurred. No S5 broad checklist item is closed. The three blockers in `../20260912-measured-facts/review.md` remain unchanged.
