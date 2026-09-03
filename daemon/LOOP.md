# Loop: Phase 5 watcher and recovery

Status: implementation-ready
Owner: Codex `/root`
Last reviewed: 2026-09-03

## Purpose

Detect a genuinely idle worker and perform only bounded, ledgered recovery without widening its execution envelope or discarding user work.

## Goal

Done means `npm test` exits 0, all P5-1 through P5-12 assertions pass, the restart preservation test leaves pre-existing work intact, forbidden restart commands and automatic handoff executors are absent, and `evidence/P5` contains the verbatim run plus structured verdicts. False-done: a source grep passes while a real restart deletes or overwrites a worker file.

## Trigger

- Type: recovery after structured watcher observations.
- Input schema: run ID, task type, autonomy level, immutable contract, envelope, signals, retry cap.
- Preconditions: the existing owned worker launch path and immutable envelope already exist.

## State

- Durable state: `run_autonomy`, `recovery_attempt_v2`, and ordinary `artifact` rows.
- Transient state: collected signals and injected restart callback.
- Idempotency key: run ID plus attempt ordinal.
- Completion marker: a human escalation or successful bounded attempt backed by an attempt row.
- Replay inputs: immutable contract, envelope hash, signal observations, prior attempt lineage.

## Tools

| Tool | Purpose | Success signal | Failure signal | Timeout | Retryable? |
|---|---|---|---|---:|---|
| watcher | classify observations | deterministic typed signals | malformed observation | immediate | no |
| recovery coordinator | append bounded attempts | lineage row and result | cap or policy gate | immediate | only with a new hypothesis |
| existing owned launcher callback | restart after fence | callback result after artifacts | missing fence or artifact | caller-owned | within configured cap |

## Safety Gates

| Gate | Blocks when | Recovery |
|---|---|---|
| Schema | handoff or recovery input is incomplete | reject input |
| Scope | requested action is outside the immutable envelope | decline |
| Permission | a decision gate opens | require a human |
| Budget | configured retry cap is reached | append rung 4 and stop |
| Risk | base SHA, diff hash, or fence cannot be recorded | do not restart |

## Observe-Decide Rules

- Done when: all current P5 and regression tests pass and evidence hashes refer to that run.
- Retry when: at least two candidate signals justify diagnosis, the hypothesis is new, and the stored cap remains.
- Replan when: the same decisive check fails twice or a contract assumption is false.
- Escalate when: a decision gate opens, the cap is reached, or autonomy level 1 encounters its first blockage.
- Quarantine when: worker ownership, envelope identity, or preservation artifacts are ambiguous.

## Telemetry

- Required logs: run ID, autonomy, attempt ordinal, rung, hypothesis, outcome, and timestamp.
- Required artifacts: base SHA, diff hash, restart fence, full test log, result JSON, Korean verdict.
- Required user/operator report: PASS/PARTIAL/FAIL/SKIPPED per P5 item and the two explicit safety answers.
- Required metrics: diagnostic calls, attempts, retry cap, passed gates, failed gates.
- Trace fields: `run_id`, `attempt_id`, `parent_attempt_id`, `rung`, `hypothesis`, `outcome`.

## Budgets and Stop Conditions

- Maximum implementation revisions: 12; maximum unchanged-check failures: 2.
- Runtime retry caps are immutable per coordinator and never raised by autonomy.
- No currency conversion is recorded or evaluated.
- A single candidate never invokes diagnosis.
- Level 1 performs zero recovery attempts; level 2 performs only mechanical recovery; level 3 may form new hypotheses, change approach, and re-decompose without changing the contract.
- Any upward autonomy change stops the run and requires a new run; downward changes apply immediately.

## Verification

- Unit checks: `npx vitest run test/p5.test.ts --reporter=verbose`.
- Integration checks: `npm test`.
- Dry run: source scans inside `test/p5.test.ts`.
- Live canary: disposable-worktree preservation test with cleanup in `afterEach`.
- Scorecard: `python C:\Users\User\.codex\skills\loop-engineering\scripts\score_loop_contract.py LOOP.md --require 100`.

## Run Ledger

| Revision | Observation | Change | Checks and evidence | Passed gates | Decision |
|---:|---|---|---|---:|---|
| 0 | Phase 4.5 has one owned launch path and 83 passing tests | define P5 boundary and measurable gates | existing source and tests inspected | 0 | implement watcher and ledger without a new launcher |
| 1 | first full run exposed a parallel source-scan race | make source inspection tolerate the P4.5 ephemeral positive-control file | P5 15/15; full run 98 pass / 3 skip | 11 | checker review |
| 2 | checker found preservation callback did not launch a real worker and integration was absent | use existing `spawnOwned` in the preservation test, integrate observation in Dispatcher, bind contract/gate invariants | P5 16/16; full run 99 pass / 3 skip; checker APPROVE; evidence SHA-256 recorded | 12 | complete |
