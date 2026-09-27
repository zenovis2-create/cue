# Independent review — R03–R06 reuse lifecycle

Verdict: **BLOCKED**. The focused implementation preserves the old input/path protections and refuses missing or changed receipt bytes before reading result files, but it does not establish the required canonical revision + canonical manifest digest + receipt-byte eligibility binding, and its exported fallback decision can self-authorize.

## Blocking findings

### 1. Canonical revision and manifest are not bound

`scripts/reuse/reuse-fixture-receipts.mjs:174-179` constructs `revision` from the generated receipt SHA-256 and constructs `manifestDigest` from a constant label. It never reads or validates the selected manifest bytes or a separately established selected source revision. Consequently, a change to a canonical selected revision or manifest can leave all three constructed values unchanged as long as generated receipt bytes remain unchanged. R-05 also has no manifest under `docs/reuse-decisions/manifests`, so the claimed R-04/R-05/R-06 selected manifest binding cannot currently be derived from that canonical set.

Required correction: derive the revision and manifest digest from identified canonical, validated selected inputs, then add consumer-level tests that alter each canonical revision and manifest independently and prove refusal before any result read.

### 2. Fallback pinning is caller asserted and self-authorizing

`scripts/reuse/reuse-manifest.mjs:39-50` verifies only that `fallback.pinned === true` and `fallback.binding` equals `fallback.observed`. It does not compare the fallback binding to a trusted pin established outside the fallback payload. An adversarial payload containing invented `aa…` revision, `bb…` manifest, and `cc…` receipt values returns `reusable:true` and `use-pinned-fallback`.

The current receipt consumer happens to fill the fallback binding from its generated current receipt, but the exported evaluator's stated fallback contract remains unsafe and its unit test explicitly expects an arbitrary old self-contained binding to pass. A verified external pin must be a distinct trusted input; fallback metadata must not attest to itself.

## What is verified

- Working source/test bytes exactly match the preserved `final-bytes` copies using filesystem SHA-256; the full preimages differ and remain preserved.
- `node --test scripts/reuse/reuse-fixture-receipts.test.mjs` passed 4/4.
- Focused Vitest passed 8/8 without a build.
- Existing getter/accessor, proxy, symbol, cycle, oversize, escape, missing/nonregular file, and junction refusal contracts remain green.
- `verifyReceiptArtifacts()` evaluates receipt eligibility before its result-file comparison loop. Missing current receipt and changed receipt bytes therefore refuse before result files are read. Changed result bytes with an unchanged receipt are detected in the subsequent byte comparison before the function returns reusable results.
- The historical R-03 entry remains explicitly `incomplete-historical-transport-receipt`; cancel, restart, and duplicate are not relabeled N/A.

Passing tests are limited evidence because the new tests encode both defective constructions: a constant-label manifest digest/receipt-derived revision in the consumer and a self-asserted arbitrary fallback in the evaluator.

## Original parent R03–R06 closure

No original parent can close from this packet.

- **R03 remains open.** Batch69 requires complete lifecycle rows for each selected seam and actual transport qualification where applicable. This packet properly leaves historical transport normal/failure/cancel/restart/duplicate incomplete; it proves only pure synchronous fixture N/A cases.
- **R04 remains open.** Batch69 requires the selected component to be tied to fixed version/source notice, thin adapter, patch ledger, and product/provider semantics. The new `selectionProof` strings describe fixture-only Cue code and zero selected upstream bytes; they do not supply product integration or an adopted component/version.
- **R05 remains open.** Batch69 requires Cue contract regression plus bounded evidence at each actually adopted boundary, kept separate from upstream results. The pure normalizer fixture passes, but no actual adopted/provider boundary or canonical R-05 manifest exists.
- **R06 remains open.** Batch69 requires revision/hash drift to invalidate eligibility and cached evidence, with a verified pinned fallback or closed refusal and zero silent dispatch. Receipt-byte drift is checked, but canonical revision/manifest drift is not bound and arbitrary fallback metadata can self-authorize.

Raw commands and observations are preserved in `rawreviewlogs.md`. No build, provider call, transport dispatch, download, product edit, catalog edit, or global documentation edit was performed.
