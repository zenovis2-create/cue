# Batch76 original-contract audit (18 open parents)

Scope: read-only comparison of the literal original checklist wording with the current batch75 source. This audit does not add the execution-map expansions (for example “real workflow” or “actual provider”) unless the original parent requires them. No provider/model/network call or test/build was run. The prior 4/4 live-call use and Qwen OFF state are unchanged.

## Decisions

### S3-01 — closure-ready offline

Original: **“읽기 병렬화와 쓰기 lease/별도 worktree·통합 검증을 구현한다.”**

The current production driver satisfies each clause:

- `daemon/test/integration-driver.test.ts` exercises a real driver read wave with `read-a` and `read-b` launched together, asserts zero writer leases during that wave, and proves a ready writer starts only after both readers settle.
- The same suite routes each parallel wait response to its owned handle once, prevents resend after reopen, cancels all published parallel starts on Stop, and retains unknown cleanup and reservations.
- `daemon/src/orchestration/engine.ts` and `daemon/src/orchestration/store.ts` bind write attempts to `workspace_write_lease`; `daemon/test/integration-orchestration.test.ts` proves same-run and other-run contention, atomic independent claims, lease retention for unknown cleanup, and crash/reopen without automatic relaunch.
- `daemon/src/orchestration/git-staging-factory.ts` plus driver staging creates attempt-scoped staging worktrees/envelopes. Driver tests query the persisted stage envelope paths and verify workflow isolation. The named integration suite proves native winner/loser publication and reopen behavior; the driver acceptance path runs the writer before its verifier/checker and retains the lease if integration evidence is unresolved.

The original sentence does not require a paid provider run. “실제 workflow” in the remaining map is later planning prose, not an original checklist condition. **Recommendation: run the already applicable driver/orchestration focused gate under an independent checker and close S3-01 if green.** No implementation change is currently identifiable from the original wording. A useful closure gate is:

`integration-driver.test.ts` + `integration-orchestration.test.ts` + `integration-engine.test.ts`, specifically retaining the parallel-reader/writer-order, stage-worktree, lease contention, unknown-cleanup, crash/reopen, and acceptance assertions.

### S4-05 — closure-ready offline

Original: **“크래시 후 held 복구와 외부 부작용 대조, 쓰기 자동 재개 금지를 검증한다.”**

The current production path and tests cover the literal contract:

- `daemon/src/held-recovery.ts` stores a held case and external-effect intent, invokes an operation-specific observer, then requires a separate verifier to authenticate exact intent/account/resource/idempotency/transition identity, provider revision, finality, and evidence bytes before a decisive transition.
- `daemon/test/integration-held-recovery.test.ts` proves an unresolved case remains held and invokes no start/resume/reserve/restore/resend callback. It proves authenticated `confirmed-not-applied` becomes eligible for a separately admitted disposition and `confirmed-applied` becomes `reconciled-stop`; missing, malformed, stale, mismatched, replayed, conflicting, non-final, or legacy observations stay held.
- `integration-held-recovery-admission.test.ts` and `integration-held-retry-admission.test.ts` re-read held authority after the final host callback and block decision insertion, replay, replacement claim, and legacy retry while a held case is open. Final seals are checked before any write authorization.
- `integration-orchestration.test.ts` separately proves crash/reopen marks the attempt blocked, retains its unresolved writer lease, and returns `launchRequired:false`; a later verified-clean receipt only releases ownership and never retries automatically.

The word “외부” requires comparison against an externally evidenced effect contract; it does not state that the test must contact a real provider. The authenticated observer/verifier boundary is deliberately injectable and rejects caller assertions. **Recommendation: run the existing held-recovery/admission/orchestration focused gate under an independent checker and close S4-05 if green.** No source change is needed for the original parent.

### S2-02 — remains open; concrete offline producer gap

Original: **“API/구독/로컬 비용과 actual/estimated/unknown/stale를 구분한다.”**

Current coverage is partial:

- `daemon/src/selection/cost-capacity-observation.ts` strictly models `api | subscription | local-resource`, `actual | estimated | unknown`, and fresh/stale/future. Its focused tests reject cross-dimension unit/currency/price/GPU combinations.
- `daemon/src/budget.ts::costObservation` is a real producer only for API monetary receipts and is consumed by `daemon/src/ui/orchestration.ts`; UI tests distinguish estimated, unknown, actual, stale, and future without exposing account/source secrets.
- `daemon/src/local-invocation-budget.ts` and the UI expose local invocation **counts**, explicitly marked “provider billing not measured.” They do not produce a `local-resource` cost observation.
- There is no production subscription observation store/producer or UI consumer. The source comment in `budget.ts` explicitly says subscription and local-resource observations require distinct stores and are never inferred there.

Therefore the validator’s synthetic subscription/local fixtures do not complete the parent. The smallest honest implementation is a persisted observation reader for subscription and local-resource records, with the same strict source timestamp/digest and freshness logic, wired into `readOrchestrationSnapshot` beside the API reader. Focused tests must insert each dimension through that production store and assert actual/estimated/unknown/stale output plus cross-dimension refusal. External provider truth is not required to prove the distinction; trusted real values can remain an external qualification issue. This unit is larger than a test-only correction and should have dedicated maker/checker ownership.

### R03 — remains open, but only for the currently selected scope

Original: **“정상/실패/취소/재시작/중복/경계를 검사한다. 순수 함수의 해당 없음은 이유를 기록한다.”**

R01/R02/R06 already define the selected scope as the limited Cue-authored fixture/tool seams; unadopted transports must not be pulled into this parent. Current receipt machinery validates current bytes, pinned fallback, drift, missing receipt, and pure synchronous N/A boundaries. However, the retained R03 lifecycle evidence still labels the historical transport receipt `incomplete-historical-transport-receipt`, with cancellation/restart/duplicate absent. Existing independent reviews correctly avoid converting those missing rows to N/A.

The next unit should first make the selected-set boundary explicit in one canonical matrix: every selected R-ID gets success/failure/cancel/restart/duplicate/boundary, or a per-row pure-function N/A reason. If the historical model transport is not in the R01/R02 selected set, exclude it by the same canonical selection record rather than testing an unadopted transport. If it is selected, its missing cancel/restart/duplicate rows are the exact gap. Run the existing receipt verifier plus a focused matrix completeness test and request independent review. No live provider call follows from the original wording for a fixture/tool-only selected seam.

## Recommended immediate ownership

1. **Checker-only S4-05 closure packet:** existing held-recovery, held-admission, held-retry-admission, and orchestration gates; no source change.
2. **Checker-only S3-01 closure packet:** existing driver/orchestration/engine gates with the named assertions above; no source change.

After those two, assign a maker/checker pair to the S2-02 subscription/local production observation store. Keep R03 as a small manifest/matrix adjudication task and do not broaden it to deferred transports.
