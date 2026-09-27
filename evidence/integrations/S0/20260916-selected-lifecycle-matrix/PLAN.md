# Selected reuse lifecycle matrix plan

## Done

The existing reuse receipt verifier derives the exact selected set from `upstream-source-catalog.json` (R-04, R-05, R-06, and R-08), verifies its bound descriptor/source bytes, and emits a canonical lifecycle matrix for every selected seam. Each of success, failure, cancel, restart, duplicate, and boundary is either an executed hash-bound receipt or an exact seam-specific pure-data/principles N/A reason. Deferred transports remain excluded by the catalog and `adoptionAuthorized:false` remains unchanged.

## Loop contract

- Attempt cap: 2 distinct implementation hypotheses.
- Every pass: `node --test scripts/reuse/reuse-fixture-receipts.test.mjs`.
- Also verify checked-in artifacts byte-for-byte with `node scripts/reuse/reuse-fixture-receipts.mjs --verify evidence/integrations/S0/20260916-selected-lifecycle-matrix/receipts` once generated.
- A failed pass requires a new hypothesis. Keep changes only when the focused gate improves or passes.

## Owned files

- `scripts/reuse/reuse-manifest.mjs`
- `scripts/reuse/reuse-fixture-receipts.mjs`
- `scripts/reuse/reuse-fixture-receipts.test.mjs`
- `docs/reuse-decisions/upstream-source-catalog.json` (R-08 current Cue consumer hash only)
- This evidence directory and generated receipt files.

Exact pre-edit hashes are recorded in `preimages.json`; byte copies are under `preimages/`.

## Limits

No authoritative documentation, product/provider transport, adoption decision, network/provider/model call, install, or deferred transport qualification. R-08 remains limited principles with zero selected external bytes. Root owns broader tests/build/docs.
