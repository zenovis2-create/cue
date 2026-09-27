# R04/R05 selected adoption gates plan

## Done

- A canonical incorporation matrix covers exactly R-04/R-05/R-06/R-08 and rejects missing/extra rows, stale selected bytes/revisions, missing notice, implicit patch ledgers, undeclared callers, and any R-08 external-byte/adoption claim.
- A separate test-authority matrix distinguishes upstream applicability, Cue regression, and the necessary current local CLI boundary for the same selected revision. It rejects merged authorities, unjustified N/A, stale test/caller hashes, and missing boundaries.
- The current receipt binds both matrix digests and `--verify` regenerates and byte-compares every artifact. Batch76 lifecycle receipts remain untouched in their original directory; new artifacts are written only under this evidence directory.
- No external package/code adoption, provider qualification, network/model/CLI-product execution, or authoritative document update is inferred.

## Gates

- `node --test --test-reporter=spec scripts/reuse/reuse-fixture-receipts.test.mjs` passes the existing six plus expanded hostile matrix cases.
- `node scripts/reuse/reuse-fixture-receipts.mjs --verify evidence/integrations/S0/20260916-selected-adoption-gates/receipts` prints exact byte verification.
- `node --check` passes all three owned scripts; `git diff --check` passes owned files.

## Loop contract

- Attempt cap: 2 per hypothesis.
- Every pass runs the focused tests and exact current CLI verification.
- A failure requires a new hypothesis or handoff; regressions are reverted.

## Exact preimages

- `reuse-manifest.mjs`: `400491e0249c49da772f358ea5aca2960fc6570c0234a2e2cc513b059f059097`
- `reuse-fixture-receipts.mjs`: `6ff04748bbf18f806b023eb4a0b6633bd4729a9bc19b2de4272ebcf8edb045e8`
- `reuse-fixture-receipts.test.mjs`: `32c396455de0f5220552ea47dbbcf97c2ef1f9878d34a5499cbea5d9da679cb5`
- `upstream-source-catalog.json`: `3b989b0632d5236755b3954aba33e09c5fe22a59667161e26da46e9f96ddb297`
- Byte-exact copies are stored under `preimages/`.
