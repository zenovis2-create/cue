# S5 실제 실행 결과 수집: 최소 미완료 연결 계획

조사 2 pass 완료. 소스·테스트 실행·빌드·새 측정·모델/OS 호출 0. 기존 실행 증거를 새 실측으로 승격하지 않는다.

## 확인한 기존 기반과 공백

- `daemon/src/evaluation/comparison.ts:68 freezeEvaluationDataset()`은 case ID/inputDigest 중복과 evaluation/holdout 겹침을 거부하고 canonical digest+프로세스 내 WeakSet 브랜드를 만든다.
- `:111 createEvaluationStudy()`는 **메모리 내** append-only record/snapshot/compare이다. exact replay 허용, 같은 ID 변경 및 case/arm/policy 중복 거부. 실패/취소/unknown을 분모에 포함하고 non-success quality를 통계상0으로 계산한다. 가격·환경·정책·단위·표본/paired coverage의 불확실성을 남긴다. promotionEligible=false 고정.
- `daemon/test/integration-evaluation.test.ts`의 12개 기존 케이스가 위 산술/동결/비교 계약을 검증한다. 검색 결과 app 또는 다른 daemon production 모듈에서 두 factory를 호출하는 곳은 없다. **실제 run→평가 trial 수집·등록·재시작 저장 연결이 없다.**
- spec `INTEGRATION_SPEC.md:158–166`, checklist `:179–189`는 유형/도구/모델/revision별 실측, 실패 포함, 총비용·retry/handoff와 holdout 개선을 요구한다. 현재 foundation PASS는 이를 완료하지 않는다.

## 지금 원장에서 재사용할 정확한 읽기 경로

| 원천 | 재사용과 제한 |
|---|---|
| `verification/acceptance.ts readAcceptanceHistory(db,runId)` | 평가/blob/manifest/requirements/모든 과거 maker/현재성 연결을 검증한 **역사 인수**. receipt가 있어야 verified success 후보. 평가 verdict pass만으로 성공 아님. 파일/OS를 새 검사하지 않음. |
| `selection/run-policy-identity.ts readRunPolicyIdentity` + `selection/attempt-decision-store.ts createAttemptDecisionStore.read` | immutable 실제 선택 policy kind/ref/digest, attempt candidate와 과거 결정 연결. legacy-not-recorded를 모델명으로 채우지 않음. 후보 ID는 tool/model revision 증명이 아님. |
| `orchestration/store.ts` 및 010/016 schema | 모든 attempt와 immutable execution receipts/retry linkage. 현재 stage 마지막 성공만 보고 과거 실패를 제거하면 안 됨. claim 시각은 request.observedAtMs이지 실제 프로세스 시작시각이 아님. |
| `budget.ts createBudgetManager(...).summary()` / 008 receipts | actual/estimated/unknown 및 providerFinal 분리. reservation 상한을 실제비용으로 사용 금지. 늦은 receipt revision을 중복 가산 금지. raw source 문자열은 수집 데이터에 복사하지 않고 검증된 참조·해시만. |
| `local-invocation-budget.ts summary()` | committed dispatch-intent count. 화폐/실제 provider 호출수 아님. EvaluationTrial.costs(currency,minor/micro)에 끼워 넣을 수 없음. |
| `resources/retrospective.ts createRetrospectiveStore()` | bounded safe-column projection/hash와 역사 reopen 패턴 재사용 가능. 이 draft는 acceptance:not-assessed라 평가 성공 판정 원천으로는 부적합. |
| `app/orchestration-driver.mjs:175,388` | 사용자 Stop은 task state=blocked, blocked_reason=cancelled. memory cancelled flag만 남는다고 오해하면 안 됨. timeout/deadline/일반실패도 blocked라 state만으로 fail/cancelled를 합치면 안 됨. |

## 중요한 표현 불일치 — 억지 Trial 생성 금지

현재 EvaluationTrial은 toolId/toolRevision/modelId/modelRevision, environmentDigest/accountLimitsDigest와 **화폐** costs를 필수로 요구한다. 실제 고정 local workflow 원장에는 복수 maker/checker와 retry candidate들이 있고, immutable per-attempt tool/model revision 및 비교가능 환경 측정이 항상 없다. acceptance pass는 0..1 품질 점수가 아니다. elapsed를 claim→최근 observation 차이로 만들면 큐/종료/cleanup 포함 범위를 새로 발명한다. local count에 USD=0 또는 LOCAL_CALL/micro를 부여하거나 'unknown' revision을 실제 revision처럼 넣으면 잘못된 데이터다.

따라서 가장 작은 안전한 첫 연결은 **실제 ledger outcome의 손실 없는 읽기 수집**이며, 현재 필수필드를 충족하지 못하는 run을 억지로 `study.record()`에 전달하는 것이 아니다. 이 단위 이후 comparison까지 연결되었다고 체크하지 않는다.

## 다음 bounded 구현 단위 A (권장)

새 `daemon/src/evaluation/run-outcome.ts`와 새 `daemon/test/integration-evaluation-outcome.test.ts`만. DB migration/driver/core/UI 변경 없이 `readRunOutcome(db,{runId})`를 호스트가 명시 호출한다. 한 SQLite read transaction, 고정 schema/limit(예:1024 attempts,2048 source refs,1MiB), 초과는 unavailable 반환하고 일부 성공행만 기록하지 않는다.

반환: `{version,runId,authority:'evaluation-input-only',sourceHashScope:'safe-column-projection',sourceDigest,observedTaskState,outcome,uncertaintyReasons,policy,attempts,acceptanceRef,accounting,quality:null,elapsedMs:null,trialReadiness:{status:'not-convertible',reasons}}`.

- missing run은 null, malformed lineage/reader integrity 실패는 고정 이유의 unavailable 결과. raw SQL/예외/path/env/prompt/대화/artifact body는 반환하지 않는다.
- `outcome:'success'`는 strict historical acceptance receipt와 parent completed가 일치할 때만. provider/tool done만 있으면 unknown.
- `blocked_reason==='cancelled'`라는 호스트 저장 marker는 cancelled-requested 결과로 기록하되 cleanup unknown 별도 유지(취소 성공/프로세스 종료 주장 금지). 반환 outcome은 cancelled, uncertainty에 cancellation-not-clean 포함 가능.
- parent failed 또는 검증된 실패 종결 증거와 일치하는 경우 fail; running/timeout/deadline/인수 누락/모순/일반 blocked는 unknown+고정 이유. 후속 설계에서 실패 원인 분류를 넓히더라도 과거 관측을 수정하지 않는다.
- acceptance 최종 성공이면 billing unknown만으로 outcome을 unknown으로 떨어뜨리지 않는다. 비용과 성공은 별도 축이다.
- attempts는 모든 실패·재시도·현재 시도를 포함한다. host가 관측하지 않은 model/tool revision·quality·latency는 null/unknown. 현 버전의 이진 인수율과 연속 품질 점수는 구별한다.
- 금전 budget은 currency/unit+실제/미확정 구분된 누적액/참조; 비용 breakdown은 증거 있는 분류만, handoff 포함 여부 미증명 시 null. local budget은 별도 discriminated kind/count semantics로 보존, monetary fields 없음.
- 동일 원장 snapshot의 sourceDigest/반환값은 결정적이며 읽기 재생으로 record를 추가하지 않는다. 뒤늦은 settlement/accepted receipt/cleanup 변화는 **새 snapshot digest**가 된다. 역사 수집을 덮어쓰는 API는 이 단위에 없다.

비중복 신규 gate 이름:
1. `accepted_without_final_billing_preserves_success_and_unknown_cost`.
2. `provider_success_without_verified_acceptance_is_unknown`.
3. `stop_marker_and_unresolved_cleanup_preserve_cancelled_uncertainty`.
4. `retry_history_keeps_failed_attempts_and_counts_every_committed_intent`.
5. `late_actual_receipt_changes_snapshot_without_double_counting`.
6. `missing_revision_or_local_count_never_fabricates_monetary_trial`.
7. `corrupt_acceptance_or_policy_is_unavailable_not_success`.
8. `same_snapshot_reopen_digest_and_total_changes_unchanged`; bounded overflow/privacy sentinel 포함.

기존 comparison 12개 통계 테스트는 그대로 회귀에 포함하되 반복 재작성하지 않는다. gate는 새 realSQLite fixtures+기존 comparison/typecheck, cap2 수정가설, maker/checker 분리. native/model/live pricing 호출0.

## 실제 study 연결에 필요한 작은 후속 B (A와 섞지 않음)

승인 **이전** cohort enrollment가 필요하다: dataset canonical bytes/digest, caseId/inputDigest/split, arm/policy, actual runId, 사전 정의한 metric revision/환경·계정조건 참조를 immutable bind. 종료한 성공 run만 나중에 선별 등록하지 못하게 기존 accepted approval/attempt guard를 재사용한다. 새 migration 번호는 root가 정한다.

enrolled run 전체를 대상으로 outcome snapshot을 수집하고, missing/in-flight/cancelled도 coverage에서 빠뜨리지 않는 append-only observation revision을 저장한다. late update는 supersedes 연결로 보존하고 study export는 사전에 정한 cutoff의 1 case/arm 관측만 선택한다(기존 duplicate_case_arm 계약 유지). comparison dataset 브랜드는 reopen 시 원문을 freezeEvaluationDataset으로 다시 검증한다.

호스트가 검증해 저장한 revision/metric/cost 계약이 있어 기존 EvaluationTrial로 손실 없이 변환 가능한 경우에만 createEvaluationStudy.record()로 전달한다. 그 외는 dataset coverage gap/unknown 표에 유지한다. local accounting을 비교하려면 별도 explicit count metric 계약이 먼저 필요하며 기존 monetary comparison을 몰래 바꾸지 않는다. baseline/holdout 생성·실측·정책승격·자동 selector 튜닝은 별도 승인된 S5 gate이고 이 계획/수집만으로 성능개선을 주장하지 않는다.

## 재사용 결정

1순위 기존 comparison + strict ledger readers. 2순위 retrospective의 safe projection/hash 방식만 재사용. 외부 평가 플랫폼/telemetry SDK는 이번 seam에 필요하지 않음: 실제 실행 authority/저장 계약을 추가로 복제하고도 누락된 사전 cohort·측정 provenance를 해결하지 못한다.