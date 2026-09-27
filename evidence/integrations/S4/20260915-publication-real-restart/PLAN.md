# A04 real publication crash/reopen gate

Recorded before creating either new test file.

## Goal

Done when a real child process persists a final-publication intent, performs the native existing-file write, emits exact OS identity and post-effect/pre-result facts, then is killed while blocked before result persistence. A distinct child must reopen the same SQLite file, run production `reconcileInterruptedWrites`, preserve the actual bytes, retain a pending publication and exact lease, block root/attempt without automatic resume, and report acceptance 0, receipt 0, replay execute 0, and replacement attempt 0.

False done includes an in-process exception, a mocked write, intent created after the effect, PID-only attribution, graceful completion, cleanup-only evidence, or a reopened database without production reconciliation.

## Trigger

- Type: manual bounded implementation assigned by root from read-only A04 discovery.
- Input schema: mode (`crash-window` or `reopen`), absolute SQLite path, canonical worktree path, and replacement bytes fixed by the fixture; plus current publication store/native helper/recovery source and reviewed existing tests.
- Preconditions: new-file-only source scope; no product edits or build initially; independent preflight before actual; root signal after UI5 completion.

## State

- Durable state: SQLite intent/result, attempt/root/lease/recovery rows, actual file bytes, raw process frames/logs, full absence preimages, source/product hashes, and reviews.
- Transient state: exact child processes and their stdout/stderr streams.
- Idempotency key: publication ID `publication-real-restart`; an existing intent returns its stored pending state without authority or execute callbacks.
- Replay inputs: frozen new test/fixture hashes, exact command, environment gate, platform, and root signal.
- Completion marker: fresh-child exit 0 plus parent assertions over both raw frames, distinct exact identities, database rows, and bytes.

## Tools

| Tool | Purpose | Success signal | Failure signal | Timeout/retry |
|---|---|---|---|---|
| `node --check` | parse new JS fixture without running it | exit 0 | syntax failure | each offline revision |
| `tsc --noEmit` | typecheck new parent test | exit 0 | compile failure | each offline revision |
| Vitest environment-gated actual | run real child/write/kill/reopen scenario | exit 0 with one actual pass | nonzero/missing frames/identity or cleanup failure | one coordinated attempt |
| SHA-256 | bind source/product/evidence | all hashes match | mismatch | no blind retry |

## Safety Gates

| Gate | Blocks when | Recovery |
|---|---|---|
| Scope | existing product/test source would change | stop; only two new source files |
| Actual authorization | environment gate/root signal/independent clearance missing | skip actual |
| Identity | child PID/creation pair differs at kill boundary | refuse kill and preserve evidence |
| Ordering | durable intent or committed native effect is absent before kill | fail without claiming crash window |
| Recovery | fresh PID does not run real reconciliation or creates another attempt/execute | fail closed |
| Budget | more than two offline revisions or one actual attempt | stop and hand off |
| Cleanup | exact process or canonical temp root cannot be verified | quarantine and retain evidence |

## Observe-Decide Rules

- Done when every goal fact has source-bound raw evidence and the coordinated actual exits 0.
- Retry when an offline failure has a changed hypothesis and the two-revision budget remains.
- Replan when two offline revisions are spent or the API/order assumption is false.
- Escalate when root coordination or independent clearance is missing.
- Quarantine when exact child identity, file effect, database state, or cleanup is uncertain.
- A provider, session reconnect, power-loss, new-file, rename, Electron, local endpoint, or global S3 claim is outside this gate.

## Telemetry

- Required logs: full stdout/stderr and terminal exit for every offline and actual command.
- Required fields: mode, PID, createdAt, intent/result counts, write outcome/digest/bytes, reconcile count, root/attempt state, lease/receipt/acceptance/attempt counts, replay callback counts, and exact cleanup.
- Artifacts: PLAN, new-file absence manifest, source files, raw logs/exits, maker, reviews, result, and final pins.
- Operator report: revisions, gate results, actual ordering, cleanup, limitations, and next action.
- Metrics: offline revisions, actual attempts, child PIDs, callbacks, row counts, and byte hashes.
- Trace: `unit=A04-publication-real-restart`, revision, attempt, phase, status, evidence path.

## Verification

- Unit checks: fixture syntax and TypeScript compile.
- Integration checks: the new real child-process test plus existing publication/recovery/orchestration regressions.
- Dry run: `node --check` and `tsc --noEmit`; actual test remains environment-skipped.
- Live canary: one local Windows child/native existing-file write/kill/reopen execution; no provider/model/Electron/local8085.
- Scorecard: loop contract score 100 required; documentation is not runtime proof.

## Attempt caps and commands

Offline cap: 2 changed revisions. Every pass runs `node --check test/fixtures/integration-driver-publication-crash-child.mjs` and `npx tsc -p tsconfig.json --noEmit`, preserving raw output and exits. Actual cap: 1 after independent review/root signal, using the combined five-file command with `CUE_ACTUAL_PUBLICATION_RESTART=1`. No automatic actual retry.
