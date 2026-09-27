# Generated output store and acceptance — independent review

Date 2026-09-11. Reviewer contracts_review; store maker reuse_pure, acceptance/ledger composition maker root. Verdict PASS after one diagnosed correction. Reviewer made no production edits and no live/native calls.

Done: inspect exact preapproval contract, SQL/replay/bytes/lineage, current-attempt acceptance and legacy ledger compatibility; build and focused gates exit 0; hash current files. Correction cap 2, used 1. Evidence one write then hash/readback.

## Resolved finding

Original generatedCheckMatches returned true whenever the manifest did not contain generated-output. This allowed an explicitly generated contract to be downgraded to a same-target filesystem manifest before inspecting its stored binding. Root corrected the fallback: any stored generated target requires exact generated kind and contract validation; only unbound legacy targets use the original path. New filesystem-downgrade negative test passes. The existence query intentionally preserves legacy target IDs that are invalid under the new stricter generated target grammar.

## Independent gates

Working directory daemon:

- npm run build: exit 0.
- npx --no-install vitest run test/integration-generated-output.test.ts test/integration-acceptance.test.ts test/integration-acceptance-history.test.ts test/integration-driver-core.test.ts test/p5.test.ts test/integration-retry-backend.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
- Exit 0; 6 files, 65 tests passed. Start 18:10:47; duration 9.80 s. Session 93144, final output f5ba8d.

## Verified scope

Target contract hashes bounded actual input bytes, exact checker/revision/parameters, sole target, document requirement, named model-producer, plan/policy/requirements and parent envelope. Binding is before approval/attempts with API and SQL protections; exact replay is historical and does not renew authority. Raw bytes use typed-array intrinsics, reject shared backing buffers and return defensive copies.

Observation recording checks actual claimed producer stage and lineage, requires synchronous host authorization over separate byte copy, then rechecks lineage before insertion. Observation IDs cannot be reused across targets/attempts; retry outputs remain separate. Late actual response storage does not change execution, cleanup or acceptance. Reads select explicit attempts and verify stored byte hashes and stage lineage; no implicit latest-row choice.

SQL duplicate INSERT guards preserve immutability under REPLACE, and update/delete are blocked. Ledger opens migration017, packaged assets include it; reopen/core/P5/compiled legacy retry migration regressions pass. These hashes are integrity checks, not authentication against a fully hostile database owner.

Acceptance only permits generated documents with the exact approved target/checker/parameters and current successful producer stage, matching stored bytes/size and cue-generated-output:<record.digest> reference. Prior failed output, forged reference, unapproved document and code substitution fail. Same checks protect callback-free history and run again after host manifest revalidation before final receipt. Legacy filesystem/research/external rules remain.

## Limits

This unit adds stored response provenance and artifact admission, not semantic correctness. host.authorizeObservation remains an actual host evidence responsibility. Tests use synthetic checker observations; no production deterministic checker, provider qualification, default orchestration host or real goal acceptance is claimed. Input schema/semantic preservation is the pinned registered checker's future responsibility, bound by approved revision and input digest.

## Current hashes
- daemon/src/verification/generated-output.ts : 18A7662563CCA92FE8FBF50E5C1A7FB103F47EDEE657771270FD9DFF0DC49182
- daemon/migrations/017_generated_output.sql : 3B3D51A9384F9FFF80308CDD25E920739392CA4E938F380D51E9E4B6B84189EA
- daemon/src/verification/acceptance.ts : 61026B4305688E10BA6333195D7520605B94E7C9B316DEECC22D2D37D4F5DF31
- daemon/src/ledger.ts : 96C165755C0BCB61FC0CB93040B20A377EC87957EC3944469605ED4628CDAE0B
- daemon/scripts/copy-assets.mjs : 2C101D1F533C45ED92B5ADD050B3015EB79A04588BD12C86B1D7BC83764CDEA1
- daemon/test/integration-generated-output.test.ts : 41CD1A275221522A5F7BD3399BCF5A6DED7E781905C6D8A619672E0AAA171FB7
- daemon/test/integration-acceptance.test.ts : 33103FC63E3678C067F544569890407F02B897F09113E39772301DA83898DD3F
- daemon/test/integration-acceptance-history.test.ts : 4C708EC1A10D52EB99F7BC654B7138CFD3A48CF92895FDADF9975F878C614EFB
- daemon/test/integration-driver-core.test.ts : 88AF7BCA6DD48BECC7564038C7945226E6BF9955B2DB1517AA3A6154CA3DD5BB
- daemon/test/p5.test.ts : B67F5A9759DF4F95E278E7EF5369671D4650DDAC1EF6A02C6F7E6E606E99F3DF
- daemon/test/integration-retry-backend.test.ts : 952A91AF27CBA2A76482E4043602EA853459FFEAAB7ECDA1471CF803EAA57E72
