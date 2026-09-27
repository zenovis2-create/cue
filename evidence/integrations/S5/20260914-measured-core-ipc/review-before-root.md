# Independent review — measured Core to IPC integration

## Review contract

Done means the existing synthetic SQLite fixture drives `registerIpcHandlers` with a real `CueCore`, proves a saved populated fact is readable before prepare through IPC without Core method mocks, preserves a bounded DTO and generic denial, performs no read-triggered capture or database write, replays after reopen, rejects unconfigured/foreign/closed/outer-transaction/malformed cases before callbacks, rejects changed bytes and stored tamper, and keeps missing measurements explicitly unavailable. The exact three-file verbose gate must pass with Core 8, measured UI 8, and evaluation UI 12 tests (28 total); product and test pins and the complete preimage must match.

Attempt cap: two independent gate passes. Every pass runs `npx vitest run test/integration-evaluation-measured-fact-evidence-core.test.ts test/integration-evaluation-measured-evidence-ui.test.ts test/integration-evaluation-ui.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` from `daemon`. A failure permits one retry only with a new evidence-based hypothesis. This reviewer owns evidence only and will not edit product, tests, or docs.

## Pending verification

The maker reports build exit 0 and 27/28 tests with one expected-error-label mismatch. Independent gate and pin verification follow below.
