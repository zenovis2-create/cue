# Native identity commit gate — offline maker evidence

Final independent offline gate: broker_review reports **34 PASS / typecheck 0 / no blockers**. Following that review, the final daemon build exited 0; all recorded source hashes remained unchanged, and compiled-hashes.json records resulting compiled artifacts. Product source is frozen for independent actual-native, no-model QA. Maker has not executed native/model calls. The pending statements below describe earlier checkpoints, not the final offline status.

## Independent correction 1 (00:02 KST)

Reviewer found that the first adapter draft could launch inside an external transaction, allowing later rollback to discard the session identity. Both invocation entries now reject db.inTransaction before resolving binding or creating the launcher/session. A real SQLite outer-transaction test for both lanes confirms binding 0, mock launch 0, session rows 0. Focused suite is now **9 PASS**, typecheck exit 0. Final rebuilt artifacts and independent review remain pending at this correction point. Earlier 33-PASS snapshot hashes are preserved in pre-correction-hashes.json; hashes.json describes corrected source. This static finding is not represented as a previously executed failing test.

2026-09-12 00:01 KST. Source hashes: hashes.json; original five production sources retained in preimages.json and .preimage files. Cleanup observer preimage also retained. Later authorized host base wiring and test edits have no separately captured preimage; do not infer that every modified file has one.

## Gates

- PowerShell AST ParseFile: zero syntax errors; launcher not executed.

- NEW mocked-launcher/actual SQLite tests: 8 PASS. No model, network or native launcher calls.
- Combined offline commit/store/local host/legacy host: 33 PASS (the cleanup wait case was subsequently corrected, below).
- Final daemon `npm run build`: exit 0.
- First build found TS2739 in the new test: verifyCleanup arguments reversed. Corrected to (context, execution), and asserted unresolved at 4999 ms then unknown at 5000 ms. Final new suite 8 PASS. The earlier pass for that one reversed-argument case was not a valid timeout proof and is superseded.
- Independent review and actual native no-model gates pending; existing Windows native suites were deliberately not executed.

## Implemented boundary

Launcher emits actual launcher and owned guardian process creation FileTimes after guardian readiness. Shared parser bounds exact host identity fields. Existing suspended-client observation, PID, profile SID and control pins combine with the exact persisted launcher session. Host task/profile bases are mandatory before launch and compared to the complete expected Windows paths, preserving observed bytes. Production adapters commit identity synchronously before transport invocation or checker authorize_check, then recheck abort. Store failure means neither action occurs. Abort during SQLite commit retains the committed identity but still denies service invocation.

The host-owned identityRef is separate from native observations. Optional result typing preserves older fixture callers; production success cannot bypass the mandatory commit. Native observations cannot write this field.

cancel() waits at most 5 seconds and rejects unresolved; original result/completion settles only on actual child close. Independent cleanup observation waits at most 5 seconds for the original result and records unknown if unavailable. Neither timeout fabricates process exit, cleanup ACK or acceptance. Sessions and committed identities remain durable; later native close remains observable and cannot rewrite earlier returned observations.

Direct broker=false qualification diagnostics validate and journal the new host frame with launcher/guardian PID linkage, but do not persist identity or add authorization ACK. They may execute before host observation. Production qualification legs use the same mandatory adapter commit. No claim that every qualification diagnostic now has durable identity is made.

Measurement required source/test footprint includes the shared commit helper and store. Native/model eligibility must be freshly measured under the changed footprint; no prior live DB was repaired and no additional inference request is authorized.
