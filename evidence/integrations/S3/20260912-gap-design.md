# S3 remaining-gap design (read-only source audit)

Date: 2026-09-12  
Scope: only the unchecked S3 checklist sentences and the S3 completion invariants. Product code, tests, docs, and generated assets were not changed or executed.

## Decision

The next two units should be:

1. **Immutable attempt handoff plus typed activity facts** (`031`): bind every launched attempt to its narrowed envelope, verified artifact hashes, and exact tool/model revisions, and persist heartbeat/output/tool/artifact events through one ordered ingestion contract.
2. **Durable wait and checkpoint protocol** (`032`, after unit 1): persist wait requests, responses, and stream checkpoints through an inbox/cursor/final-seal state machine that accepts exact replay, reconciles reverse arrival, and cannot execute twice or replace a final checkpoint.

These are the smallest dependency-ordered units that establish durable facts needed by later parallel scheduling and UI work. Adding scheduler concurrency first would multiply executions whose handoffs, live activity, and wait state still cannot be reconstructed after restart.

## Current truth and remaining gaps

| Checklist concern | Present evidence | Remaining contract gap |
|---|---|---|
| Read parallelism | `deriveReadyTasks` returns every ready task in deterministic order (`daemon/src/orchestration/plan.ts:157-186`). Read-only roles do not take a lease in `store.claim` (`store.ts:172-179`). | `app/orchestration-driver.mjs:227-279` selects only `readyTaskIds[0]` and awaits it to completion. There is no concurrent scheduler, concurrency cap, or restart reconstruction of in-memory handles. “Reads do not lease” is not evidence that reads run in parallel. |
| Write lease | `workspace_write_lease` is the single durable writer registry (`007_workspace_write_lease.sql`). Claim and lease acquisition share one immediate transaction; unknown cleanup retains the lease (`store.ts:124-184,234-256`). P4 and P11 tests cover queue primitives, stale heartbeat, release paths, protected roots, overlapping roots, and failed Stop quarantine. | Every implementation attempt records the parent run worktree (`store.ts:67,141,175-179`), before the narrowed stage envelope is bound. The schema also makes `run_id` unique, so one run cannot hold leases for two isolated roots. `WorkspaceLeases` is an older in-memory queue and is not the S3 driver scheduler. |
| Separate worktrees and integration verification | Orca argv wrappers and P4 tests can create/list a worktree. The stage binder can narrow a child root already supplied by a trusted host. | S3 creates no worktree, records no base/head/diff identity, owns no cleanup lifecycle, and has no integration task that validates and applies isolated changes. No test proves two writers in separate worktrees followed by one verified integration, or conflict/failure cleanup. |
| Handoff envelope and hashes | `orchestration_stage_envelope` immutably binds parent/stage envelope, plan and policy digests, actual child task/run, scope and request. Reopen, tamper, rollback, and privilege expansion are tested. Generated-output and acceptance stores have separate hash-aware contracts. | There is no attempt handoff record. A downstream task receives no required artifact manifest, and stage completion does not atomically bind envelope hash + output hashes + tool/model provenance. `ExecutionReceipt.evidenceRef` is only an identifier-shaped string; the orchestration store does not resolve or hash it. |
| Tool/model provenance | Attempt selection persists candidate, policy, request, reservation, and decision lineage (`025_attempt_selection.sql`, `selection/attempt-decision-store.ts`). Native identity can persist subject/process identity for one model path. | The UI explicitly returns `toolId: null, modelId: null` because the attempt row only has `candidate_id` (`ui/orchestration.ts:80-95`). Runtime candidates expose kind/capabilities but not canonical tool/model revision. No common attempt record binds the revisions actually launched. |
| Heartbeat/output/tool/artifact activity | `orchestration_activity` is immutable by event ID and `(attempt, ordinal)`. Exact duplicate is idempotent; conflict and ordinal gaps reject (`store.ts:220-232`). Current kinds are heartbeat/progress/tool. UI projects the most recent 20 kind/time records without free-form detail. | No `output` or `artifact` kind exists; `detail` is an untyped string. The heartbeat file is a daemon/process liveness primitive and is not fed into the S3 activity table. Local-model streaming has text/usage events but relies on an injected callback; the S3 driver does not supply a durable sink. Codex execution exposes aggregate tool count/final message and artifact rows, but no common live event bridge. Artifact activity has no hash/reference schema. |
| Durable wait/event/response/checkpoint | Activity and receipt rows survive SQLite reopen and enforce exact identity/order. Receipts reject non-increasing revisions. | There is no request queue, wait request, response, stream checkpoint, contiguous cursor, or terminal seal. Current activity rejects reverse arrival rather than durably holding and reconciling it. A blocked attempt may accept a later cleanup receipt, which is correct for cleanup but is not a final-output checkpoint rule. |
| UI selection/progress/block/cost/Stop | Approval shows policy, DAG, scope/candidates, requirements, retry and cost/count uncertainty. Observation shows historical selection reason, stage/attempt state, block state, cleanup, recent activity, acceptance and conservative cost. Existing DOM/core/Electron evidence is scoped and explicit. | Tool/model fields remain unknown; activity omits output/artifact; no durable wait state or checkpoint progress exists. Stop returns synchronously after marking `cancelled` and starts async cancel/reconcile (`orchestration-driver.mjs:384-401`). Renderer immediately polls once (`renderer.js:808-829`); it has no distinct `stop requested / OS termination observed / cleanup verified / cleanup unknown` state machine. |
| S3 completion: duplicate execution 0 | Attempt identity replay is exact, runtime rejects duplicate run IDs in-process, driver reuses one Promise, and atomic competing claims produce one winner. | The driver does not reconstruct prepared/owned state after restart. Durable wait responses/events do not exist, so reconnect replay cannot yet prove zero duplicate execution. |
| S3 completion: late checkpoint final overwrite 0 | Immutable activity and receipt rows prevent `UPDATE`, `REPLACE`, and older receipt revisions. | There is no final checkpoint object or seal. Receipt ordering alone cannot prove that late streamed content never replaces final output. |

## Unit 1 — immutable handoff and typed activity facts (`031`)

### Exact ownership

The implementer owns only these files for this unit:

- `daemon/migrations/031_orchestration_handoff_activity.sql` (new)
- `daemon/src/ledger.ts`
- `daemon/scripts/copy-assets.mjs`
- `daemon/src/orchestration/handoff-activity.ts` (new; validation, canonicalization, record/read APIs)
- `daemon/src/orchestration/store.ts` (require verified parent handoffs in readiness/claim and commit receipt + handoff together)
- `daemon/src/orchestration/engine.ts` (record launch identity and terminal handoff in the existing preparation/lifecycle boundaries)
- `daemon/src/integration-runtime.ts` (durable prelaunch identity intent and exact current-subject match before side effects)
- `daemon/src/adapters/integration-executors.ts` (emit bounded typed output/tool/artifact/heartbeat facts available from each adapter; never invent unsupported facts)
- `daemon/src/host-codex-controller.ts` (bounded event observer at the point output/tool events are parsed)
- `daemon/src/host-codex-runtime.ts` (bind controller events and generic artifact rows to the attempt activity sink)
- `app/orchestration-driver.mjs`
- `app/orchestration-driver.d.mts`
- `daemon/src/ui/orchestration.ts` (read-only projection of the new facts)
- `daemon/test/integration-handoff-activity.test.ts` (new)
- `daemon/test/integration-orchestration.test.ts`
- `daemon/test/integration-engine.test.ts`
- `daemon/test/integration-runtime-contract.test.ts`
- `daemon/test/integration-executors.test.ts`
- `daemon/test/host-codex-controller.test.ts`
- `daemon/test/p3c.test.ts`
- `daemon/test/integration-driver.test.ts`
- `daemon/test/integration-observation.test.ts`

Do not fold worktree scheduling, wait responses, renderer redesign, or acceptance changes into this unit.

### Migration and record contract

`030_evaluation_comparison.sql` is already present and wired in the dirty shared tree, so the next migration must be **031 or greater**. Before implementation, re-list `daemon/migrations` because another concurrent unit may claim 031; renumber upward rather than editing another unit's migration. Wire the chosen file in both `ledger.ts` and `copy-assets.mjs`; build must prove the deployed migration copy exists.

Create append-only records with database guards against update/delete/replace:

- `orchestration_launch_intent`: one immutable prelaunch row written inside the existing claim/preparation transaction, containing workflow run/task/attempt, candidate, selection digest, expected subject digest, canonical tool ID + revision, optional canonical model ID + revision, parent/stage envelope hashes, plan/policy digests, and canonical payload SHA-256. The host must resolve these from the registered candidate before any adapter side effect; model- or renderer-submitted labels are not authority. Missing revision remains explicit `unknown` and cannot be upgraded by inference.
- `orchestration_attempt_identity`: an append-only observed identity linked to the launch intent and, where available, the existing durable session/native identity reference. Immediately before launch, the runtime rebuilds current subject/identity and requires an exact match to intent. A crash after a launch side effect but before observed identity remains a fenced, unresolved intent; recovery must inspect durable session/process ownership and must not relaunch or infer clean state.
- `orchestration_handoff`: one immutable terminal handoff per attempt, linked to its terminal execution receipt and identity. Payload contains outcome, verified cleanup status, ordered artifacts (`kind`, stable source ref, SHA-256, byte length), and its own SHA-256. Hashes must be resolved/recomputed by a trusted host callback before insert. A claimed hash alone is insufficient.
- Extend the activity API to structured, bounded kinds: `heartbeat`, `progress`, `output`, `tool`, `artifact`, `usage`, `cancel`, `terminal`. Preserve global `(attempt, ordinal)` ordering and exact event-ID replay. Activity payloads expose references/digests and safe summaries, never raw auth, stderr, unrestricted paths, or unlimited model text.

Every transition to consumable `completed` or retryable `failed` must insert the verified handoff and terminal receipt in the same transaction or remain non-consumable. This includes clean failed attempts and later cleanup verification of an initially blocked failure. An unknown-cleanup receipt may persist diagnostic evidence but cannot create a consumable handoff, unlock a dependency, or authorize retry. Dependency readiness and direct claim must both require valid parent handoffs, so a forged legacy `completed` step cannot feed inputs to a child. Existing legacy attempts should be explicitly `legacy-handoff-unavailable`; migration must not synthesize provenance.

### Hostile failures that must fail closed

- Same event ID with changed attempt, ordinal, kind, hash, or payload; same ordinal with another ID.
- Accessors, proxies, custom prototypes, unknown keys, over-limit arrays/text, invalid UTF-8, unsafe integer times/sizes, and hash/path-like identifier confusion.
- Attempt identity that disagrees with claim, selection snapshot, stage envelope, candidate, policy, plan, or runtime subject.
- Tool/model label supplied by model output, absent host revision, candidate alias substituted for canonical tool ID, or model ID inferred from candidate name.
- Artifact missing at verification, changed bytes, duplicate logical target, conflicting source refs, hash collision row, artifact outside approved handoff sources, or a handoff referencing another attempt's receipt.
- Terminal receipt committed without handoff; handoff written after a successful terminal seal; exact replay with changed bytes; `INSERT OR REPLACE`, direct update, and delete.
- Callback timeout or late callback after attempt cancellation/terminal state. Late facts may be retained as quarantined diagnostic input only if they cannot alter the terminal handoff.
- Restart after activity but before terminal handoff, and restart after the atomic terminal commit. The former remains non-completed; the latter reads exactly once.
- Crash after immutable launch intent but before adapter call, after process/session creation but before observed identity, and after observed identity but before first activity. None may relaunch automatically; durable process/session evidence remains unresolved until host recovery proves death and cleanup.
- Failed-clean receipt without handoff, handoff without failed receipt, crash between them, exact failed-handoff replay, and an initially unknown-cleanup failure later becoming verified clean. Only the atomic clean failure handoff may become retry input.

### Done commands and measurable gate

From `daemon/`:

```text
npm run build
npx --no-install vitest run test/integration-handoff-activity.test.ts test/integration-orchestration.test.ts test/integration-engine.test.ts test/integration-runtime-contract.test.ts test/integration-executors.test.ts test/host-codex-controller.test.ts test/p3c.test.ts test/integration-driver.test.ts test/integration-observation.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
npx --no-install tsc -p tsconfig.json --noEmit
```

Then run `git diff --check` scoped to the owned files and verify an actual close/reopen SQLite fixture. Keep the unit only if all previous focused tests remain green and the new hostile matrix proves immutable replay, hash recomputation, atomic terminal handoff, and no secret/raw-path projection.

This unit can close checklist sentence **“단계 인계에 새 봉투·정책·산출물 hash·도구/모델 출처를 기록한다.”** only when the real driver/engine path, not direct SQL fixtures alone, records and consumes the handoff. It can close **“heartbeat·출력·도구·산출물 활동을 함께 관측한다.”** only when both the active Codex path and local-model path persist every supported fact and mark unsupported facts unknown; synthetic adapter events alone are insufficient.

## Unit 2 — durable wait, response, and checkpoint protocol (`032`, after unit 1)

### Exact ownership

The implementer owns only these files for this unit:

- `daemon/migrations/032_orchestration_wait_checkpoint.sql` (new; renumber upward if 032 is occupied at start)
- `daemon/src/ledger.ts`
- `daemon/scripts/copy-assets.mjs`
- `daemon/src/request-queue.ts` (new)
- `app/orchestration-driver.mjs`
- `app/orchestration-driver.d.mts`
- `daemon/src/ui/orchestration.ts` (project wait/checkpoint status only; renderer work remains separate)
- `daemon/test/integration-request-queue.test.ts` (new)
- `daemon/test/integration-driver.test.ts`
- `daemon/test/integration-observation.test.ts`

This unit consumes unit 1's immutable attempt identity and ordered activity lineage. It must not add concurrency/worktree creation or broad renderer work.

### Durable state machine and handoff contracts

Use one append-only inbox plus derived durable cursors rather than rejecting every reverse arrival:

```text
WAIT: none -> open -> responded | cancelled | expired
STREAM: empty -> receiving -> final-sealed
INBOX: exact duplicate -> no-op; conflicting duplicate -> quarantine/fail
ORDER: future ordinal -> stored pending; contiguous prefix -> cursor advances transactionally
FINAL: first valid final at next contiguous ordinal -> immutable seal; later checkpoints cannot change it
```

- A wait request binds `requestId`, workflow run/task/attempt, request ordinal, typed reason/schema, created/deadline time, expected responder authority, and payload hash. Creation is idempotent only for byte-identical canonical input.
- A response binds exactly one request, response ID, responder identity, response ordinal, payload/ref hash, and observed time. It cannot target a terminal/cancelled/expired request or another attempt. Exact replay is a no-op; conflicting replay is rejected and recorded as a protocol conflict without launching work.
- Stream checkpoints bind stream ID, event ID, attempt identity, source ordinal, `partial|final`, content/artifact reference hash, and observed time. Out-of-order events stay pending until gaps arrive. The transaction advances only a contiguous prefix. A unique final seal stores the selected final event/hash; there is no update path.
- Driver/request consumer reads durable state and decides `wait`, `claim once`, `blocked-unresolved`, or `terminal`; it never treats an in-memory Promise or transport reconnect as authority. A response-to-dispatch consumption marker and attempt claim must commit in the same immediate transaction, or no launch occurs. After any committed claim, restart/reconnect must never relaunch it: absent durable live-control reconstruction, the safe result is `blocked-unresolved` and host recovery, not automatic continuation.
- Timeouts/expiry are host-clock transitions with explicit reason events. They do not fabricate a response, cleanup success, or final checkpoint.

### Hostile failures that must fail closed

- Exact request/response/event replay across one connection, two SQLite connections, process close/reopen, and reconnect storms.
- Same ID with changed lineage/hash/payload; different ID at the same source ordinal; response before request; response to another run; two responders; response after cancel/expiry/final.
- Arrival `3,1,2`, `final(4),2,3,1`, gaps that never close, duplicate final, partial after final, and a lower ordinal arriving after final. Pending rows may survive; cursor/final may only move forward.
- Crash between inbox insert and cursor advance, between response and consumption, and between consumption and attempt claim. Transaction rollback or recovery must yield zero or one launch, never two.
- Crash immediately before adapter launch and immediately after a launch marker/process side effect but before the caller receives a handle. Reopen/reconnect must observe the committed claim/launch intent and produce no second launch; the first execution may remain unresolved and is not counted as clean or completed.
- Malformed/oversized payload, proxy/accessor input, future or regressing timestamps, invalid hashes, and payload references whose bytes cannot be resolved.
- Late callback after cancellation or terminal seal. It cannot overwrite final output, reopen a request, advance a completed task, or release ownership.

### Done commands and measurable gate

From `daemon/`:

```text
npm run build
npx --no-install vitest run test/integration-request-queue.test.ts test/integration-handoff-activity.test.ts test/integration-orchestration.test.ts test/integration-driver.test.ts test/integration-observation.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
npx --no-install tsc -p tsconfig.json --noEmit
```

The new request-queue test must include real file-backed SQLite, two independent connections/workers, close/reopen, rollback injection at every state transition, and an invocation counter proving **duplicate response consumption = 0** and **duplicate dispatch intent = 0** beyond the single authorized claim. It must also assert the immutable final row/hash after all late/reverse inputs, proving **late final overwrite = 0**. A launch-boundary fault injection must prove that reconnect does not call the adapter twice; it may conservatively end `blocked-unresolved`.

This unit can close checklist sentence **“대기 요청·이벤트·응답 체크포인트를 영속화하고 중복/역순을 처리한다.”** and the S3 completion clause **“늦은 체크포인트의 최종본 덮어쓰기 0”** only after the driver consumes the durable protocol in restart/reconnect tests. It establishes database-level duplicate consumption/dispatch intent 0, but the broader **“요청 중복/순서 역전/재시작에서 중복 실행 0”** remains open until a later actual adapter/process test proves the external launch boundary and durable ownership/recovery path. Store-only tests do not close any of these claims.

## Follow-on units intentionally still open

### Parallel reads, isolated writers, verified integration

After units 1-2, extend the plan contract with explicit access mode and integration relationships rather than inferring writes from role. The scheduler can then launch all dependency-ready read tasks up to the approved concurrency limit, serialize overlapping write scopes, or allocate separately owned worktrees. Isolated writers need immutable repository/base revision, canonical worktree root, lease per actual stage root, before/after hashes, cleanup state, and a required integration task that revalidates current base, detects conflicts, applies changes, reruns required checks, and records the resulting revision/hash. The current `workspace_write_lease(run_id UNIQUE)` and parent-root claim order require a schema redesign or a new compatible lease-generation table; changing only the in-memory `WorkspaceLeases` class cannot close checklist line 119.

Required hostile proof includes overlapping/case-variant/junction roots, two isolated writers, same-file conflict, base drift, integration-test failure, crash before/after apply, cleanup failure, retry, and restart without duplicate merge. Do not claim actual OS worktree support from mocked Orca argv tests.

### Full UI completion and Stop truth

After durable activity/wait/worktree records exist, the UI can show the exact selected tool/model/revision and reason, DAG progress, wait/block reason, verified artifact/checkpoint progress, monetary or invocation uncertainty, worktree/integration state, and Stop phases. The Stop contract should distinguish:

1. request persisted;
2. adapter cancellation requested/acknowledged/unsupported/failed;
3. owned process termination observed by the host;
4. residue/worktree cleanup verified, residual, or unknown;
5. lease released only after verified clean.

The existing Stop API returning `true` means request accepted, not OS termination or clean ownership. Current renderer polling and historical ledger cards conservatively expose unknown cleanup, but no actual S3 orchestration test drives a real OS process through Stop, identity/death observation, artifact/worktree cleanup, lease release, and UI transition. Windows Job/AppContainer and P11/P12 tests provide useful lower-layer evidence; they do not prove the optional S3 driver is wired to those observations. Actual Electron proof also remains necessary for focus/disabled states, long progress/activity lists, narrow layout, Stop retry/error behavior, and restart/reconnect presentation.

Only after those two follow-ons pass can checklist sentence **“읽기 병렬화와 쓰기 lease/별도 worktree·통합 검증을 구현한다.”** and the remaining UI completion sentence in `INTEGRATION_SPEC.md:145` close.

## Evidence boundaries

- Reviewed source: `daemon/src/orchestration/{plan,store,stage-envelope,engine}.ts`, `workspace-lease.ts`, `heartbeat*.ts`, `watcher.ts`, `integration-runtime.ts`, `adapters/integration-executors.ts`, selection/native identity stores, `app/orchestration-driver.mjs`, core/IPC/renderer surfaces, migrations 007/010/012/016/017/024/025/030, and relevant S3/P4/P11 tests.
- Reviewed prior S3 evidence: orchestration, stage-envelope, observation, driver, and local-count UI reviews. Their PASS claims are component-scoped and their listed limitations remain applicable.
- No test, build, product edit, doc edit, live model call, native process launch, worktree mutation, or Electron run was performed for this design audit.
