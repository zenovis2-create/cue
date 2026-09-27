# R04/R05 selected adoption gate results

## Outcome

- The canonical selected basis now carries each selected revision, current selected bytes, source notice, declared seam, explicit patch ledger, and `adoptionAuthorized:false`.
- `incorporation-matrix.json` covers exactly R-04/R-05/R-06/R-08. Cue-native rows bind their thin adapter and actual receipt-generator caller. R-08 is principles-only, has no adapter/caller or incorporated external bytes, and remains unauthorized for adoption.
- `test-authority-matrix.json` separates upstream applicability, Cue regression, and necessary current local CLI boundary for the same selected revision. Cue-native upstream tests are N/A only under the exact Cue-authored/zero-upstream-runtime-bytes rationale. R-08 has explicit no-callable-seam N/A cells.
- The receipt binds both matrix digests; `--verify` regenerates every artifact and compares bytes. The batch76 lifecycle receipt directory was not overwritten.

## Gates

- Expanded focused Node test: PASS, 8/8.
- Exact current CLI: PASS, `reuse fixture receipts: verified byte-for-byte`.
- Script syntax and owned-file diff check: PASS.
- Hostile cases reject missing/extra selected rows, notice omission, implicit patch list, foreign caller, R-08 external bytes/adoption, unjustified upstream N/A, merged Cue/boundary authority, stale test hash, missing boundary artifact, selected revision drift, and descriptor/current-consumer byte drift.

## Final hashes

- `reuse-manifest.mjs`: `45c0d712f8e6f9768859343cde7c7ebce66353ff3b84a43048a94ca76b65a86b`
- `reuse-fixture-receipts.mjs`: `ac1cf1f5c4b108318384a85e76b53243e1f95fc2f7da1e5f1caa09e6ace021df`
- `reuse-fixture-receipts.test.mjs`: `94e8d0fe3c23454a3d1039aefd0fe71952339bf820cb85360ccad8618ffef586`
- `incorporation-matrix.json`: `41bf938c78bf67be5250af853df81197d44b0b9b3c7f8996247daf4cb91785f4`
- `test-authority-matrix.json`: `fd5c74cdabf3f7e3fc304044beec58447269fa0cae0fe7ce520b3ddb71ca4d6f`
- `receipt.json`: `5e8fe84e7f6ef628feaf2b3b9666727f1c3a61c50a37eb0d33fe2a6a56d129da`
- Retained batch76 lifecycle `receipt.json` remains unchanged at `9ea4da36b408360c55dd4adb93e8fa535ea9592debddb039ea7fce753271ce48`.
- Canonical catalog remained unchanged at `3b989b0632d5236755b3954aba33e09c5fe22a59667161e26da46e9f96ddb297`.

## Limits

- These gates cover the current selected fixture/tool components and R-08 limited principles only. They do not authorize external adoption, deferred transports, provider qualification, product/runtime dispatch, or upstream product execution.
- Passing the local receipt CLI is the necessary boundary for these pure selected seams; no live/provider/model/network or external CLI call occurred.
