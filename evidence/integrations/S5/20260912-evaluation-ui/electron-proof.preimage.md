# Evaluation UI proof preimage receipt

Static preflight disposition: **BLOCKED**

Preserved pre-correction `electron-proof.mjs` SHA-256: `95DB635DEAEA8B6BBB19AE741CE0CE73BAD9BA0C8505B2194E8FA4F09AD5D79D`.

Blocker: the proof captured the genuine installation generation before dynamic Core/IPC/compiled imports, but checked `assertCurrent()` only after the scenarios and during cleanup. The installation identity contract requires a check immediately after dynamic imports and before each issuance or dispatch boundary. This receipt preserves the immutable pre-correction identity and finding; the corrected proof remains the executable path. Actual Electron executions at discovery: zero.

Correction hypothesis 1 of 2: use one phase-tagged guard wrapper, check immediately after dynamic imports, before the scenario's primary prepare event, before both direct fixture Core issuance calls, before all five `cue:evaluation` handler dispatches, and inside the direct Core evaluation wrapper. Assert and record the exact expected phase sequence before accepting the run.

## Actual attempt 1 preflight record

Attempt 1 ran once and is immutable. It failed at initial selected hashing because `evaluation/canonical` does not exist; the actual dependency is `evaluation/comparison`. The failure occurred before the child `try`, producing an unhandled rejection and parent deadline termination rather than child failure/result receipts. Evidence hashes: intent `AF9A789D682231EC1E462DD7E4DD461E2CBC930834C3ED91F9C20D9C1A62571C`, process log `B28F7D58E11D79FAD79ACFC51875861CF9DB6DB3D74FC5FB59C41FE3A495EFD5`, final verdict `3227B91BCD78CC5FAB3120863D530BB24AA419B0B62C0A51A659620C11F6A9C7`, owned state `DC957296EF8B7386CAAB99D5B3AD98EC2639B67E2D877C4BD8744BF4F7CDFF12`. No attempt 2 intent or output may be created during this correction.
