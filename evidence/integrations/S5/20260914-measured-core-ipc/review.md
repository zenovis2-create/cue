# Independent review — measured Core to IPC integration

## Review contract

Done means the existing synthetic SQLite fixture drives `registerIpcHandlers` with a real `CueCore`, proves a saved populated fact is readable before prepare through IPC without Core method mocks, preserves a bounded DTO and generic denial, performs no read-triggered capture or database write, replays after reopen, rejects unconfigured/foreign/closed/outer-transaction/malformed cases before callbacks, rejects changed bytes and stored tamper, and keeps missing measurements explicitly unavailable. The exact three-file verbose gate must pass with Core 8, measured UI 8, and evaluation UI 12 tests (28 total); product and test pins and the complete preimage must match.

Attempt cap: two independent gate passes. Every pass runs `npx vitest run test/integration-evaluation-measured-fact-evidence-core.test.ts test/integration-evaluation-measured-evidence-ui.test.ts test/integration-evaluation-ui.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` from `daemon`. A failure permits one retry only with a new evidence-based hypothesis. This reviewer owns evidence only and will not edit product, tests, or docs.

## Verdict

PASS after the bounded root assertion correction. No blocking product or coverage finding remains.

Independent pass 1 reproduced the maker handoff exactly: 3 files, 27/28 tests; Core 7/8, measured UI 8/8, and evaluation UI 12/12. The only failure was an assertion that required `IPC evaluation input denied` for every malformed command even though the shared strict record reader correctly returned `IPC setup input denied` for one hostile descriptor. Both labels are synchronous input denials before Core capture authority. Root preserved the full failing test, used one edit to anchor the assertion to `/^IPC (evaluation|setup) input denied$/`, and left the separate extra-argument assertion exact.

Independent pass 2 command:

`npx vitest run test/integration-evaluation-measured-fact-evidence-core.test.ts test/integration-evaluation-measured-evidence-ui.test.ts test/integration-evaluation-ui.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`

Result: PASS — 3 files, 28/28 tests; Core 8/8, measured UI 8/8, evaluation UI 12/12. Raw reviewer logs and exit codes are retained under `logs/`. Root's final build exit 0 was accepted and not duplicated.

## Coverage findings

The positive case uses `registerIpcHandlers({handle(){}}, core)` with the real configured `CueCore`. A persisted fact with an actual seeded attempt is read through `cue:evaluation` before prepare and returns exact `tool@tool-v2` and `model@model-r3` provenance. The IPC DTO drops fact, enrollment, observation, run, dataset, case, policy, producer digest, evidence digests, contract digests, price digest, candidate/launch/identity/handoff digests, and raw uncertainty strings. It retains only bounded producer class/revision/time, attempt role/state and tool/model identity, measurement availability and safe elapsed/accounting values, uncertainty count, and immutable false trial/promotion flags.

Repeated IPC reads preserve the exact DTO, do not recapture host measurements, and leave SQLite `total_changes()` unchanged. The same persisted fact replays after closing and reopening Core. Closed, unconfigured, foreign-workspace, and local outer-transaction requests return the same generic unavailable DTO. Malformed commands reject synchronously. The preflight assertions retain zero host callbacks and unchanged database writes. Changed evidence bytes and stored lineage tamper also collapse to the generic unavailable DTO, while absent quality, timing, and accounting remain explicitly unavailable.

The test deliberately disables selected lineage triggers and foreign keys and injects terminal-integrity authority to seed its synthetic persisted attempt. This proves Core-to-IPC composition, sanitization, containment, and replay only. It does not prove production measurement, runtime execution, provider/model behavior, native behavior, live UI/Electron behavior, or trial/promotion eligibility.

## Evidence identity

Final pins match 6/6:

| File | SHA-256 | Bytes | Lines |
|---|---|---:|---:|
| `daemon/test/integration-evaluation-measured-fact-evidence-core.test.ts` | `22A1A681F70E2BE6ADA853AF3E18366BD8A67BCFACD7C2AF5B4AA3F79E3933D0` | 22,498 | 112 |
| `app/core.mjs` | `B4A53C1B18FA07B3FF82BC500EC708B8AB38D8E0F9BC96A2B3FC113D5A0914A6` | 70,258 | 1,237 |
| `app/ipc.mjs` | `F49ADEDB2ECCAFC71A68C9E114F48CF5331E37E294307DFDC7CDCD4729F0AF88` | 52,028 | 433 |
| `daemon/src/evaluation/measured-facts.ts` | `6E3D27E123EC24835612F44DD7A1DB8A6E3B534AEF7B5ED3273B6936846A20CE` | 24,118 | 101 |
| `daemon/src/evaluation/measured-fact-evidence.ts` | `60F19625904498FEE9735D8D430F85A805A1CC78E9E34232605DB15FBFFF5A6D` | 5,891 | 74 |
| `daemon/src/evaluation/measurement-contracts.ts` | `7AE5749151CB19C2FC36BE6AEB87703398686485F470119592F9EECB54212447` | 6,786 | 32 |

The normalized original preimage and its full copy both match `4A52C9085E96D6694AE1EF1A222D352EB7EDCFC50A2962734796469B38733D53`. The preserved before-root correction snapshot matches maker final `C4C9C5867A452E56772D6FE9428B527889C71C5FB6678073702B049EBFCD2698`. Scoped `git diff --check` exits 0.
