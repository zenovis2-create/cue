# Independent fresh Electron gate preparation review

Reviewer: broker_review, 2026-09-11. PASS for preparation after two diagnosed corrections. This is not an actual Electron/model/workflow result or authorization to exceed the parent's distinct gate allowance. No --execute command, network request, model call, rebuild, or product edit occurred during review.

Completion criterion: contract/source/API review, focused offline gate, exact source hashes, correction history and limits. Correction cap 2; used 2, both resolved.

## Current identity and independent gates

| File | SHA-256 |
| --- | --- |
| scripts/reuse/local-json-electron-gate.mjs | B0F4379E7FFE3480281908AE2A43DF894B8F61F401F28448E62A433507116774 |
| daemon/test/integration-local-json-electron-gate.test.ts | 39CB92754F6D39B7A7CEB1BA86C03D2586C7CA6C2F478153715F7055C5777795 |
| app/qualification-start.mjs | BD70B229631154AFD346C703743877AF3D39F6F694C21EFE24CC595B60A764B8 |
| daemon/test/integration-qualification-start.test.ts | 876C3509A591B63949C0ADFEAF3D1136F9C027D3EBCACA48F87F90A9A3B6DDAA |

From daemon, `npx vitest run test/integration-local-json-electron-gate.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`: exit 0, 6 PASS, 22:54:21 KST, 195 ms. Includes a real SQLite uncheckpointed WAL backup and synthetic workflow row linkage positive/negative checks. `npx vitest run test/integration-qualification-start.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`: exit 0, 5 PASS, 22:51:36, 163 ms. Entry tests are VM fixtures, not real qualification. Maker's prior typecheck/build results are separately attributed; no redundant build during this review.

## Resolved findings

1. Original copyFileSync of the main SQLite file could omit uncheckpointed WAL after forced termination. Replaced with node:sqlite backup from a read-only source connection; source and copied database both require integrity_check=ok. The independent WAL fixture proves a row still in WAL survives in the reopened standalone backup.
2. Original audit checked accepted hashes/counts without required target/evaluation lineage. Added explicit target/run/producer observation joins plus existing strict readAcceptanceHistory and generated-output store read on a read-only better-sqlite3 connection. The real APIs require transaction and Buffer semantics, so the harness correctly does not pass node:sqlite DatabaseSync to them. Historical readers do not execute checkers/models or authorize writes. Synthetic audit tests now exercise workflow success and target/evaluation mismatches; strict-reader correctness is reused from its existing separately reviewed tests, not established by the synthetic rows.

## Execution contract review

Exact execution arguments require a script SHA and parent installation digest. Parent captures before importing product modules, checks before and between phases, and checks again in finalization. Direct installed Electron launches avoid npm prestart rebuilds. Parent Node generation is explicitly distinct from child Electron runtime. Qualification entry rejects absent Electron before protected application import and emits actual process.versions metadata. Workflow observer records the same tuple and the harness compares both child tuples.

One newly created owned root contains data, sibling workspace and evidence. Settings are created through the real V2 API with maxInvocations=2, timeout 120 seconds, output 65536 bytes/2048 tokens. No capability/acceptance rows are inserted by the runner. Child environment removes inherited NODE_OPTIONS, ELECTRON_RUN_AS_NODE and conflicting live/data/worktree flags case-insensitively. Qualification has no observer; workflow receives only the fixed generated owned observer, hashed before and after execution.

Qualification must close, pass the ledger audit, return code 0 and a clean eligible Electron summary before workflow starts. Workflow uses electron . and existing DOM form/approval/preload IPC; it does not replace host/executor/guard/admission. Both process calls are single-shot. Deadlines attempt taskkill only for the owned child PID tree; unresolved closure remains a failure. Logs and raw ledger exports precede semantic audit where possible. Backup failure/source drift forces passed=false, and owned paths are retained rather than blindly removed. A screenshot failure is recorded separately and does not bypass app.quit or ledger audit.

Final success requires one production-model qualification journal, six live pass capability rows, one producer plus one checker completed/clean attempt, exact approved input/output, strict accepted history and generated provenance, durable clean receipt references, two local dispatch reservations and no monetary reservation/receipt or writer lease. This is dispatch evidence, not monetary billing.

## Remaining scope limits

The two-request ceiling follows one qualification process, one workflow, and fixed no-retry production code, corroborated by persisted production journal/output attempts. There is no independent provider-side HTTP counter. Failed/unknown delivery consumes the parent's allowance; retained capacity does not authorize another invocation. Script hash arguments are not a durable cross-run authorization token: prohibiting a second runner invocation is an explicit operator contract.

The workflow preload is extra trusted QA code; neither it nor parent manifests prove hostile preload resistance or an unmodified fresh workflow closure. The real production generation guard remains authoritative. The owned CUE_USER_DATA path refers to Cue state; this script does not independently relocate Electron's own default session profile. Closed Electron child plus durable cleanup receipts does not constitute an independent machine-wide process census. Failed unresolved processes/paths require later bounded observation before removal.

This review does not claim actual visual correctness, current live M evidence, native addon ABI compatibility across both actual processes, accepted workflow, provider stop, pricing, performance, or a complete goal. Final live results must preserve failure/unknown states and be audited independently. The historical failed Node canary and its exhausted two requests remain separate and unchanged.
