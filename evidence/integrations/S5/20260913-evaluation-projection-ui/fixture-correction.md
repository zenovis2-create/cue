# Root test-only correction contract

Maker stopped after cap2: focused 16 assertions passed but unhandled JSDOM teardown rejection makes the gate FAIL. Earlier build is not a final source build.

Done: make stale-projection fixture await a distinguishable second prepared run before closing DOM; focused UI/Core/trials gate exit0 with no unhandled errors, final daemon build0 and changed JS syntax0. Attempt cap2; every pass runs focused gate and syntax; build after gate succeeds. Failure requires a new hypothesis; preserve failures. Root owns only this fixture; independent Sol checker owns review. No product edits or live calls.

Pre-correction UI test SHA256: A44F2EEE058D612358EB05D7023AA6AC18BC39BB33FBC7E2E213C9267E203563

## Pass1 result

Only the stale projection fixture changed: second prepare returns distinct run-b, and test awaits its rendered identity before resolving the delayed projection and closing DOM.

Focused3 files16/16, no unhandled errors, exit0 (87a5d9). Final daemon build exit0 (25a5f0). JS syntax and scoped diff-check exit0 (97c219; line-ending warnings only). Final file hashes: final-pins.json. Maker failed gate remains FAIL; this is root correction evidence, pending independent review.
