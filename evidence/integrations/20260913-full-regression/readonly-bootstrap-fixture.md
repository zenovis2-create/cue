## Readonly coordinator transport gate

- Done: the offline mocked-coordinator test proves the bootstrap ends in byte `0x0a`, never literal `\\n`, exact PowerShell arguments are retained, and a CRLF PID line is parsed while failed child exit cannot produce identity or cleanup receipts.
- Attempt cap: 2 focused runs (one RED against the old parser, one GREEN after the minimal parser fix).
- Every pass: `npx vitest run test/integration-readonly-verifier-bootstrap.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` from `daemon`.
- Failure handling: retry only for a new fixture hypothesis; otherwise return evidence to the root agent.

## Result

- Attempt 1: RED before the parser change, but stopped at `readonly_control_drift` because the fixture used a placeholder launcher digest.
- Attempt 2: GREEN after binding the real temporary launcher digest and applying `\r?$`; 1 file and 1 test passed, exit 0.
- `npm run build`: PASS, exit 0.
- The green test observed `verifyProcessesDead([321])` from a CRLF PID line while the nonzero child exit retained `outcome: failed`, `identityRef: null`, and `cleanupRef: null`.
