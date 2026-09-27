# Measured Core IPC maker handoff

## Scope and result

Test-only integration wiring was added to the existing synthetic SQLite/Core fixture. `registerIpcHandlers({handle(){}}, core)` now drives the real `cue:evaluation` `measured-fact-read` path without mocking Core methods. No product files were edited.

The source-edit attempt cap was two and is exhausted. Source is frozen for handoff with one assertion-label failure.

## Passes

### Pass 1

- Build exit: 2.
- Vitest was not run (`pass1-vitest.exitcode` records the sentinel 999).
- Failure: changing `reopen()` from `CueCore` to `{core,api}` broke two existing direct-Core callers at TypeScript compile time.
- New hypothesis: preserve the original fixture return contract and register IPC locally beside the reopened Core.

### Pass 2

- Build exit: 0.
- Vitest exit: 1.
- Actual verbose totals: 3 files; 28 tests; 27 passed, 1 failed.
- Precise file counts: measured-fact Core 8 (7 passed, 1 failed); measured-evidence UI 8 passed; evaluation UI 12 passed.
- Sole failure: the malformed-input loop expects every case to throw `IPC evaluation input denied`; one hostile descriptor is rejected by the shared strict record reader as `IPC setup input denied`. It remains a synchronous API-input rejection and the test reaches no callback/capture assertion failure. The cap forbids another source edit; checker/root should decide whether the expected error should accept the generic `denied` boundary label.

Raw command output and exit codes are retained as `pass1-build.log`, `pass1-build.exitcode`, `pass1-vitest.exitcode`, `pass2-build.log`, `pass2-build.exitcode`, `pass2-vitest.log`, and `pass2-vitest.exitcode`.

## Coverage added

- Local stored fact reads successfully before prepare and equals the exact sanitized DTO.
- IPC read/replay/reopen remains stable, causes no recapture, and causes no writes.
- Unconfigured, foreign-workspace, closed-Core, and outer-transaction paths return the same generic unavailable response; preflight cases have zero callbacks and no writes.
- Changed evidence bytes and stored lineage tamper return the sanitized unavailable response.
- Missing quality, timing, and accounting stay explicitly unavailable with readiness and promotion false.
- Malformed API inputs and extra invocation arguments reject before capture authority.

The fixture remains synthetic: lineage triggers/FKs are dropped for seeding and terminal integrity authority is injected. Default host, live capabilities, model/server/network/native/live Electron remain untouched.

## Preimage and pins

- Original full preimage: `integration-evaluation-measured-fact-evidence-core.test.ts.preimage`
- Original test SHA-256: `4A52C9085E96D6694AE1EF1A222D352EB7EDCFC50A2962734796469B38733D53`
- Final test SHA-256: `C4C9C5867A452E56772D6FE9428B527889C71C5FB6678073702B049EBFCD2698`
- Read-only `app/core.mjs`: `B4A53C1B18FA07B3FF82BC500EC708B8AB38D8E0F9BC96A2B3FC113D5A0914A6`
- Read-only `app/ipc.mjs`: `F49ADEDB2ECCAFC71A68C9E114F48CF5331E37E294307DFDC7CDCD4729F0AF88`
- Read-only `daemon/src/evaluation/measured-facts.ts`: `6E3D27E123EC24835612F44DD7A1DB8A6E3B534AEF7B5ED3273B6936846A20CE`
- Read-only `daemon/src/evaluation/measured-fact-evidence.ts`: `60F19625904498FEE9735D8D430F85A805A1CC78E9E34232605DB15FBFFF5A6D`
- Read-only `daemon/src/evaluation/measurement-contracts.ts`: `7AE5749151CB19C2FC36BE6AEB87703398686485F470119592F9EECB54212447`
