# Legacy trigger upgrade hardening
Done: migrations039/050 upgrade only their exact historical trigger; comment-marker and modified historical bodies refuse reopening without rewriting that trigger. Existing fresh/reopen and legacy migration cases remain green.
Attempt cap: 2 production revisions. Each pass: targeted readonly-verifier-migration and integration-native-runtime-migration tests, then npm run build exit0. Independent checker reviews final diff/tests before acceptance.
Regression baseline: add adversarial cases and observe failure before production change. Preserve exact preimages. No provider/service/model calls; Qwen stays off.
