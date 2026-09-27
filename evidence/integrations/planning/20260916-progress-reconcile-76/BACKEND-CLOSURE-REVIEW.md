# Backend closure review — S3-01 and S4-05

Role: independent checker of the original checklist conditions. This review did not make the S3/S4 production or fixture changes.

## S3-01 — CLOSE

Original checklist text: `읽기 병렬화와 쓰기 lease/별도 worktree·통합 검증을 구현한다.`

The current backend implements each stated condition:

- independent read steps execute as a parallel read wave; a writer is excluded until readers settle, including failed-sibling cancellation;
- write ownership is serialized by the workspace lease;
- attempts use a real Git-backed separate execution worktree;
- staged output is checked against exact target, preimage, root identity, and native compare-and-write publication authority before integration;
- contention and unknown publication outcomes remain held rather than being treated as success;
- implementation and verifier roles remain distinct, with the verifier carrying no write authority.

Evidence includes `S3/20260914-parallel-read-wave/review.md`, `S3/20260916-git-staging-driver/independent-review.md`, the writer-admission/staged-publication reviews, and the current backend gate: 14 files, 159 passed, 0 failed, 1 opt-in actual restart skipped, exit 0. The skipped case was subsequently run through its current dedicated actual fixture under S4.

This closes the bounded original backend condition. It does not claim default native provider deployment, live provider performance, or provider qualification; those are separate checklist gates.

## S4-05 — CLOSE

Original checklist text: `크래시 후 held 복구와 외부 부작용 대조, 쓰기 자동 재개 금지를 검증한다.` The governing original clause requires restored state/queue after crash, no automatic write resumption, and query/reconciliation before rerunning an external effect whose completion is unclear.

The current backend satisfies that condition:

- crash/reopen restores the held attempt, lease, and durable side-effect evidence;
- no launch, authorization, staged open/read/write resend, receipt acceptance, or replacement occurs automatically after restart;
- authenticated observation binds intent, observer identity/revision, account/resource, evidence reference/digest, provider revision, time, and finality;
- confirmed-not-applied becomes eligible for an explicit disposition, confirmed-applied becomes reconciled-stop, and missing/malformed/mismatched/throw/replay/stale/timeout/unknown evidence stays held;
- conservative staged-discard recovery remains blocked when cleanup cannot be proven; automatic cleanup is not claimed.

Evidence includes `S4/20260916-external-observation-auth/verification.md` and the current actual restart evidence in `S4/20260916-public-restart-current/`: the corrected opt-in actual fixture passed 8/8 with durable effect, restart, and cleanup records, and its independent `REVIEW.md` is CLEAR. The seven controls overlap the broader gate and are not double-counted.

This closes the original recovery/reconciliation condition. The authenticated observer is a production deployment authority seam tested offline; this verdict does not claim a live provider-specific receipt or paid provider call, which the original row does not require.

## Gate history and limits

The preliminary combined gate had cost-fixture failures and two Git test runner timeouts; those were not treated as product passes. The final current backend gate is 159 passed, 0 failed, with the actual restart exercised separately at 8/8 after correcting its trusted-root/execution-staging fixture. No real provider/model/network calls were used.
