# Selected reuse lifecycle matrix results

## Outcome

The existing byte-for-byte reuse receipt generator/verifier now consumes the canonical catalog selection for R-04, R-05, R-06, and R-08 and emits `lifecycle-matrix.json`. It does not infer the selected set from receipt entries. Deferred transports, unselected packages, and provider/runtime dispatch remain excluded; `adoptionAuthorized` remains false.

Every selected row has exactly the original six behaviors in order: success, failure, cancel, restart, duplicate, boundary. R-04/R-05/R-06 use their already executed, selected-byte/test-bound deterministic receipts for success/failure/duplicate/boundary. Cancel and restart have seam-specific N/A reasons because these exact pure synchronous functions start no work, process, request, signal, external I/O, session, or persisted state. R-08's limited design principles expose no executable operation; its five execution behaviors have exact N/A reasons and its boundary is the hash-bound canonical catalog selection with zero selected external bytes.

The receipt now binds the lifecycle matrix digest, so the existing `--verify` consumer rejects matrix, selection revision, descriptor, selected-byte, result, or receipt drift. R-08's Cue product-byte list remains catalog consumer evidence rather than adopted input, but every referenced byte is verified before the basis is accepted. The stale `app/core.mjs` catalog pin found by independent review was refreshed to its current hash; a focused mutation proves changed R-08 consumer bytes now fail with `reuse_manifest_hash`.

## Gates

- Focused Node test: PASS, 6/6. `node --test --test-reporter=spec scripts/reuse/reuse-fixture-receipts.test.mjs`.
- Existing report consumer: PASS. `node scripts/reuse/reuse-fixture-receipts.mjs --verify evidence/integrations/S0/20260916-selected-lifecycle-matrix/receipts` returned `verified byte-for-byte`.
- `git diff --check` on owned files: PASS.

The first generation attempt failed closed because the strict snapshot copied unrelated numeric R-08 catalog facts. The corrected implementation snapshots only the canonical R-08 selection fields. A focused expectation was then corrected so a well-formed changed R-08 commit is classified as changed binding, while structurally invalid R-04/R-05/R-06 revisions remain selected-catalog errors.

## Final hashes

- `docs/reuse-decisions/upstream-source-catalog.json`: `3b989b0632d5236755b3954aba33e09c5fe22a59667161e26da46e9f96ddb297`
- `scripts/reuse/reuse-manifest.mjs`: `400491e0249c49da772f358ea5aca2960fc6570c0234a2e2cc513b059f059097`
- `scripts/reuse/reuse-fixture-receipts.mjs`: `6ff04748bbf18f806b023eb4a0b6633bd4729a9bc19b2de4272ebcf8edb045e8`
- `scripts/reuse/reuse-fixture-receipts.test.mjs`: `32c396455de0f5220552ea47dbbcf97c2ef1f9878d34a5499cbea5d9da679cb5`
- `receipts/lifecycle-matrix.json`: `e2ae88ca05b907f37638792db58ac33993e52d8a8ccd5183ffe7482a750ff705`
- `receipts/receipt.json`: `9ea4da36b408360c55dd4adb93e8fa535ea9592debddb039ea7fce753271ce48`

## Limits

This is the selected fixture/tool and limited-principles scope established by the canonical catalog. It does not qualify deferred model transports, authorize adoption, install or execute external code, or grant product/provider authority.
