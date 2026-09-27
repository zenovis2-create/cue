# S3 Unit 2 durable wait/checkpoint executable contract

Date: 2026-09-12 KST  
Status: design only; implementation prerequisite met by migration 033 and full driver/Core chain independent FINAL PASS (127 + 6 + isolated claim 1, build/typecheck PASS). Stable observed driver SHA-256: `999024b5bb9f6a74cccf5e93080c26a3a0f630ecc3fc75178d3fc501a9632022`.

## Done contract, correction cap, and stop rule

This unit is component-complete only when one current attempt can persist an authorized wait, accept one authorized response, atomically claim that response for delivery, preserve at-most-once behavior across faults/reopen, advance bounded out-of-order checkpoint cursors, and seal one immutable final checkpoint. Driver/UI must show a committed-but-unreconstructable delivery as `blocked-unresolved` and must never call `engine.start` again.

This is not a live-continuation claim. Current `RuntimeHandle` exposes only `snapshot`, `cancel`, and `inspectCleanup`; current adapters expose no typed wait request or response-delivery operation, and there is no durable responder registry. Until an explicitly configured trusted host supplies those capabilities, production wait creation and delivery are `unsupported`. A component PASS cannot close the broader duplicate-execution clause or claim that an actual provider/model/native execution consumed a response.

The new unit receives an initial maker pass and at most two correction passes. Every kept pass must run the focused tests, TypeScript, build, migration parity, fresh/pre-migration reopen, integrity/FK, concurrency, rollback, restart, hostile authority/resolver, and cursor/final-seal probes below. Keep a change only when the measured counterexample improves. After correction 2, any duplicate delivery, relaunch, final overwrite, unresolved side-effect rollback claim, or invented authority is `FINAL BLOCKED`; preserve the raw failure and stop.

From `C:\Users\User\cue\daemon` on every pass:

```text
npx --no-install vitest run test/integration-request-queue.test.ts test/integration-handoff-integrity.test.ts test/integration-handoff-activity.test.ts test/integration-orchestration.test.ts test/integration-driver.test.ts test/integration-observation.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
npx --no-install tsc -p tsconfig.json --noEmit --pretty false --incremental false
npm run build
npx --no-install vitest run test/integration-orchestration.test.ts -t "independent connections atomically claim exactly once" --reporter=verbose --fileParallelism=false --maxWorkers=1
```

Then run the file-backed fault matrix, compare source/dist migration bytes, hash all owned files and preserved migration 033, and run scoped `git diff --check` from the repository root. No external model, provider, native helper, Electron, or network call is permitted.

## Decision: continuation keeps the existing attempt

A response continues the same running execution. It does not create a new `orchestration_attempt`, does not call `claim`/`claimRetry`, and does not call `engine.start`.

This follows the current product invariants:

- `orchestration_attempt` has `UNIQUE(run_id,task_id)`, so a second attempt for the same waiting task cannot be inserted as an ordinary continuation.
- Engine replay deliberately returns `launch:'not-relaunched'`; converting a response into a replay cannot deliver input.
- Retry authority exists only after an exact clean failed receipt. A wait response is not a failure receipt and cannot borrow retry permission.
- A downstream-task claim cannot resume the still-running parent and can deadlock behind normal dependency readiness.

The only new identifier is an internally derived `dispatchId = SHA-256("cue-wait-dispatch-v1\0" + requestId + "\0" + responseId + "\0" + attemptId + "\0" + identityId)`. It names a delivery claim against the existing attempt identity. It is never an attempt ID or launch permission.

## Typed public and host contracts

Add one `createRequestQueue(db, host)` module. Public DTOs must be plain, dense, own-data objects with exact keys; reject proxies, accessors, custom prototypes, extras, malformed UTF-8, and out-of-bounds values before callbacks or writes.

```ts
type WaitRequestInput = Readonly<{
  requestId: string; runId: string; taskId: string; attemptId: string;
  identityId: string; requestOrdinal: number; streamId: string;
  reason: 'external-response'; responseSchema: 'cue-wait-response-v1';
  createdAtMs: number; deadlineAtMs: number;
  expectedResponder: Readonly<{ id: string; revision: string }>;
}>;

type WaitResponseInput = Readonly<{
  eventId: string; requestId: string; responseId: string;
  responseOrdinal: number; responder: Readonly<{ id: string; revision: string }>;
  contentRef: string; observedAtMs: number;
}>;

type CheckpointInput = Readonly<{
  eventId: string; streamId: string; runId: string; taskId: string;
  attemptId: string; identityId: string; sourceOrdinal: number;
  kind: 'partial' | 'final'; contentRef: string; observedAtMs: number;
}>;
```

The store computes content SHA-256, byte length, canonical payload, and payload SHA-256 from host-resolved bytes. Callers do not submit trusted hashes or lengths.

The host contract is synchronous and read-only inside database transactions:

```ts
authorizeWaitRequest(context, request): boolean;
authorizeResponder(context, request, response): boolean;
authorizeResponseContent(contentRef, requestId, attemptId): boolean;
resolveResponseContent(contentRef, requestId, attemptId): Uint8Array | null;
authorizeCheckpoint(context, checkpoint): boolean;
authorizeCheckpointContent(contentRef, streamId, attemptId): boolean;
resolveCheckpointContent(contentRef, streamId, attemptId): Uint8Array | null;
now(): number;
```

The exact responder ID and revision are frozen in the request. A response must match them byte-for-byte and `authorizeResponder` must return literal `true` both when the inbox row is accepted and when dispatch is claimed. Submitted identity text is a claim; the callback is authority. Missing callbacks default to deny. The content authorizer and resolver run on the exact bound IDs, return actual bytes, and are rerun at consumption/cursor advancement. A digest match alone is not responder or content provenance.

These callbacks may inspect current trusted host state or read durable evidence. They may not launch, send, acknowledge, write external state, mutate SQLite, return a Promise, or perform an action that would need rollback. The store calls no callback after it has started changing rows unless the callback was already snapshotted and verified as synchronous/read-only.

The driver may optionally receive one post-commit side-effect callback:

```ts
deliverWaitResponse(input: Readonly<{
  dispatchId: string; attemptId: string; identityId: string; durableRef: string;
  requestId: string; responseId: string; contentRef: string;
  contentSha256: string; contentBytes: Uint8Array;
}>): Promise<Readonly<{
  dispatchId: string; attemptId: string; identityId: string;
  durableRef: string; contentSha256: string;
}>>;
```

It is trusted main-process configuration, never renderer input. It must target an already owned execution and must not launch one. Current hosts do not implement it, so the default is `unsupported`; this unit must not invent a successful receipt. A synthetic callback may prove ordering and idempotence offline, but it is not evidence for a real adapter.

## Additive SQL lineage

Immediately before implementation, enumerate source and dist migrations plus `ledger.ts`. The current observed maximum is 033, so the expected file is `034_orchestration_wait_checkpoint.sql`. If 034 or higher exists at start, reserve exactly max+1 and update registration/copy/tests. Never edit or reorder 033.

Migration max+1 adds only append-only structures:

- `orchestration_wait_migration` and an immutable legacy fence populated on first migration from every then-existing attempt. Pre-migration attempts remain `legacy-wait-unavailable`; no wait/response/checkpoint history is synthesized.
- `orchestration_wait_request`, keyed by `request_id`, with exact run/task/attempt/identity, request ordinal, stream, reason/schema, deadline, expected responder, canonical payload and hash. `(attempt_id,request_ordinal)` and `stream_id` are unique.
- one `orchestration_wait_inbox` for typed `response`, `checkpoint-partial`, and `checkpoint-final` events. Relational discriminator columns bind request/response or stream/source ordinal fields; unused fields must be null. Exact replay is byte-identical only.
- `orchestration_wait_resolution`, one immutable first resolution per request: `responded`, `cancelled`, or `expired`, referencing the exact inbox event when responded. A unique request key makes races single-winner. A response's `responseOrdinal` must equal the bound request ordinal.
- `orchestration_inbox_cursor`, append-only cursor advances for `wait` and `checkpoint` scopes. Each row references its predecessor ordinal and exact event or terminal resolution; there is no cursor update. The wait cursor means consumed/skipped resolution, not mere response arrival: a responded ordinal advances only in the dispatch-claim transaction, while cancelled/expired ordinals may be skipped by a bounded read-only-authorized reconciliation call.
- `orchestration_checkpoint_final_seal`, at most one immutable seal per stream, referencing the final inbox event, exact content ref/hash/length, and the cursor advance that made it contiguous.
- `orchestration_wait_dispatch_claim`, unique on request and response, binding the internally derived dispatch ID to the existing attempt, identity, current launch-intent hash, original claim-payload hash, response content hash/length, and claim time.
- `orchestration_wait_delivery_observation`, at most one immutable observation per dispatch with `delivered`, `failed`, or `unknown`. `delivered` requires the exact callback acknowledgement tuple; it records an observation, not proof that provider code acted correctly.

Every payload-bearing row uses a `cue_sha256(NEW.payload)=NEW.payload_sha256` insert trigger. All tables reject update, delete, replace/ignore conflicts, changed replay, cross-attempt identity, and rows for the max+1 legacy fence or the 033 legacy integrity fence. Missing `cue_sha256` makes writes fail closed. Public reads recompute hashes and relational equality; row existence is never enough.

A request is allowed only while the exact attempt is `running`, its 033 launch intent and identity pass current integrity, the session handle belongs to that attempt, `createdAtMs <= host.now() < deadlineAtMs`, and the deadline does not exceed the bound stage-envelope expiry. Request ordinals are contiguous from 1. Limits are: 128 requests per attempt, 16 streams per attempt, 4,096 inbox events per stream, a maximum look-ahead gap of 256, 256 cursor advances per reconciliation call, 1 MiB resolved content, and 32 KiB canonical metadata payloads.

Response-before-request is rejected with zero rows because expected-responder authority cannot yet be established. Responses for later existing requests may arrive before earlier responses; they stay pending. Dispatch claims consume responded requests in request-ordinal order, while a bounded cursor reconciliation skips cancelled/expired ordinals without creating a dispatch.

## Atomic response consumption and callback order

Expose `orchestrationStore.claimWaitResponse({requestId,responseId,claimedAtMs})`. It uses one outer immediate transaction and does not call the existing public `claim()`:

1. Load and integrity-check the immutable request, response, resolution, current attempt, launch intent, identity, stage envelope, and content bytes.
2. Require the attempt to remain `running`, the response to be the next dispatchable wait resolution, exact responder authorization, and no prior dispatch.
3. Rebuild the existing `ClaimContext` and rerun the same `host.authorizeClaim(context) === true` used by the original attempt. This reuses current host authority; it does not create a new permission.
4. Insert exactly one dispatch claim bound to the existing attempt/identity and advance the wait cursor in the same transaction.
5. Commit and return the immutable dispatch DTO. A competing connection gets exact replay or `already-claimed`; neither receives launch authority.

Only after commit may the driver examine its in-memory `entry.handle`. It calls `deliverWaitResponse` once only when the handle belongs to the same attempt, current identity/durable reference still matches, the dispatch was newly claimed by this call, and the optional delivery capability exists. It never invokes `engine.start` for a response.

After the callback returns, a separate transaction validates the exact acknowledgement and appends a delivery observation. If the callback throws, times out, returns a mismatch, or succeeds but the observation transaction fails, the dispatch remains committed and becomes `blocked-unresolved`; it is never sent again. The database must not roll back the dispatch claim and pretend an external side effect was undone.

Fault outcomes are therefore deliberately asymmetric:

- rollback before dispatch commit: no claim and no callback; a later caller may claim once;
- crash after dispatch commit but before callback: claimed-unresolved, no resend after reopen;
- crash during/after callback but before observation: claimed-unresolved, no resend;
- observed exact acknowledgement: delivered-observed, still not execution completion or cleanup proof.

Cancellation or expiry appends the first request resolution under the host clock. It does not fabricate a response, dispatch, final checkpoint, execution receipt, cleanup result, or lease release. A late response loses the unique resolution race and cannot reopen the wait.

## Bounded checkpoint reconciliation and final seal

Checkpoint insertion verifies current attempt/identity, source authorization, resolved bytes, and bounds, then appends to the single inbox. A future ordinal within the 256-event window is retained as pending. The same transaction advances at most 256 contiguous events from the last durable cursor; `reconcileCheckpoint(streamId)` performs another bounded batch without requiring a new event.

Every event is reauthorized and its bytes are re-resolved before its cursor advance. Missing or changed bytes stop before that event and expose `blocked-unresolved`; they do not skip the gap. When the next contiguous event is `final`, that transaction appends the unique final seal and stops. Higher pending rows remain audit-only. New non-replay events after a seal, another final, partial after final, lower conflicting ordinal, update, delete, and replace all fail. Nothing updates the sealed content ref/hash/length.

For an attempt that opened a wait/checkpoint stream, `finish` may accept a terminal handoff only when the shared handoff-integrity reader validates the seal and the terminal handoff contains the exact sealed content ref/hash/length. A checkpoint or delivery observation never completes the attempt on its own.

## Restart behavior and UI projection

On reopen, any dispatch claim lacks a reconstructible in-memory handle under the current engine. It is always `blocked-unresolved`; the driver does not call the optional delivery callback and does not resend. Existing `store.recover` may fence a running attempt as blocked, but no wait code sets cleanup verified, fabricates a failure receipt, releases a lease, or creates another attempt. Recovery requires a separately supported durable live-control mechanism.

UI projection is read-only and bounded. It may expose request state, wait cursor, pending count, dispatch state (`not-claimed`, `claimed-unresolved`, `delivered-observed`, `unsupported`), checkpoint cursor, final-seal status, and explicit legacy/integrity unavailability. It must not expose raw content, content refs, responder payloads, paths, or free-form reasons, and must not label an acknowledgement as verified execution success.

## Minimal ownership

Root has recorded the required final PASS and stable post-033 driver bytes, so one maker may now own only:

- new max+1 migration, `daemon/src/ledger.ts`, and `daemon/scripts/copy-assets.mjs`;
- new `daemon/src/request-queue.ts`;
- `daemon/src/orchestration/store.ts` for the single authorized `claimWaitResponse` seam and terminal seal requirement;
- `app/orchestration-driver.mjs` and `app/orchestration-driver.d.mts` for post-commit delivery/default unsupported/restart behavior;
- `daemon/src/ui/orchestration.ts` for bounded status projection;
- new `daemon/test/integration-request-queue.test.ts` plus direct changes in `integration-orchestration.test.ts`, `integration-driver.test.ts`, and `integration-observation.test.ts`;
- maker evidence for this unit.

Do not edit engine/runtime/adapters merely to manufacture a response method. Do not change 033, retry, acceptance, handoff artifact, renderer, provider lifecycle, native, model, or worktree semantics. If a real adapter continuation capability is later authorized, it is a separate unit with its own ownership and actual-process gate.

## Required test matrix

- Valid current same-attempt request → response → dispatch: one attempt row, original launch counter exactly 1, new launch counter 0, one dispatch, callback at most 1, exact replay stable.
- New attempt ID, `claim`, `claimRetry`, or `engine.start` used as continuation: rejected; no rows or callback.
- Two connections and reconnect storm claim one response: one winner, one dispatch, at most one callback. Losing calls cannot receive `newlyClaimed:true`.
- Responder ID/revision mismatch, host denial, resolver denial/null/throw, changed bytes, cross-run/task/attempt/identity, expired/cancelled/terminal request: zero dispatch delta.
- Response before request: zero inbox rows. Existing requests with response arrival 3,1,2 advance only the contiguous resolution prefix.
- Fault injection before/after inbox insert, resolution, cursor advance, dispatch commit, callback, and delivery observation produces the documented zero-or-one result without claiming external rollback.
- Reopen after committed claim, after callback-before-observation, and after delivered observation: no resend or relaunch; the first two are blocked-unresolved.
- Checkpoints `3,1,2`, `final(4),2,3,1`, never-closed gap, two finals, late partial, and lower changed ordinal: cursor only increases, one immutable seal, sealed hash unchanged, late final overwrite count 0.
- Final content missing/changed or absent from terminal handoff: `finish` rolls back terminal state. Exact sealed content allows the existing 033 host-validated terminal path.
- Fresh and copied pre-max+1 databases across two reopens: explicit legacy unavailable, no fabricated history, current post-marker attempt writable, `integrity_check=ok`, `foreign_key_check=[]`, migration replay idempotent, source/dist bytes equal, preserved 033 hash unchanged.
- Plain raw connection without `cue_sha256`: all new payload writes fail closed. Direct SQL rows with self-consistent hashes never bypass public responder/content authorization or produce a UI verified state.

The durable wait/checkpoint checklist sentence and late-final-overwrite clause may close only after this complete component and driver matrix passes. The broader restart duplicate-execution clause and successful live continuation remain open until an authorized adapter-specific delivery path and durable live-control recovery are independently proven.
