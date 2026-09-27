# Independent generated-host guardian polling correction

Result: no actionable blocker found in the bounded correction. Independent focused host suite **15 PASS** at 2026-09-11 21:03:27 local time, duration 11.33 seconds. No model/provider calls; no changes to the failed canary database or receipts.

Reviewed source hashes:

- `app/generated-json-host.mjs`: `EB212CC29904B7AE19538FB7830930D204D8D5DEB263EE9AFBA9CB40490ACAC0`
- `daemon/test/integration-generated-json-host.test.ts`: `E54102D6B73ACC7AA9535BA508A88836D36DBC90F8E6B289A7DB68FDC5CB52A2`

The existing private execution/context ownership check remains before cleanup observation. Only an independently observed residual result is re-observed, at intervals up to 50ms within a monotonic ten-second wait window. Each observation still goes through the existing OS observer and durable receipt store. Unknown does not become clean and is not polled. An aborted signal wakes the interval and returns the latest observed result; the abort listener is removed and timer cleared. Only the final observed receipt is placed in the host's cleanup map, so a brief guardian exit delay no longer freezes an early residual receipt before a subsequent clean observation arrives.

The independent regression run exercised delayed guardian disappearance through real host/driver/ledger logic with a synthetic process-presence seam, persistent residual, cancellation, unknown identity and ordinary host regressions. Delayed case reached verified acceptance; persistent case remained unverified after 10030ms; cancellation completed its wait in 37ms; unknown remained a single unknown observation. The test cleans up its process mocks after each case. Existing actual Node dependency import regression also passed.

Command: `npx vitest run test/integration-generated-json-host.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` from `daemon`, exit 0. Maker separately reports build exit 0. A narrow glob search used unsupported shell glob expansion and failed after hashes were read; a direct test-file result nevertheless confirmed `vi.restoreAllMocks()` and did not affect the test gate.

Limits: ten seconds bounds the added wait/re-observation scheduling window, not an arbitrary stalled filesystem/persistence callback; the existing outer driver deadline remains in place. These regressions are fixture evidence, not a repeated live Qwen canary. The historical canary remains blocked, checker never ran, no acceptance was issued, and its two-request allowance remains exhausted. Product source changed, so prior qualification subjects cannot qualify the new host without fresh measurement and separately authorized live execution.
