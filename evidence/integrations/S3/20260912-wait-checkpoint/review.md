# S3 wait/checkpoint Unit 2 — final independent review

Date: 2026-09-12 KST  
Verdict: **PASS — bounded offline component**  
Correction budget: **2 of 2 used**

No blocker remains in the frozen migration-035 component. This verdict preserves the prior migration-033 PASS and does not claim a live continuation, real adapter delivery, durable live-control recovery, or closure of the broader restart duplicate-execution requirement.

## Reviewed identity

The repository HEAD was `8e2afa6366e3af62f7115b2c67be799130f8dfdf`; the shared worktree is intentionally uncommitted, so these hashes identify the reviewed bytes:

- migration 033: `d2ada29d74c3c50e310002db7938d86c6c68163817513ab19571d24fc3e4e9b2`
- migration 034: `eaa07960c3259bb8127b5b40c82b7c5fea1f296f4b1fbf438357434569e036d0`
- migration 035 source/dist: `efe79e0d2b7a86806c342745313cbba6e2790847bfd9b5370a21ca5a71869e92`
- `daemon/src/ledger.ts`: `7f03496999b71acc07fac8657908d1f23dd88daa7236dd15752a2f36221192bf`
- `daemon/src/request-queue.ts`: `d6694ca7344cedad43e36e88054873c3f4995b2b3f214107f9f31a5cce0d322f`
- `daemon/src/orchestration/store.ts`: `755682fcf872fad6dc28b1dcee7594e25ea623898302e21126c2db754f58ae47`
- `app/orchestration-driver.mjs`: `2b0a9be37ca4899358e18171b804b5111b93ea9b2972c29735de50672df8b247`
- `app/orchestration-driver.d.mts`: `4ba9136326f3e55f42c117101021020897afe4c35df85ab831c9286c465538f8`
- `daemon/src/ui/orchestration.ts`: `388cc7a1045c3390f0e8210bb9a0733c1425097b5266dfa3ff249f7d01414489`
- `daemon/test/integration-request-queue.test.ts`: `ed4a21f719903823d3e5110cad144b4696717cc9931f98fecf62ded19f5b9adb`

## Corrections reviewed

The first review pass found four correctness gaps: non-enumerable required DTO fields were accepted; checkpoint advancement did not revalidate the exact stored event and checkpoint authority; cancelled/expired cursor advancement lacked renewed request authority; and dispatch did not compare response payload bytes with reconstructed relational fields. Correction 1 fixes each case and adds zero-write/revoked-authority assertions.

The second review pass found that the migration marker and legacy fence denied replacement inserts but still allowed update/delete. Correction 2 adds explicit update/delete denial triggers for both tables and expands the direct matrix. No further correction pass remains.

The final source now validates plain, dense, enumerable own-data input before callbacks and writes. It reconstructs request, response, and checkpoint DTOs from stored relational columns, verifies payload hashes and exact canonical bytes, and reruns current lineage and host authority before consumption or cursor advancement. Response content and checkpoint content are reauthorized, re-resolved, hashed, and length checked at the decisive read.

## Behavioral result

A response continues the same attempt and identity. `claimWaitResponse` reruns the original claim authority, commits one deterministic dispatch claim and the matching wait-cursor advance in one immediate transaction, and returns `newlyClaimed:true` only to the committing call. It does not call `claim`, `claimRetry`, or `engine.start`.

The driver invokes the optional delivery callback only after that commit and only for the matching currently owned handle. Exact replay and a recreated driver receive `newlyClaimed:false` and do not resend. Missing capability reports `unsupported`; a committed claim without reconstructible live ownership reports `blocked-unresolved`. Exact acknowledgement identity is required before an immutable delivered observation is appended. Callback failure or observation failure leaves the durable claim visible and does not pretend the external action rolled back.

Checkpoint events may arrive ahead within the bounded gap. Advancement is contiguous, capped, and reauthorized at every event. Missing, changed, or unauthorized content stops before the event. The first contiguous final appends one immutable seal; later partial/final input and mutation/replacement cannot overwrite it. Terminal finish with a wait/checkpoint stream requires the exact sealed content ref, digest, and length in the host-validated migration-033 handoff, and changed bytes roll the terminal transaction back.

Migration 035 is additive after preserved 033/034. First installation fences pre-035 attempts before closing the immutable marker. Reopen does not refence current attempts. Every populated queue table is append-only; marker and fence membership are also update/delete protected. A raw connection without `cue_sha256` cannot insert payload-bearing authority. UI projection is bounded and exposes counts/cursors plus `not-claimed`, `claimed-unresolved`, or `delivered-observed`, without raw content, content refs, responder payloads, paths, or free-form reasons.

## Independent verification

Run from `daemon` against the frozen bytes:

- direct request-queue correction/fault matrix: **9/9 PASS**;
- required six-file queue, handoff-integrity, handoff-activity, orchestration, driver, and observation regression: **6 files, 74/74 PASS**;
- nonincremental TypeScript check: exit 0;
- build and migration asset copy: exit 0;
- standalone independent-connection claim regression: **1/1 PASS**;
- migration 035 source/dist hash parity: PASS;
- scoped `git diff --check`: exit 0, with only existing line-ending notices.

The direct matrix covers same-attempt claim/replay, out-of-order checkpoint advancement and final seal, cancellation/expiry first-winner behavior, hostile DTO and acknowledgement input, renewed authority failure, all populated append-only tables, transaction rollback before request/response/dispatch commit, terminal seal missing/changed/valid behavior, responder/ordinal/foreign lineage and claim denial, copied pre-035 upgrade across reopen, and missing hash-function denial. Source inspection additionally confirmed bounded loops/gaps, immutable resolution/cursor/seal rows, exact dispatch derivation, post-commit callback order, no-wait optional-host behavior, and the UI's fail-closed unresolved projection.

## Evidence boundary

All verification used local synthetic fixtures and SQLite files. No model, provider, native helper, Electron, network, paid, or external-system call ran. The optional delivery callback is synthetic evidence for component ordering and at-most-once invocation only. Production wait creation and response delivery remain unsupported until a separately reviewed trusted adapter and durable live-control mechanism implement those capabilities.
