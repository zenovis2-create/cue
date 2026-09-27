# Selected reuse lifecycle correction

The original maker result and receipts are retained as failed intermediate evidence. Root corrected the receipt basis to consume the actual fixed catalog, selected revisions, descriptors and selected file bytes for R-04/R-05/R-06. The verifier is also pinned. Current and fallback receipts must match the exact current trusted selection; caller-supplied fallback pins grant no authority.

Measured gates: `node --test scripts/reuse/reuse-fixture-receipts.test.mjs` 5/5; daemon `integration-reuse-manifest.test.ts` 8/8. Independent results and exact source hashes are in [independent-review.md](independent-review.md). Root combined gate also passed the manifest 8/8; its unrelated Git fixture failures are preserved in the batch70 raw log.

This is selected fixture/tool receipt validation. It does not introduce a production provider transport, qualify R-08 under this receipt contract, authorize adoption, or close R03–R06. The first generation correction rejected a catalog number through the strict snapshot function; the second narrowed the snapshot to the selected records while retaining the strict validator. Both attempts remain recorded.
