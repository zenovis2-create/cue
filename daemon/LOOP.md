# Loop: Cue v0.1 Phase 10-C release gate

Status: verified local v0.1
Owner: Codex
Last reviewed: 2026-09-05

## Purpose

Verify Cue as a standalone Electron app whose host process performs model communication only and whose workspace commands/files run in capability-zero Windows AppContainer workers.

## Completion contract

Cue v0.1 is complete only when all of the following are true:

- `npm start` builds the daemon and opens a real Electron window.
- First-run workspace selection persists without storing credentials.
- A natural-language goal produces a three-line summary, immutable execution envelope, and explicit approval gate.
- A real Codex model completes two different approved goals with different action sets, worker PIDs, artifacts, contents, and hashes.
- The host controller exposes only `cue_workspace`; caller-controlled `cwd` and host shell/file requests are rejected.
- Every workspace tool call runs in a capability-zero AppContainer pinned to the approved worktree.
- Worktree-external and junction writes fail; a real socket attempt from the tool worker fails.
- Stop kills the actual host controller and live AppContainer worker.
- Recoverable worker failure creates bounded replacement controller/worker pairs; controller crash never auto-resumes.
- Restart reconciliation converts an interrupted write to `blocked/crash` and requires a human.
- UI progress, PID counts, approvals, recovery count, and terminal result come from SQLite rows.
- The full test suite has zero failures.

## Architecture

| Plane | Location | Authority |
|---|---|---|
| Electron renderer | Chromium sandbox | `prepare`, `approve`, `execute`, `status`, `stop` IPC allowlist only |
| Cue controller | Host | Codex app-server/model traffic and session control; isolated controller cwd |
| Workspace tool | AppContainer | Actual commands and file access in server-pinned approved worktree |
| Ledger | Host | Immutable envelope, approval, execution, PID, recovery, verification, and terminal state |

The prior Phase 10-B/D/E design that placed the entire Codex process in capability-zero AppContainer remains an honest failed experiment and is not the production architecture. It is superseded by Phase 10-C because model networking and workspace execution require different trust boundaries.

## Safety invariants

1. Approval is required before execution IPC can launch anything.
2. Approval does not mutate or widen the envelope.
3. Autonomy changes retry behavior only; it cannot expand permissions.
4. Dynamic-tool `cwd` is ignored/rejected and replaced with the approved canonical worktree.
5. Controller credential/config homes are per-run copies; source authentication remains unchanged.
6. Tool workers receive no credential/profile variables and have zero AppContainer capabilities.
7. Any controller transport/protocol crash becomes `blocked/crash` with zero automatic recovery.
8. Any app restart reconciles in-progress writes to `blocked/crash`; it never silently resumes.
9. P3-16 remains a detection-and-stop layer. Only the capability-zero worker socket test supports an OS-denial claim.
10. Failed or timed-out work is never reported as completed.

## Commands

```bash
npm test
npm run live:p10c
npm start
```

`npm run live:p10c` uses the real model and may incur model cost.

## Current verified evidence

| Gate | Result | Evidence |
|---|---|---|
| Full regression | PASS — 205 passed, 5 skipped, 0 failed | latest `npm test` output |
| Real model A/B | PASS | `evidence/P10C/p10c_live_result.json` |
| Different actions/artifacts/PIDs | PASS | all seven `invariants` are true in the live result |
| Electron end-to-end | PASS | `p10c_electron_run.json`, `p10c_electron_window.png` |
| `npm start` window | PASS | `p10c_npm_start_result.json` |
| AppContainer filesystem boundary | PASS | `test/p10c-worker.test.ts` |
| AppContainer socket denial | PASS | `test/p10c-worker.test.ts` |
| Stop and bounded replacement | PASS | `test/p10c-core.test.ts` |
| Crash/no-auto-resume | PASS | `test/p10c-core.test.ts` |
| Source authentication unchanged | PASS | live result invariant (content is never serialized) |

## Observe–decide rules

- A unit pass cannot replace a required live model, Electron, PID, or OS-boundary observation.
- A successful process exit cannot replace reading the requested artifact and checking its contents.
- Any nonzero test result, missing artifact, stale evidence, surviving attributed process, leaked credential, or outside write reopens the gate.
- Retry only after a changed diagnosis; never grant broad filesystem or network authority to make a probe pass.
- Do not revive whole-Codex AppContainer experiments as the production path without a new explicit architecture decision.

## Run ledger

| Revision | Observation | Decision |
|---:|---|---|
| 0 | Phase 9 opened Electron but used a hard-coded canary | Not complete |
| 1 | Whole Codex AppContainer reached a real PID but `CODEX_HOME` canonicalization/networking blocked useful work | Preserve failure; split trust planes |
| 2 | Host app-server plus `cue_workspace` AppContainer worker passed deterministic integration/security gates | Run real goals |
| 3 | Real goal A/B completed with distinct outputs/actions/PIDs; Electron flow completed | Run full regression and crash checks |
| 4 | Controller crash and restart reconciliation now block without auto-resume; full suite 205/5/0 | Local Cue v0.1 gate PASS |
