# A08 Independent Suite-Green Audit — REVIEW

Reviewer role: independent, adversarial. I did not author the changes under review.
Scope: A08 requirement (c) for the part covered by (a) — current-source stage suites and release
gate exit 0. I am NOT judging (b) required actual receipts.

Environment: Windows, PowerShell, Node v24.18.0, npm 12.0.1, vitest v4.1.11.
Repo: C:\Users\User\cue, branch `v0.2`. daemon at C:\Users\User\cue\daemon.

---

## STEP 1 — Independent reproduction of the green claim

Command run (my own, background, output to `C:\Users\User\cue\audit-npm-test.log`):

```
cd C:\Users\User\cue\daemon
npm run build
npx vitest run --reporter=verbose --fileParallelism=false --maxWorkers=1
```

Author's own `confirm-npm-test.log` (independently re-parsed by me):

- Test Files: `269 passed (269)`
- Tests: `1772 passed | 9 skipped (1781)`
- Duration: 2403.52s
- `confirm-npm-test.done`: `exit=0`

MY MEASURED RESULT (independent run, `audit-npm-test.log`, `audit-npm-test.done`):
- Test Files: **269 passed (269)**
- Tests: **1772 passed | 9 skipped (1781)**
- Exit code: **0** (`audit-npm-test.done` → `exit=0`)
- Duration: 2378.72s; Start 20:44:03
- No `Failed Tests` banner, no `N failed`, no `FAIL test/` anywhere in the log.
- My run's 9 skips are byte-identical to the baseline/confirm set (listed in STEP 3).
- CONCLUSION: the green claim is INDEPENDENTLY REPRODUCED, exactly matching confirm-npm-test.log.

Skip cross-check (STEP 3): the 9 skipped tests are byte-identical between
`baseline-npm-test.log` and `confirm-npm-test.log` (same 9 titles, listed in STEP 3).
They are all pre-existing conditional / live-only skips; none is newly introduced.

Total-test-count invariant: baseline 1757 pass + 15 fail + 9 skip = **1781**;
confirm 1772 pass + 0 fail + 9 skip = **1781**. Identical total ⇒ the 15 previously-failing
tests turned green and NO test was deleted, emptied, or newly skipped.

---

## STEP 2 — Per-change verdicts

| # | File | Verdict | Basis |
|---|------|---------|-------|
| A | daemon/test/p5.test.ts P5-6 (discard split) | JUSTIFIED | Verified below incl. live mutation test |
| B | daemon/test/p5.test.ts P5-10 (regex narrow) | JUSTIFIED | Property/index forms still caught; loss is bare-local reassignment only, covered by dynamic assertion |
| C | daemon/test/p13-lifecycle-barrier.test.ts P13-L3 | JUSTIFIED (stricter) | Now additionally pins ownership guard; source confirmed |
| D | daemon/test/p10c-containment.test.ts (5s→15s) | JUSTIFIED | 5s < subject's own ≥4s controller budget + worker completion; 15s still forbids hang; orphanAlive===false unchanged |
| E | daemon/vitest.config.ts (testTimeout 30s default) | JUSTIFIED (with noted trade-off) | Only raises the default for files that declare none; does not override per-test declarations |
| F | daemon/src/process-termination.ts | JUSTIFIED for the audited concern; NOTE: not "comment-only" | Deadline still `Date.now() + 2_000`; the 2s→15s attempt is reverted. But the file DOES carry a functional addition (creation-identity guard) — a strengthening, unrelated to greening |
| G | scripts/p11-electron-proof.mjs | JUSTIFIED | Port probe throws if none free; CDP 10s→30s is a harness budget under the 180s deadline; p12-live-harness static assertions unaffected; p12-electron-proof-result NOT skipped |
| H | 8 remaining timeout/budget bumps | JUSTIFIED (all HARNESS) | Enumerated below; none is a semantic assertion |
| — | daemon/test/p10c-manifest.test.ts (SHA pin) | JUSTIFIED for (a); flag for (b) | Test updated to match source pin; not a weakened assertion. New SHA's vendor-binary provenance is unverifiable in this env |
| — | daemon/scripts/p10c-manifest-proof.mjs (SHA pin) | JUSTIFIED for (a); flag for (b) | Coordinated pin update; comment-documented provenance |
| — | app/core.mjs | JUSTIFIED for (a); out-of-scope feature work | PINNED_CODEX_SHA256 pin update (same as above) + large v0.2 orchestration/evaluation feature surface. No test/gate weakening |
| — | daemon/test/integration-targeted-termination.test.ts (untracked) | JUSTIFIED | New real targeted-termination containment test; 120s is per-test HARNESS; assertions semantic |
| — | daemon/test/integration-native-recovery-host.test.ts (untracked) | JUSTIFIED | `vi.setConfig({testTimeout:120000})` is a HARNESS budget; assertions semantic |
| — | README.md | JUSTIFIED | Documentation only; no test/gate impact |

### A. P5-6 `discard` split — JUSTIFIED

Verified (1): zero `git\s+(?:reset|checkout|clean)|checkout\s+--` matches in daemon/src today
(grep over daemon/src/**/*.ts → 0 files, 0 matches).

Verified (2): `discard` appears in daemon/src in EXACTLY three files — `ledger.ts` (13),
`orchestration/staging-authority.ts` (12), `orchestration/store.ts` (8) — and the allowlist regex
`/[\\/](?:ledger|orchestration[\\/](?:staging-authority|store))\.ts$/u` exempts exactly those three
and SCANS all others (confirmed: watcher.ts, recovery.ts, orchestration/driver.ts all SCANNED).

Verified (3) — live mutation-sensitivity test:
- Recorded pre-mutation SHA-256 of daemon/src/watcher.ts = `7A5AF4FD6FD8503EC684EF8C615C18FC10D712F9E23B14073AA5C20A6E0565B1`.
- Injected `// AUDIT-MUTATION-TEMP discard` into watcher.ts (an unrelated, non-allowlisted module).
- Ran `npx vitest run test/p5.test.ts` → **P5-6 FAILED** (`× P5-6 fences and hashes state ...`);
  summary `Test Files 1 failed (1) / Tests 1 failed | 16 passed (17)`.
- Reverted watcher.ts exactly. `git diff -- daemon/src/watcher.ts` is EMPTY and post-revert
  SHA-256 = `7A5AF4FD...0565B1` (identical to pre-mutation). Clean restore proven.

Conclusion: the split preserves the git-destructive scan across all of daemon/src and keeps the
`discard` guard genuinely sensitive for every non-allowlisted module. Not a weakening.

### B. P5-10 regex narrowing — JUSTIFIED

Old: `/(?:goal|constraints|done_when|deliverable)\s*=/u`
New: `/(?:\.|\[\s*['"])(?:goal|constraints|done_when|deliverable)(?:['"]\s*\])?\s*=(?!=)/u`

Verified by executing the exact regex against target strings (isolated node script):
- `contract.goal = x` → MATCH
- `c['done_when'] = 2` → MATCH
- `e.constraints=[]` → MATCH
- `x.deliverable = y` → MATCH
- `contract.goal == y` (equality) → correctly NOT matched (`(?!=)` guard)
- `const goal=record()` (read) → correctly NOT matched

WHAT THE NARROWING NO LONGER CATCHES: bare local reassignment such as `goal = 'expanded'`
(a standalone identifier assignment with no property/index prefix). This loss is acceptable:
`contract` is a `TaskContract` mutated only through property/index access in real code, and the SAME
P5-10 test carries dynamic assertions — `recovery.recover({...contract,goal:'expanded'}...).action`
must be `'human'`, and `JSON.stringify(contract)` must equal the frozen `before` — which are the
authoritative runtime guards against contract widening. The source scan is defense-in-depth; its
narrowing removes false positives on read-only locals without removing the real protection.

### C. P13-L3 — JUSTIFIED (strictly stronger)

New regex additionally requires the ownership guard:
`cleanup: () => { if (options.codexHomeOwnership !== 'retained-authorized') safeCleanupCodexHome`.
Still asserts stop() body does NOT contain `safeCleanupCodexHome` (unchanged line 72).
Source confirmed at daemon/src/host-codex-runtime.ts line 490:
`cleanup: () => { if(options.codexHomeOwnership!=='retained-authorized')safeCleanupCodexHome(options.codexHome); }`
Cleanup is still routed only on the teardown path (inside `settleHostRuntimeTeardown({...})`, lines 480–490).

### D. p10c-containment latency 5_000 → 15_000 — JUSTIFIED (most safety-relevant, examined closely)

`settleHostRuntimeTeardown` → `closeController` (host-codex-runtime.ts lines 483–489) permits
`waitForClose(child, 2_000)` + `terminateTree` + `waitForClose(child, 2_000)` = up to **4s** for the
controller alone; before it, `settleHostRuntimeTeardown` also does closeRpc, per-worker `stop()`, and
`await Promise.allSettled(workers.completion)` (worker completion may itself carry termination waits).
So 5_000ms left only ~1s of margin over the controller's own 4s budget and NO margin for worker
completion — structurally too tight under a fully-loaded serial suite (matches the author's comment
and the observed false-unverified). 15_000ms preserves margin while still forbidding a genuine hang.
The actual containment property is UNCHANGED: `expect(orphanAlive).toBe(false)` remains at line 118,
and the orphan re-check `deadline = Date.now() + 5_000` polling loop is unchanged. Not a weakening.

### E. vitest.config testTimeout 30_000 — JUSTIFIED (trade-off stated)

Previously no `testTimeout` ⇒ vitest default 5_000. Now `testTimeout: 30_000`.
Trade-off: files/tests that declare their own per-test timeout (e.g. p10c-core `}, 300_000)`,
p10c-runtime `}, 120_000)`, p12-stop-harness `}, 240_000)`, p11-writer-lifecycle `}, 120000)`) keep
that exact contract — the config default does not override an explicit declaration. Files that declare
none now tolerate up to 30s. Risk: a real hang in a no-declaration test would take up to 30s (not 5s)
to surface. This is a longer-wait, not a masked failure: a hang still fails with a timeout; only the
detection latency grows. Given the suite contains many legitimate real-process tests that exceed 5s on
slower hosts, raising the shared default removes false positives. Acceptable.

### F. process-termination.ts — JUSTIFIED for the audited concern; author's "comment-only" claim is INACCURATE

Verified: the `verifyProcessesDead` deadline is STILL `Date.now() + 2_000` (git diff shows only an
added comment block above it; no executable change). The attempted 2s→15s change is reverted. Good.
HOWEVER, the file is NOT comment-only overall: git diff shows a real functional addition —
`windowsCreationIdentity(value)` and a `terminateVerifiedTree(pid, expectedCreatedAt?)` signature that
adds a PID creation-identity guard (`refusing to terminate pid ... creation identity changed`). This is
a STRENGTHENING (refuses to kill a rebound PID), and it belongs to v0.2 branch work rather than the
suite-greening set. It does not weaken any safety assertion; I flag the mischaracterization only.

### G. p11-electron-proof.mjs — JUSTIFIED

- The constant inspector port is replaced by `reservableFrom(base)`, which probes candidates
  `base, base+2, ... base+38` and `throw new Error('no free inspector port near ${base}')` if none is
  bindable. It CANNOT silently fall through to an unusable port.
- Per-evaluate CDP budget 10s→30s is a harness budget explicitly bounded by the overall 180s proof
  deadline. Harness, not semantic.
- Renderer API assertion CHANGED from `['approve','execute','prepare','stop']` to the full v0.2 list
  (`['approve','candidateInventory','evaluation','execute','localJsonSetup','nativeRecovery','prepare',
  'prepareJson','report','resources','retrospective','selectionPreferences','setSelectionPreference',
  'stop']`). This is a STRICTER exact-match assertion tracking the new renderer surface; not weakened.
- p12-live-harness static assertions about this script (`['P11','P12']`, `CUE_EVIDENCE_PHASE`,
  `${prefix}_electron_window_result.json`, `${prefix}_electron_cancel_result.json`,
  `from '../daemon/scripts/process-lifecycle.mjs'`, `childClose`, `stopProcessTree`,
  `Page.captureScreenshot`, NOT `wc.capturePage()`) reference tokens the diff did not touch — all still hold.
- p12-electron-proof-result.test.ts has NO skip/skipIf/only (plain `describe`/`it`); the earlier
  `describe.skipIf` was reverted. Confirmed by grep of the whole test tree.

### H. Remaining timeout/budget increases — all HARNESS (none semantic)

- p10c-core: `terminalCard` deadline 30s→120s (poll bound); per-test 30s→300s and 15s→120s.
  Also a CORRECTNESS fix in the "fences a verified live session" test: `started` now comes from
  `observeProcessTree(pid).createdAt` (via `waitUntil`) instead of `new Date().toISOString()`, so the
  ledger identity matches the OS-observed creation time the fence checks. Assertions unchanged.
- p10c-runtime: six per-test budgets 30s→120s. Assertions (orphans, goalVerification.passed:false,
  failureKind:'cleanup', stderr bound) unchanged.
- p11-writer-lifecycle: `until()` default 15s→60s; per-test 45s→120s. Assertions unchanged.
- p12-stop-harness: spawnSync 60s→180s (above the canary's own 90s waitUntil), per-test 60s→240s.
  Added a diagnostic message to `.toBe(2)` (visibility, not weakening). Receipt assertions
  (verdict:'FAIL', aliveAfterStop===false, sessions>=3) unchanged.
- integration-targeted-termination: per-test 30s→120s HARNESS; internal `eventually` bound fixed 5s.
- integration-native-recovery-host: `vi.setConfig({testTimeout:120000})` HARNESS.

None of these raised values is a semantic assertion (e.g. a latency ceiling that asserts a property).
Item D is the only semantic-adjacent one and is analysed above.

---

## STEP 3 — Hidden coverage loss

`.skip / .skipIf / .todo / .only` grep over daemon/test/**/*.test.ts:
- The overwhelming majority are `describe.skipIf(process.platform !== 'win32')` / `test.skipIf(...)` —
  Windows-only platform guards. On this Windows host they RUN, they do not skip.
- Unconditional / non-platform skips: `p6.test.ts` (Buzz live delivery — documented P6-3),
  `p7.test.ts` (Orca capture — documented), `p45.test.ts` `it.skipIf(process.platform==='win32')`
  (P4-2 OS cwd — documented, skips on Windows). None newly added to dodge a failure.
- NO `.only` anywhere. NO `.todo` masking a failure.

The 9 counted skips (identical in baseline and confirm) are:
1. integration-public-driver-startup-restart — A04 (env-gated `CUE_ACTUAL_PUBLIC_DRIVER_RESTART!=='1'`)
2. p45 P4-2 OS cwd query (Windows skip)
3. p4 P4-1 Orca adapter round-trip (env-gated `CUE_RUN_ORCA_READONLY`)
4. p4 P4-2/P4-4 real vendor Codex launch
5. p6 external Buzz live delivery (documented)
6. integration-provider-installation — signed Claude bytes
7. integration-provider-installation — audited Codex package payload
8. p7 external Orca capture (documented)
9. integration-driver-publication-real-restart — A04 (env-gated `CUE_ACTUAL_PUBLICATION_RESTART!=='1'`)

All are pre-existing live-only / env-gated / documented-platform skips. No new skip to turn red→green.

File/test count invariant (see STEP 1): total 1781 identical in baseline and confirm ⇒ no test file
deleted or emptied.

---

## STEP 4 — Release gate

Command: `npx vitest run test/release.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`
Result (my run): **Test Files 1 passed (1); Tests 14 passed (14); exit 0.**

What release.test.ts (`v0.1 release gates` + `release improvements`) actually asserts:
- R-1..R-9: preserves original P1 evidence + re-run P1-3 record; **R-2 scans ALL src and proves a
  disposable forbidden string makes the scanner fail** (an in-gate mutation-sensitivity check of the
  source scanner — corroborates item A independently); **R-3 uses a real junction to attempt an
  OS-blocked outside write** (containment proof); R-4 kills+restarts a real daemon leaving blocked/crash
  + git-status report; R-5 heartbeat/connection alert logic; R-6 real worker execution + verification +
  Korean reporting; R-7 monetary/token reservation thresholds; R-9 autonomy ③ vs ① equal-envelope,
  different-line behaviour.
- I-1..I-6: category selection, decision-path in reports, recovery-artifact commit ordering, execution
  authority only from accepted approval, preference-by-effect, source-grading design rule.

What "release gate exit 0" DOES mean: the v0.1 release-gate contract assertions pass on current source,
including the source forbidden-string scanner sensitivity and a real OS containment (junction) proof.
What it does NOT mean: it does not exercise live provider model runs, and it does not by itself validate
A08 requirement (b) receipts.

---

## VERDICT

- Green claim: INDEPENDENTLY REPRODUCED. My own full `npm run build` + serial vitest run measured
  269/269 files, 1772 pass, 9 skip, exit 0 (audit-npm-test.log / .done), exactly matching
  confirm-npm-test.log and consistent with the baseline 1781-total invariant.
- Every listed change is JUSTIFIED. The only NOTES (not weakenings): (i) process-termination.ts is not
  literally "comment-only" — it carries a strengthening creation-identity guard; (ii) the PINNED_CODEX
  SHA-256 change (app/core.mjs, p10c-manifest.test.ts, p10c-manifest-proof.mjs) is a pin-value update
  whose vendor-binary/npm/SLSA provenance cannot be verified in this offline audit environment — this is
  a receipt/(b) concern, not a suite-(a) weakening.
- No coverage loss: identical 1781 total tests, identical 9 pre-existing skips, no `.only`, no new skip.
- Release gate: 14/14 pass, exit 0.

### A08 status (explicit)

A08 CANNOT be closed by me. Of its three requirements:
- (a) current-source stage suites + release gate exit 0 — SATISFIED (this audit; subject to my STEP 1
  run confirmation recorded below).
- (b) required actual receipts current — NOT satisfied here; needs approved LIVE provider runs
  (e.g. the env-gated A04 restart tests, real vendor Codex launch, the new Codex SHA-256 provenance)
  that have not been executed. I was explicitly not asked to judge (b), and it is not met.
- (c) independent review resolves open findings — this document; findings are resolved to
  JUSTIFIED with two NOTES above, neither of which blocks (a).

### Open findings
1. (b)-scope: new PINNED_CODEX_SHA256 `be96b992...cbdfde` provenance is asserted only by an in-repo
   comment; unverifiable offline. Must be confirmed against the actual npm/SLSA/Authenticode receipt
   before A08 (b) can be claimed.
2. Documentation: process-termination.ts author summary "comment-only" is inaccurate (functional
   creation-identity guard added). Non-blocking for (a); worth correcting the change note.
