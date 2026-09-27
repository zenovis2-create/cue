# Independent current regression

Build: PASS (exit 0). One full serial Vitest execution: **FAIL**, 746 passed / 2 failed / 5 skipped, 101 files, 684.69 seconds. Only explicit suite exclusion was test/p10c-manifest.test.ts. The five normal conditional skips remain distinct from this exclusion. No opt-in live model/vendor/Orca flags were enabled; qualification tests used injected model transport fixtures. Native sandbox and Electron fixture tests did execute.

Full command and timestamps: run-result.json. Complete original output: vitest-full.log. Structured assertions: vitest-results.json. No broad retry was performed. The 243-file source inventory was identical before and immediately after that full run (source-hashes-before.json, source-hashes-after.json, source-drift.json).

## Diagnosed failures and independent correction verification

1. scripts/p11-electron-proof.mjs:96 expected the old six-function preload API and rejected the new bounded report method. Consequently test/p12-electron-proof-result.test.ts:34 never reached its intended forced cleanup failure branch. Parent added only report to the exact API list. The cleanup failure assertion remained unchanged and now passes.
2. daemon/test/p4.test.ts:51 scanned all source files for spawn calls, including the new fixed model-boundary-probe.cjs:14 diagnostic. The diagnostic uses fixed executable/arguments inside the qualified AppContainer to measure process denial; model-only-launch.ps1:367-369 selects it only for QualificationHarness. Parent replaced the one-file expected list with the exact sorted two-file list and clarified scope; it did not broadly exclude CJS or relax the host launch scanner. The separate P45 architecture positive control still rejects an introduced unowned spawn.

One authorized focused verification: p4 + p45 + p12-electron-proof-result, **19 passed / 3 conditional skips**, exit 0, 26.78 seconds. Exact command and output: focused-correction-result.json / focused-correction.log. Corrected hashes and inventory delta: correction-hashes.json. This focused green result does not rewrite the historical full-run failure as a full-suite pass. No product edits were made by this reviewer, and no second build was needed for test/proof-script-only changes.

## Teardown and limits

Read-only inventories after full and focused runs found no matching native/proof worker processes, no Cue.Model temporary/package directories, and no model profile mappings. Six cue.worker registry monikers existed at the first inventory and remained after focused verification; without a pre-full baseline their origin cannot be attributed. They were not deleted and are not claimed clean. See teardown-observation.json and teardown-after-focused.json. This is scoped observation, not proof that every possible unrelated process/profile is absent.

The source inventory includes daemon source/tests/migrations, app files, package manifests and build config; it is not an executable dependency qualification manifest. Evidence output files and unrelated scripts are outside that inventory. Current corrected proof-script hash is captured separately. No model eligibility, actual model quality, or fresh live canary claim follows from this regression.
