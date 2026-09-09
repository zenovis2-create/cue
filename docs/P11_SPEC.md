# Phase 11 — Security Remediation Round (Cue v0.1 blocker closure)

## Context
An independent security review returned `passed:false` with 5 high blockers.
Two were partially remediated on 2026-09-06 (post-terminal late RPC rejection,
same-worktree second-writer serialization), then work stalled for 21 hours with
no disk changes. Stale workers were killed. This spec resumes the round.

HEAD is `f28e9e7`. Working tree is dirty (79 entries) and MUST be committed as a
single revision-bound commit at the end of this round — not before.

## Hard constraints (violating any of these fails the round)
- **Do not weaken any existing security assertion to make a test pass.** Raise a
  timeout only when the assertion itself still holds; never relabel
  "detection" as "enforcement" (design §5.2.1).
- **Do not print, echo, log, or paste credential values anywhere** — not in
  evidence, not in commit messages, not in test fixtures. Service names only.
- **Do not register anything with the OS** (scheduled tasks, services, autostart).
- Renderer sealing is inviolable: `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true`, preload exposes exactly the existing 4 functions.
- The envelope is immutable during a run. No `acceptForSession`,
  no `scope:"session"` permissions, no yolo/bypass approval paths, no empty
  permissions response.
- **A timeout is a FAIL, not an inconclusive.** Report it as FAIL.
- **Write every result to disk before claiming it.** If a file is not on disk,
  the claim does not exist.

## R-0 — Baseline re-measurement (do this first)
The previously reported `239 passed / 5 skipped / 0 failed` is **stale** because
source changed after it was produced. Re-run and record the real current numbers.

- `npm.cmd test` from the repo root (canonical, serial).
- Write raw stdout+stderr to `evidence/P11/p11_baseline_regression.log`.
- Write `evidence/P11/p11_baseline.json` with the parsed counts
  (`filesPassed`, `testsPassed`, `testsSkipped`, `testsFailed`, `exitCode`).
- If there are failures, list each failing test's full name. Do not fix them
  silently — record them, then fix them under the blocker they belong to.

## R-1 — Writer lifecycle completion (blocker: same-worktree concurrent writers)
Partially done. Complete it.

- A worktree write lease must be released on **every** exit path:
  normal completion, user stop, controller crash, worker hard-kill,
  daemon crash, and parent death.
- After a daemon crash, writes MUST NOT auto-resume — the run lands in
  `blocked/crash` (existing rule, do not soften).
- A second writer must either serialize behind the lease or be refused; it must
  never write concurrently into the same worktree.
- Add tests covering **each** exit path above, RED first, then GREEN.
- Evidence: `evidence/P11/p11_writer_lifecycle.json` naming each exit path and
  its test, plus the log.

## R-2 — Absolute-path executable sealing (blocker: worktree-local hijack)
A worker must not be able to gain execution by planting an executable inside a
path it can write.

- Every launched executable must be resolved to an absolute path that lies
  **outside** any worktree the worker can write to, and verified before launch.
- Reject launch when the resolved binary sits inside a writable worktree.
- Do not rely on argv preflight as a filesystem boundary — the existing p3b
  comment already states argv preflight is not a syscall boundary. Enforce at
  launch resolution.
- Add a RED test that plants an executable in the worktree and attempts to have
  it launched; it must be refused with a recorded violation.
- Evidence: `evidence/P11/p11_exec_sealing.json` + log.

## R-3 — Electron upgrade (blocker: 2 high runtime vulns)
- Upgrade Electron to a version with both high advisories resolved. Record the
  old version, the new version, and the advisory IDs.
- After upgrading, re-verify the P9-2 sealing **by reading the live values**, not
  by reading source: `contextIsolation`, `nodeIntegration`, `sandbox`, the
  preload surface (exactly 4 functions), CSP `default-src 'none'`, navigation
  blocked, new-window refused.
- Re-run the live app: `npm start` with a valid workspace must open a real Cue
  window and exit 0. Capture a PNG.
- Also re-verify first-run cancel remains fail-closed (exit 1, no fallback
  folder, no settings written).
- Evidence: `evidence/P11/p11_electron.json`, `p11_electron_window.png`, log.

## R-4 — Credential hygiene (blocker: credential blob in past commits)
The user has already rotated the OpenAI ChatGPT/Codex OAuth credential
(`~/.codex/auth.json` reissued 2026-09-06 19:33). The old value is now void.

- Identify every path in git history that carried credential material.
  Report **paths and commit hashes only — never values**.
- Purge those blobs from history, then verify: the blob is unreachable, and
  `git fsck` / a fresh clone check shows no residue.
- Add a guard that fails the test suite if a credential-shaped file is ever
  staged again (path-based rule, no value matching in the repo).
- Confirm the working `.gitignore` covers the credential home.
- Evidence: `evidence/P11/p11_credential_hygiene.json` (paths + hashes + purge
  verification, **no values**) + log.

## R-5 — Full re-verification on the remediated source
Everything below must be produced **after** R-1..R-4 land, on the same source.

- Canonical regression `npm.cmd test` → `evidence/P11/p11_full_regression.log`.
- Live A/B: two different goals through the real Codex engine, distinct
  artifacts and hashes, distinct controller/worker PIDs, source credential home
  unchanged, 0 enforcement violations → `evidence/P11/p11_live_result.json`.
- Effective tool manifest: `toolNames` must be exactly `["cue_workspace"]` and
  `hostExecutionTools` empty → `evidence/P11/p11_manifest_proof.json`.
- Stop canary: real controller and AppContainer worker alive before stop, both
  dead after, ledger `blocked/cancelled`, lease released →
  `evidence/P11/p11_stop_result.json`.
- Source tree manifest over the final source →
  `evidence/P11/source_tree_manifest.json` with a single `sourceTreeSha256`.

## R-6 — Independent reviews
- Run a **fresh** independent security review and a fresh release-readiness
  review against the final source. If a review fails to authenticate, it is
  **invalid, not passed** — say so and re-run it.
- Write each review's verdict to `evidence/P11/p11_review_security.json` and
  `p11_review_release.json` including `passed` and every finding.

## R-7 — Single revision-bound commit
Only after R-0..R-6.

- `git add -A` then commit with `-c user.name="Cue" -c user.email="cue@local"`.
- The commit message must state the **observed** numbers, not aspirational ones,
  and must name any remaining limitation. Do not write `0 failed` unless the
  final log shows it.
- The v0.1 limitations stay recorded as limitations, not upgraded to PASS:
  P3-16 network is detection-only; P4-2 `Win32_Process` does not supply cwd;
  P6-3 real Buzz delivery unverified; goal verification is oriented toward
  file-changing goals.
- After committing, verify `git status --porcelain` is empty and report HEAD.

## R-8 — Verdict
Write `evidence/P11/v01_verdict.json`:
- `verdict` is `GO` only if R-0..R-7 all hold **and** both R-6 reviews report
  `passed:true`. Otherwise `NO-GO` with the blocking reason.
- Include the final counts, the `sourceTreeSha256`, the commit hash, and the
  four limitations verbatim.

## Reporting rule
Before stating that any artifact exists, confirm it is on disk. A claim without
a file behind it is a defect in this round, not a detail.
