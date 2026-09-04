# Phase 10 code review

Status: **BLOCK**  
Recommendation: **REQUEST_CHANGES**

Scope reviewed: current worktree diff (`app/core*`, IPC/preload/main, AppContainer launch, Codex session/tool-home, new `daemon/test/p10.test.ts`) and `evidence/P10`. Existing tracked P1--P9/release tests were not modified in the current diff; `daemon/test/p10.test.ts` is new.

Skill-perspective check: **unavailable**. The required `remove-ai-slops` and `programming` skills were not present in the supplied available-skills catalog, and a local SKILL.md search found neither. Their requested criteria were therefore applied directly. The diff violates both perspectives: several P10 tests are implementation/static mirrors or test a different launch path, and the recovery loop is needless-looking production logic that does not perform the claimed recovery.

## CRITICAL

### C1 — Real Codex execution is not working; the core P10-3 gate is failed

- Evidence: `evidence/P10/p10_test_output.log` reports `expected 'blocked' to be 'completed'` in `live()` and then all 12 P10 tests are skipped. `evidence/P10/p10_codex_console.log:12644-12647` records PID 49232 followed by `failed to canonicalize CODEX_HOME ... Access denied (os error 5)`.
- Consequence: there are no two successful goal-specific worker outputs, no completed real-worker run, and no passing P10 evidence. P10-2, P10-3, P10-4, P10-7, and P10-8 cannot be passed.
- Likely access-denied cause: the worker is launched as an AppContainer whose dynamic SID receives an ACE only on `$payload.cwd` and the exact `codexHome` path (`daemon/src/appcontainer-launch.ps1:70-81`). The actual test home is a descendant of `C:\Users\User\cue\daemon`; Codex canonicalizes the full absolute CODEX_HOME path, but no explicit traverse/read access is granted to its ancestor chain. An AppContainer token cannot rely on the normal user traversal privilege. The launch code supplies no verification that the ACE grants effective access before `CreateProcess` (`daemon/src/appcontainer-launch.ps1:82`).
- Required: make the isolated home readable/writable by the worker using a minimal, verified ACL arrangement that supports canonicalization (including required traversal), then repeat two real goal runs and preserve their independent evidence. Do not claim PASS based on a created wrapper PID.

### C2 — Claimed automatic recovery never launches another worker

- `app/core.mjs:59` creates `RecoveryCoordinator` and repeatedly calls `recover()` in a synchronous `while` loop. It only appends recovery records; it never calls `launch`, `spawnVendorCodexInAppContainer`, or a restart function. Thus level ③ records four attempts without a single actual retry.
- This directly fails P10-8's “automatic recovery actually attempted” condition and produces false confidence in the task-card count.
- Required: each permitted recovery decision must be tied to a real, bounded re-launch/verification attempt, or record it as an unexecuted recommendation rather than `자동 복구 N회`.

### C3 — Required P10 evidence artifacts are missing, and supplied result log proves failure

- `evidence/P10/` contains only `p10_codex_console.log`, `p10_test_output.log`, and its SHA file. Required `p10_result.json` and `P10_LIVE_RUN.md` are absent.
- The output log's checksum is correct for the file, but it records 1 failed suite and 12 skipped tests, not a pass.
- Required: add the specified JSON/Markdown only after successful, inspectable live evidence exists; include per-item FAIL/PARTIAL/SKIPPED reasons when it does not.

## HIGH

### H1 — Stop semantics kill the wrapper PID, not the ledgered real worker PID

- `app/core.mjs:28-34` reads the AppContainer PID from `launched.session.pid` but on Windows invokes `taskkill /PID launched.child.pid /T /F`. These are distinct processes: `child.pid` is PowerShell launcher, while `session.pid` is the actual AppContainer Codex process (`daemon/src/codex-session.ts:8-17`). It may work incidentally through the process tree, but it does not prove or target the recorded process.
- The P10-4 test (`daemon/test/p10.test.ts:35`) waits only for a non-undefined ledger PID; it never proves that PID is alive before stop. It also cannot run because `beforeAll` fails.
- Required: prove live recorded PID before cancellation, terminate that owned process/tree deterministically, then prove the same recorded PID no longer exists and ledger state is blocked/cancelled.

### H2 — P10-5/P10-6 are not actual Codex/AppContainer executions

- `daemon/test/p10.test.ts:36-37` directly calls `runWorkerLifecycle` with `powershell.exe`. It neither calls `createCueCore.execute()` nor exercises `spawnVendorCodexInAppContainer`/the Codex process. This is a re-test of prior enforcement plumbing, not the requested real engine path.
- Required: add live app-path cases that induce the forbidden behavior inside the actual AppContainer worker, verify no outside file/egress effect, and verify ledger violation rows.

### H3 — Envelope write permission is not enforced by the Codex launch

- `app/core.mjs:47` derives `allowed_actions` as `write:<artifact>`, but `app/core.mjs:55-57` launches Codex with broad `--sandbox workspace-write`. The derived filename is present only in prose prompt; the AppContainer ACL grants Modify to the complete cwd (`daemon/src/appcontainer-launch.ps1:70-73`). A noncompliant Codex can write any worktree file.
- Required: connect the allowed action to a real enforcement boundary or accurately mark the requirement unsatisfied. Prompt text is not a security gate.

### H4 — Existing regression success is not established for this change

- The console contains an earlier full-suite line, `174 passed | 5 skipped`, but the current P10 run fails and no complete current post-change regression log/hash is supplied. P10-12 merely asserts that old evidence files contain the string `PARTIAL` (`daemon/test/p10.test.ts:41`), which is unrelated to preserving 174/5.
- Required: run and retain the actual full suite after final code, with its output/hash; do not substitute historical console text.

## MEDIUM

### M1 — Test suite is over-coupled and masks all P10 coverage

- A single `beforeAll` performs both real goal runs (`daemon/test/p10.test.ts:28`); when one fails, every individual assertion is skipped. The cleanup then raises `EBUSY` because the core/ledger was not closed after the failed first `live()` (`lines 21, 29`). This makes the listed per-item test outcomes misleading as coverage evidence.

### M2 — Several tests are static/tautological rather than behavioral

- P10-1 scans source for the removed literal and P10-2 scans for `writeFileSync` (`daemon/test/p10.test.ts:31-32`), P10-11 looks only for three notification spellings (`line 40`), P10-12 looks only for `PARTIAL` text (`line 41`). Under the remove-ai-slops/programming criteria these are implementation-mirroring tests and do not establish the stated product behavior. They are MEDIUM because they are not the sole security gate, but must not be used as PASS evidence.

### M3 — `CODEX_HOME` is configurable to the user’s real home, contradicting isolated credential handling

- `app/core.mjs:43-44` defaults to `USERPROFILE/.codex` or arbitrary `CODEX_HOME`; it does not call `createCleanCodexHome`. The AppContainer launcher then grants it Modify access (`daemon/src/codex-session.ts:8`, `appcontainer-launch.ps1:75-80`). This expands the worker envelope to real credentials/config, contrary to P10-10's “credentials not injected.” The unit test tests a constructed env map only, not the actual app launch.

## LOW

### L1 — Production code was compressed into long single-line functions

- `app/core.mjs:17-64` has material lifecycle/security operations written as dense one-liners. This makes error paths (failed spawn, ledger closure, recovery) hard to review and maintain; it contributed to missing cleanup/verification coverage.

## P10 assessment

P10-1: PARTIAL — legacy literal absent and goal changes action string, but enforcement remains prompt-only.  
P10-2: PARTIAL — launch path and wrapper/ledger PID exist, yet real Codex fails before work.  
P10-3: FAIL — no two successful distinct outputs.  
P10-4: FAIL — no live proof; stop targets wrapper, and test does not assert pre-stop liveness.  
P10-5: PARTIAL — prior lifecycle test blocks a PowerShell junction escape, not actual Codex/AppContainer app path.  
P10-6: PARTIAL — prior lifecycle detection test, not actual Codex app path; detection-only grade must remain.  
P10-7: FAIL — `running` assertion is not reached in a passing live run.  
P10-8: FAIL — records recovery decisions but does not retry the worker.  
P10-9: PARTIAL — approval/DB immutability assertions exist, but no successful execution lifecycle is demonstrated.  
P10-10: FAIL — app defaults to and grants real CODEX_HOME; no live worker environment/log/ledger proof.  
P10-11: PARTIAL — static scan only, no live notification observation.  
P10-12: FAIL — current P10 run failed; no post-change full regression artifact.

Blockers: C1, C2, C3, H1, H2, H3, H4.
