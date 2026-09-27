# R04/R05 selected adoption gates independent review

## Verdict

**CLEAR — approve original R04 and R05 for the current canonical selected scope.** The new gates turn the previously descriptive incorporation and test facts into fail-closed, current-byte-bound records. This approval is limited to R-04/R-05/R-06 Cue-authored fixture/tool components and the R-08 limited-principles selection.

## R04 incorporation review

The incorporation matrix is derived from the same exact selected basis used by the lifecycle gate and contains exactly R-04, R-05, R-06, and R-08.

For each Cue-native component it binds:

- the exact selected revision and current selected source bytes;
- a nonempty source/notice disposition;
- the declared thin seam and exact current receipt-generator caller;
- an explicit patch ledger, including the valid empty list; and
- `adoptionAuthorized:false` for the limited internal fixture/tool scope.

R-04 binds `parseRole`/`serializeRole`; R-05 binds `normalizeUsage`; R-06 binds the strict guard seam. The validator rejects missing or duplicate selected rows, missing notices, implicit patch lists, a foreign caller, stale revisions/bytes, and extra fields.

R-08 is separately classified as principles-only. It binds the decision commit and current Cue consumer bytes, selects zero external bytes, has no adapter/caller, and remains unauthorized for adoption. The hostile cases reject any R-08 external-byte or adoption claim. It is not relabeled as incorporated Archify code.

This satisfies R04's pinned version/source notice, thin adapter, and patch-list requirement for the actual selected limited scope.

## R05 authority separation review

The test-authority matrix uses the same selected revision and separates exactly three authorities:

1. **Upstream:** R-04/R-05/R-06 are N/A only under the exact Cue-authored/zero-incorporated-upstream-runtime-byte rationale. R-08 is N/A because the selected principles expose no callable seam and select zero external bytes.
2. **Cue regression:** each Cue-native row binds its direct current test bytes and exact test/probe command. These are distinct from the necessary-boundary record.
3. **Necessary boundary:** each Cue-native row binds the current receipt generator and exact `--verify` command. The generator actually imports the selected functions, generates the canonical outputs, and the verifier compares all artifacts byte-for-byte. R-08 remains explicit N/A rather than receiving a fabricated execution.

The main receipt binds both matrix digests as well as the implementation, fixture, result, lifecycle, and selection records. The validator rejects unjustified upstream N/A, merged Cue/boundary authority, stale Cue test bytes, missing boundary source/artifact, and a false R-08 executable boundary.

The stored historical direct-test receipts are tied to unchanged current source/test hashes, while independent current generation and CLI verification exercise the actual local caller/result boundary. No provider or external product execution is needed for these pure selected seams.

This satisfies R05's requirement to keep upstream applicability, Cue contract/regression, and necessary actual boundary evidence separate for the same selected revision.

## Independent gates and preservation

I independently ran:

- `node --test --test-reporter=spec scripts/reuse/reuse-fixture-receipts.test.mjs`: 8/8 passed; and
- `node scripts/reuse/reuse-fixture-receipts.mjs --verify evidence/integrations/S0/20260916-selected-adoption-gates/receipts`: exit 0, `verified byte-for-byte`.

The earlier selected-lifecycle artifacts remain unchanged:

- lifecycle matrix: `e2ae88ca05b907f37638792db58ac33993e52d8a8ccd5183ffe7482a750ff705`;
- lifecycle receipt: `9ea4da36b408360c55dd4adb93e8fa535ea9592debddb039ea7fce753271ce48`.

Final adoption-gate pins:

- verifier: `45c0d712f8e6f9768859343cde7c7ebce66353ff3b84a43048a94ca76b65a86b`;
- generator: `ac1cf1f5c4b108318384a85e76b53243e1f95fc2f7da1e5f1caa09e6ace021df`;
- focused test: `94e8d0fe3c23454a3d1039aefd0fe71952339bf820cb85360ccad8618ffef586`;
- incorporation matrix: `41bf938c78bf67be5250af853df81197d44b0b9b3c7f8996247daf4cb91785f4`;
- test-authority matrix: `fd5c74cdabf3f7e3fc304044beec58447269fa0cae0fe7ce520b3ddb71ca4d6f`; and
- receipt: `5e8fe84e7f6ef628feaf2b3b9666727f1c3a61c50a37eb0d33fe2a6a56d129da`.

## Scope limits

This review does not authorize external adoption, select deferred transports, qualify a provider, prove product/runtime dispatch, or replace future upstream/live boundary requirements if a different executable component is selected. It approves only the original R04/R05 conditions for the current canonical fixture/tool and limited-principles selection.

No build, provider, model, local-model, network, or external CLI call was made. Only the two bounded offline review gates above were run.
