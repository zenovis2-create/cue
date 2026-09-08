# P12 release-candidate remediation contract

## Status and ownership

- Base checkpoint: `e50d4eb7517eaa3eca2fc8639e3aafcbcb69c58e` (`NO-GO`). Preserve it unchanged.
- Candidate workspace: `C:\Users\User\cue`.
- Sole writer: the current Hermes Codex parent session. No second coding CLI or agent may write this checkout.
- Any gate overlapping a source or `dist/` mutation is stale even if it exits zero.
- Credential contents are never read, printed, copied into evidence, or committed. Values are always `[REDACTED]`.

## Historical truth

P11's normal-completion, controller-crash, and worker-hard-kill lease tests were first observed GREEN. P12 does **not** relabel those historical tests as RED-first. Their detection power must instead be shown by explicitly labeled mutation/sensitivity runs. P12's newly uncovered behaviors use genuine RED -> GREEN evidence.

The single P11 parent-death failure did not retain enough process identity or timing data to identify whether the numeric PID represented the original worker at the deadline. Its precise historical runtime cause is therefore unknowable from the retained artifact. P12 closes the actionable defect rather than inventing a cause: check `TerminateJobObject`, bound the post-parent-death wait, identify process instances by PID + parent + creation time, and stress the exact candidate.

## Gates

### R1 — terminal enforcement sealing

For `filesystem`, `network_gate`, and `executable_sealing` violations, including preflight throws:

1. poison the correlated turn before replying;
2. abort the shared worker signal;
3. reject every later tool call without invoking the runner;
4. send a bounded best-effort `turn/interrupt`;
5. return terminal `failureKind: enforcement`;
6. block the run as `enforcement_violation` without recovery or retry; and
7. release/advance the writer lease only after the controller runtime has closed.

Required evidence: genuine RED/GREEN tests at RPC, worker-preflight, runtime-provenance, and app-core seams.

### R2 — diagnosable real A/B

Every model tool execution must persist bounded, redacted, ordered provenance: ordinal, call ID, safe executable basename, argument count, timestamps, exit code, violation, and process identity when available. Raw argv and credential material are forbidden.

The single model-facing tool remains `cue_workspace`, but exact file creation/replacement uses its structured `write_text` operation. Cue validates a relative Unicode-scalar path and content, enforces a safe encoded Windows command-line budget, base64-encodes path/content on the host, and performs the literal UTF-8 write only inside AppContainer. This removes shell quoting from model responsibility without moving filesystem authority to the host. The advertised JSON schema is a disjoint `oneOf`; parser enforcement remains authoritative. Generic command mode remains available for bounded checks; unsupported child-spawning and ancestor-traversing commands are explicitly discouraged. Both distinct actual vendor-Codex goals must finish `completed`, produce exact distinct bytes, and have zero enforcement violations. A correct artifact does not rescue a blocked run. Any call after a first terminal violation is FAIL.

### R3 — parent-death containment

- Check the return value of `TerminateJobObject`.
- Replace the infinite post-parent-death wait with a five-second bounded wait and fail closed on timeout/unexpected status.
- Observe wrapper and worker by PID, parent PID, and creation timestamp before/after.
- Run a quiescent sequential stress gate and a quiescent concurrent stress gate against one frozen build. Record each termination latency and require the original wrapper/worker instances to be absent.
- Audit `Cue.Worker.*` profile residue separately.

### R4 — writer lifecycle sensitivity

Keep the original assertions for normal completion, controller crash, and worker hard-kill. P12 adds a genuine prospective RED/GREEN requirement across all three paths: if the atomic terminal transaction cannot delete the writer lease, the daemon must quarantine, retain the lease/write flag, terminalize queued approvals without launching them, and reject subsequent execution. A daemon crash must likewise terminalize every queued approval and prevent late controller settlement from promoting it.

In a disposable checkout, also introduce one narrowly scoped lease-release fault per historical path and show the corresponding original targeted test fails. Label these receipts `mutation/sensitivity`, never `RED-first`. Restore the exact candidate and rerun all three GREEN. Any reviewer that requires impossible retroactive chronology must leave this gate unmet rather than accepting a false claim.

### R5 — harness lifecycle and binding

- Send all agent/supervisor last-message and transcript outputs outside the checkout.
- Use harness-owned `mkdtemp` fixture roots; never recursively delete a caller-provided path.
- Wait for all producers to close before final status.
- Stage the source candidate first, reject every unstaged/untracked non-evidence path, and derive the source fingerprint only from regular stage-0 Git index blobs excluding `evidence/**`.
- Capture the same staged source fingerprint before and after every long gate.
- Ignore only named runtime state; track the verdict and every named reviewable receipt.
- Emit Electron success only after child shutdown, screenshot completion, fixture removal, and log close all succeed.
- The invalid parallel parent-death run that overlapped source/dist edits is explicitly superseded and is not evidence.

### R6 — frozen candidate gates

After the last source/harness edit, in order:

1. build/typecheck;
2. full canonical regression, zero failures;
3. parent-death stress and lifecycle mutation sensitivity;
4. actual distinct A/B with exact content read-back and ordered provenance;
5. effective model manifest (`toolNames == ["cue_workspace"]`, `hostExecutionTools == []`);
6. Electron 44 runtime security values plus an actual visible window;
7. first-run cancel fail-closed;
8. stop/process-death canary;
9. credential-history/path guard, current-tree secret scan, process/profile hygiene; and
10. pre/post fingerprints identical for every long gate.

### R7 — independent review and final binding

Two fresh read-only reviewers independently return terminal JSON with `passed: true`: defensive security and release readiness. They must review the exact staged candidate, all P12 receipts, preserved limitations, and this contract. Unparseable/failed review is FAIL.

Stage the source candidate before running gates. Generate and freeze a staged-index source manifest excluding `evidence/**`; the manifest command must reject unmerged entries and every unstaged/untracked non-evidence path. Each gate and review binds that digest. After all producers exit, the tracked finalizer verifies the source manifest again from the index, verifies the exact hash of every allowlisted receipt and both terminal reviews, rejects unlisted P12 evidence, and writes tracked `evidence/P12/v01_verdict.json` without a future commit SHA. Stage that canonical evidence set and create exactly one descendant candidate commit containing source plus evidence.

After the commit, write the commit-naming attestation outside the checkout and verify:

- `git status --short` is empty;
- the committed source manifest matches staged/committed blobs;
- no ignored runtime directory contains tracked credentials or ledgers;
- committed HEAD blobs reproduce the tracked source-manifest digest;
- the tracked verdict hashes the exact gate/review receipts but intentionally contains no self-referential commit SHA;
- the external post-commit attestation names the exact commit and records the live status time; and
- the verdict is GO only if every required gate above is true.

## Preserved limitations

- `ActiveProcessLimit=1`: commands requiring nested child processes remain unsupported in v0.1.
- Stop evidence covers the exercised canary point, not every possible instruction boundary.
- P3-16 is detect-and-stop, not a network-syscall deny claim.
- P4-2 lacks true process CWD observation.
- P6-3 actual Buzz integration is unverified and is not part of the standalone app boundary.
- General goal verification remains strongest for file-changing goals.
