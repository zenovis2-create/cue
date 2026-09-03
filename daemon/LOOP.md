# Loop: Cue v0.1 release gate

Status: implementation-ready
Owner: Codex `/root`
Last reviewed: 2026-09-03

## Purpose

Decide whether Cue v0.1 is releasable using live process evidence for R-3, R-4, R-6, and R-9 while preserving every Phase 1–8 assertion and the three declared PARTIAL findings.

## Goal

Done means `npm test` exits 0 without editing Phase 1–8 tests, `release.test.ts` executes the four live scenarios, its forbidden-string positive control is observed red before cleanup, and the RELEASE JSON, log, SHA-256, and verdict agree. False-done: replacing a live process scenario with a mock/unit-only assertion, or promoting P3-16, P4-2, or P6-3 to PASS.

## Trigger

- Type: manual final release gate requested by the user.
- Input schema: `{ revision, windows_platform, repository_root, release_gate_ids[] }`; reject missing revision or non-local roots.
- Inputs: commit `66809ab`, preserved Phase evidence, Windows AppContainer, disposable local worktrees and SQLite ledgers.
- Preconditions: no external publication, relay delivery, or `@cue` registration; all probe writes remain inside the repository or disposable local directories.

## State

- Durable state: source changes, release test, design rule, and `evidence/RELEASE` artifacts.
- Transient state: child daemon/worker processes, AppContainer profile/ACE, junction, and `.test-state-release-*` directories.
- Idempotency key: release test name plus run ID; every run uses a fresh temporary root.
- Completion marker: current full test log hash referenced by both JSON and Markdown verdict.
- Replay inputs: repository revision, `npm test`, Windows platform, and checked-in release scenarios.

## Tools

| Tool | Purpose | Success signal | Failure signal | Timeout | Retryable? |
|---|---|---|---|---:|---|
| Vitest | regression and release scenarios | 0 exit with current counts | nonzero or skipped required live case | 10 min | after a new hypothesis |
| AppContainer launcher | OS filesystem boundary | junction escape absent and worker denied | outside marker exists or launcher unavailable | 2 min | once after diagnosis |
| Node child process | daemon crash/restart and autonomy contrast | killed PID, restarted PID, durable ledger proof | mock-only result or missing PID | 2 min | once after diagnosis |
| SHA-256 | bind evidence | digest matches log bytes | mismatch | immediate | yes after regenerating artifacts |

## Safety Gates

| Gate | Blocks when | Recovery |
|---|---|---|
| Schema | any R/I result lacks verdict or one-line evidence | fail generation and repair |
| Scope | a probe targets external state or an unverified cleanup path | stop and quarantine |
| Permission | execution lacks an accepted approval record | do not launch |
| Budget | 12 implementation passes or two unchanged failures | record PARTIAL/FAIL and hand off |
| Risk | a required live scenario is skipped or simulated | verdict cannot be release PASS |

## Observe-Decide Rules

- Done when all required artifacts exist, hashes match, live scenario evidence includes PIDs/exit facts/ledger rows, and all Phase tests retain their assertions.
- Retry only with a changed hypothesis after identifying a transient launcher, process, or assertion failure.
- Retry when a diagnosed transient launcher/process failure has a changed input and the attempt budget remains.
- Replan when the same decisive check fails twice or a platform assumption is false.
- Escalate when Windows cannot create an AppContainer/junction or credentials/external coordination would be required.
- Quarantine unattributed processes, ambiguous temp roots, or outside writes; never call them PASS.
- Quarantine when process ownership, cleanup containment, or artifact attribution is ambiguous; stop that scenario and retain its evidence.

## Telemetry

- Required logs: exact test command, test names, live PIDs, process exits, junction target outcome, git status report, run/approval/attempt counts, and verdicts.
- Required artifacts: `release_result.json`, `release_test_output.log`, its `.sha256`, and `V01_VERDICT.md`.
- Required operator report: R-1–R-9 and I-1–I-6 verdicts, remaining PARTIALs, release conclusion, and four yes/no answers.
- Required metrics: total passed/skipped/failed tests, accepted/declined approvals, autonomy attempt counts, and SHA-256.
- Trace fields: `gate`, `run_id`, `pid`, `verdict`, `evidence`.

## Budgets and Stop Conditions

- Maximum implementation revisions: 12; maximum unchanged-check failures: 2.
- Every pass runs the changed release test; the final pass runs `npm test` and hashes its verbatim output.
- No live required scenario may silently skip; environmental inability becomes FAIL/SKIPPED with a reason.
- Stop immediately if a probe changes an external system or an outside marker is actually written.
- Preserve Phase 1–8 tests byte-for-byte and preserve P3-16, P4-2, and P6-3 as PARTIAL.

## Verification

- Unit checks: deterministic I-1–I-5 assertions in `test/release.test.ts`.
- Integration checks: `npx vitest run test/release.test.ts --reporter=verbose`.
- Dry run: TypeScript build plus forbidden-string scanner against the clean source tree and its disposable positive-control file.
- Regression checks: `npm test` with the complete output captured.
- Live canary: AppContainer junction escape, daemon kill/restart reconciliation, approved worker lifecycle, and autonomy ③/① worker contrast.
- Scorecard: `python C:\Users\User\.codex\skills\loop-engineering\scripts\score_loop_contract.py LOOP.md --require 100`.

## Run Ledger

| Revision | Observation | Change | Checks and evidence | Passed gates | Decision |
|---:|---|---|---|---:|---|
| 0 | Phase 1–8 report 151 pass / 5 skip at `66809ab`; release artifacts are absent | establish live release contract | repository, evidence, sources, and existing tests inspected | 1 | implement smallest release surface |
| 1 | R-6 inside write used a path shape that exited 1; I-3 seed cap differed from coordinator | use an inspected absolute inside path and preserve the immutable seeded cap | release test 14/14 PASS | 13 | run full regression |
| 2 | full parallel run exposed ENOENT when P4.5 removed its positive-control file after enumeration | ignore only transient ENOENT during the source scan | full suite 165 PASS / 5 SKIP; four live PID lines; hash `35e9f1a...6332`; independent artifact audit clean | 15 | release FAIL because R-1 lacks original P1-3 evidence |
