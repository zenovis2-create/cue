# Loop: Cue P1-2 permissions enforcement probe

Status: complete
Owner: Codex `/root`
Last reviewed: 2026-09-02

## Purpose

Execute the P1-1a and P1-2 app-server probes in disposable `%TEMP%` worktrees and preserve raw JSON-RPC evidence before making a fail-closed verdict.

## Goal

Done means `p1_1a_ledger.log`, `P1_1A_VERDICT.md`, `p1_2_ledger.log`, `p1_2_result.json`, and `P1_2_VERDICT.md` are current and the four required P1-2 scenarios report observed files/errors. False-done: valid schemas, model narration, turn completion, or an approval event without execution/side-effect evidence.

## Trigger

- Type: manual hard-gate probe requested by the user.
- Input schema: vendor Codex binary, authenticated source `CODEX_HOME`, disposable worktree path, scenario decision/profile.
- Preconditions: work only under `C:\Users\User\cue`; copy only `auth.json` to a clean temporary `CODEX_HOME`; temporary worktrees/outside markers live under `%TEMP%` and are removed.

## State

- Durable state: probe source and evidence files under `C:\Users\User\cue`.
- Transient state: app-server processes and `%TEMP%\cue-p1-*` directories.
- Idempotency key: probe name plus scenario name; rerun replaces that probe's evidence.
- Completion marker: final verdict line backed by current result JSON and raw ledger.
- Replay inputs: probe script, vendor binary, source `auth.json`, and network target.

## Tools

| Tool | Purpose | Success signal | Failure signal | Timeout | Retryable? |
|---|---|---|---|---:|---|
| `codex.exe app-server` | Execute JSON-RPC turns | raw completion plus measured side effect/error | timeout, protocol error, missing measurement | 360 s/scenario | Once after diagnosed transient failure |
| Python probe | Isolate, measure, emit artifacts | all requested files written and temp dirs removed | exception or missing artifact | 30 min total | At most 2 revisions per unchanged blocker |
| unittest | Check deterministic builders/verdict rules | exit 0 | nonzero | 60 s | after a code correction |

## Safety Gates

| Gate | Blocks when | Recovery |
|---|---|---|
| Schema | request/response evidence is absent | mark UNPROVEN and repair probe |
| Scope | persistent writes target outside repository | stop; only disposable `%TEMP%` targets are permitted |
| Permission | action exceeds the requested test | do not perform it |
| Budget | same blocker fails twice or scenario times out | preserve evidence and report PARTIAL |
| Risk | temp target identity or cleanup is ambiguous | quarantine path and stop destructive cleanup |

## Observe-Decide Rules

- Done when all five artifacts exist, every JSON-RPC line is in a ledger, all four P1-2 scenarios have measurements, and the final verdict follows fail-closed rules.
- Retry when a diagnosed transient process/protocol failure changes the attempted input and budget remains.
- Replan when an API assumption is false or the same check fails twice.
- Escalate when credentials, interactive UAC, or broader filesystem authority is required.
- Quarantine when a side effect cannot be attributed to its scenario or a temporary target cannot be resolved safely.

## Telemetry

- Required logs: scenario, request/response raw lines, elapsed time, event methods, decisions, completion state, measurements, and errors.
- Required artifacts: both ledgers, structured result JSON, both verdict Markdown files.
- Required operator report: PASS/FAIL/UNPROVEN per scenario, final PASS/FAIL/PARTIAL, cleanup status, and next design rule.
- Required metrics: scenario counts, approval counts/types, hook count, MCP configured/error count, timeouts, and passed/failed/unproven counts.
- Trace fields: `probe`, `run_id`, `scenario`, `status`, `evidence`.

## Budgets and Stop Conditions

- Maximum automatic revisions for one unchanged blocker: 2.
- Maximum app-server turns: P1-1a plus four P1-2 scenarios, with one diagnosed retry per failed setup.
- A timeout or execution-helper failure is UNPROVEN, never PASS.
- Stop if temp-path containment cannot be verified before cleanup.
- Do not repeat a non-idempotent outside-write attempt except in its newly created disposable scenario directory.

## Verification

- Unit checks: deterministic request/response and verdict classification tests.
- Integration checks: vendor app-server against a clean temporary `CODEX_HOME`.
- Dry run: syntax compile and fixture builders.
- Live canary: the five isolated app-server turns and direct `os.path.exists`/captured error measurements.
- Scorecard: `python C:\Users\User\.agents\skills\loop-engineering\scripts\score_loop_contract.py LOOP.md --require 100`.

## Run Ledger

| Revision | Observation | Change | Checks and evidence | Passed gates | Decision |
|---:|---|---|---|---:|---|
| 0 | Prior P1-1 was polluted; prior P1-2 combined controls and did not execute payload | establish isolated scenario contract | existing P1 evidence inspected | 0 | implement smallest replayable probe |
| 1 | Generic sandbox approval was disabled and masked all profile outcomes | enable command approval; use schema-valid empty `permissions` | first live ledger retained only as superseded diagnostic | 2 | rerun once with separated controls |
| 2 | outside-accept wrote the file; network-denied returned HTTP 200; empty permissions allowed write | classify observed escapes as FAIL and render exact command evidence | 9 unit tests PASS; ledgers contain 38 IN / 549 OUT lines; no probe temp dirs remain | 5 | final P1-2 FAIL |
