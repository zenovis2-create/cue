# S4 host-observed acceptance — independent review

Date: 2026-09-11. Reviewer: native agent `transport_review`; implementation by `reuse_pure`.
Verdict: **PASS for the acceptance verifier unit and its SQLite boundary**. This is not proof that production checker implementations, real artifacts or external services satisfy user requirements.

## Independent execution

Working directory `C:/Users/User/cue/daemon`:

```text
npm run build
exit 0
npx vitest run test/integration-acceptance.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
12 pass, 1 test file pass, exit 0
```

The initial independent 10-test run also passed before final review corrections. The result above is the current post-correction run, including multiple-maker identity and post-manifest lineage cases. No real model calls or full-suite claim are included.

| File | SHA-256 |
| --- | --- |
| `daemon/src/verification/acceptance.ts` | `557293C1C5F447CEDA19C3E318EBE4179A7B2F2492C73C398FBEC1F192EC3C7F` |
| `daemon/migrations/014_requirement_acceptance.sql` | `F56756AF3B0480421F44042A6759B6E2792A0D93E3C3BF87B0741083A1DDAF7D` |
| `daemon/test/integration-acceptance.test.ts` | `A763464B708B6702F68D23AFEDECCF1CCB3556FC97154754423795B30A3D3FF2` |

## Findings resolved during review

- Finalization originally checked caller cancellation and parent state only before the synchronous manifest callback. It now rechecks cancellation and parent state after that callback and asserts exactly one parent row transitioned when committing. Regression cases reject cancellation or parent blocking caused inside the callback without an acceptance receipt.
- A further review found that the callback could change attempt/cleanup lineage while the parent remained running. Finalization now reloads the complete stage/attempt state and compares lineage again after the callback, while holding the writer lease. The new regression changes the verifier attempt to blocked and confirms no receipt or completed parent.
- An initial 256-check acceptance cap was lower than the requirement-contract limit of 2048. The inconsistent cap was removed; requirement validation, observation byte limits and the total collection deadline remain the bounds.
- A regression now demonstrates reviewer identity is compared against a second implementation principal as well as the first, matching the all-maker comparison in source.

## Inspected invariants

- Collection requires an actual immutable requirement binding, validated matching plan/policy, complete clean attempts/steps and persisted child-stage envelope lineage. Missing or unresolved state cannot produce passing acceptance.
- Every declared requirement/check is processed. Required fail dominates pass and required unknown blocks success. Optional checks do not silently become required. Empty/missing target artifacts, mismatched artifact kinds, foreign manifests and empty artifacts cannot satisfy the corresponding requirement.
- The current host registry must supply the exact checker ID/revision and compatible kind. Checker context includes requirement/check parameters, target references, plan/policy/requirement digests, stage envelope, verifier attempt/principal and manifest digest.
- Raw observations must be sourced host observations with matching context/principal, current timestamps, nonempty source references and bounded nonempty bytes. Model-report origin and a generic model pass JSON are rejected by the fixture's host evaluator path. Bytes are copied before evaluation so evaluator mutation cannot rewrite retained evidence.
- Host-resolved verifier principal must be distinct from every implementation principal covering that requirement. Missing identities, collisions and missing current checkers remain unknown. Registration itself does not count as a pass.
- One total collection deadline spans asynchronous manifest capture and sequential checkers, with caller cancellation propagated. A sequence of four 20 ms collectors under a 35 ms total limit becomes unknown; late callbacks cannot mint a passing opaque evaluation after cancellation.
- Public evaluations are frozen and privately owned by a WeakMap. A copied or caller-created verdict object cannot finalize. Raw evidence and encoded evaluations are content-hashed and persisted; finalization revalidates their hashes and current lineage rather than trusting public fields.
- Finalization rejects stale evidence, inactive parent state, changed principals/checker availability, changed artifacts and overlapping writer ownership. It acquires the existing shared workspace lease during synchronous current-manifest validation and atomic receipt/parent completion, then releases only its matching lease.
- Accepted receipt insertion and the conditional completed-state update share one immediate transaction. Replaying the same accepted evaluation returns the existing receipt; a different evaluation cannot overwrite it. SQL UPDATE/DELETE/REPLACE guards protect blobs, evaluations and final receipts.
- Unknown billing is intentionally not an acceptance prerequisite. The success test retains an unsettled 50-unit reservation while completing verified requirements. No cost is released by this verifier.

## Trust and scope limitations

Host checker collectors/evaluators, principal resolution and manifest capture/currentness checks are trusted implementation seams. Fixture assertion reports and fixture manifests test the verifier's handling; they are not real test-run, source-retrieval or remote-state evidence. The module cannot establish that an arbitrary registered evaluator is correct merely from its name/revision or that a host-labeled observation is truthful. Production checker implementation identity and concrete approved parameter/target resolution need separate validation.

Synchronous trusted evaluator/currentness callbacks cannot be forcibly preempted by JavaScript timers. A synchronous evaluator overrun can be rejected after returning, but an infinite callback would require process isolation to interrupt. Async callbacks must honor abort and fence late side effects; timeout only bounds the verifier's wait. Durable evidence survives restart, but an in-memory opaque evaluation cannot be reconstructed by an untrusted caller to finalize later; historical read is distinct from collecting fresh approval evidence.

Driver invocation, stop-to-acceptance cancellation, final acceptance UI and native visual verification are separate integrations. No implementation file was edited by the reviewer; only this artifact was written.
