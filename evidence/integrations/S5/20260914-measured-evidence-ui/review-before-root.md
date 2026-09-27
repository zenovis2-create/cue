# Independent measured-evidence UI review

## Verdict

**BLOCKED.** The pinned source and captured preimages are internally consistent, and the focused offline gate passes 3 files / 24 tests. Three product-contract defects remain in the frozen implementation, so the passing component tests do not support a PASS verdict.

## Acceptance and verification

Done required the exact manual `measured-fact-read` command before prepare, delegation only to `Core.projectEvaluationMeasuredFactEvidence({factId})`, a descriptor-safe bounded summary, requested/returned fact identity binding, fixed unavailable errors without detail leakage, no evidence references/bytes/quality score/accounting totals, faithful producer and missing-measurement display, no automatic read, and stale/error/new-run fencing. This review did not run Electron, a native process, server, network, provider, or model.

- Final pins: **5/5 match** `final-pins.json`.
- Captured preimages: **4/4 match** `preimages.json`.
- Maker receipt: build exit 0 on both passes; pass 1 tests 23/24 and pass 2 tests 24/24. The recorded first failure and fact-identity correction are coherent.
- Independent focused gate (run once from `daemon/`): `npx vitest run test/integration-evaluation-measured-evidence-ui.test.ts test/integration-evaluation-measured-fact-evidence-core.test.ts test/integration-evaluation-ui.test.ts` -> exit 0, **3 files / 24 tests**.
- The maker's passing build was not duplicated.

## Blocking findings

### 1. Arbitrary accounting kind is emitted and rendered as trusted measurement text

`app/ipc.mjs:169-172` accepts any string up to 64 characters for `accounting.kind`, does not bind availability to the kind, and copies that string into the renderer DTO. `app/renderer/renderer.js:275` displays it verbatim whenever availability is `available`. A hostile Core return such as `{availability:'available', kind:'C:/secret'}` therefore crosses the IPC boundary and appears in the UI. The protected Core only produces `unknown`, `local-invocation`, or `monetary` (`daemon/src/evaluation/measured-facts.ts:52-61`), so the IPC projection can and should allowlist those values and enforce `unknown <=> unavailable` while the measured kinds imply `available`. The hostile-contract test does not cover this leak or inconsistent pairing.

### 2. Execution locking does not invalidate or clear measured-fact reads

The measured read owns `evaluationMeasuredFactGeneration`, but `lockEvaluation()` at `app/renderer/renderer.js:278` increments only `evaluationGeneration`; it neither increments the measured generation nor clears its output. `syncEvaluation()` at `app/renderer/renderer.js:168-179` disables the measured form only for `evaluationMeasuredFactBusy`, not for the execution lock. Consequently, an in-flight lookup started before approval can resolve after execution begins and render stale evidence, and a previously rendered fact remains visible across the lock. This contradicts the plan's old/stale clearing requirement. The new-run test covers `selectEvaluationRun()` with a different run ID, but no test covers approval/execution locking or a same-run transition.

### 3. Valid stored facts with 65-1024 attempts are reported as unavailable without a declared truncation contract

The protected Core admits up to 1024 execution subjects (`daemon/src/evaluation/measured-facts.ts:68`), while `app/ipc.mjs:168` rejects arrays longer than 64. This is safe in size but not faithful: a valid saved fact becomes the generic unavailable response rather than a bounded summary. The UI does not disclose the 64-attempt limit or truncation in `app/renderer/renderer.js:275`, and the DTO has no total/truncated metadata. Either the bridge must accept the Core bound, or it must deliberately project the first bounded page and expose safe count/truncation metadata. The focused test exercises one attempt only.

## What is verified

The command uses the exact operation and fact ID, is allowed before prepare, and calls only the protected Core evidence method. Exact command shape, proxy/accessor rejection, returned fact identity, authority, trial/promotion flags, fixed error response, arbitrary uncertainty-reason suppression, manual-only invocation, offline/host producer labels, missing quality, timing display, fact mismatch, generic failure, and different-run generation invalidation have executable coverage. Raw evidence digests/references, quality score, accounting totals, and exception text are absent from the success/error envelopes exercised by the test.

## Limitations

This is component-level mocked IPC/DOM evidence plus a separate synthetic SQLite/Core regression using injected terminal authority and test lineage. It does not establish a real Core-to-IPC happy path, live Electron appearance, production measurement qualification, runtime/provider accuracy, default-host availability, trial readiness, or promotion authority. The local model remained off and was not contacted.
