# 선택 결정 영속화 — 다음 최소 구현 계약

2026-09-12 `/root/reuse_pure`, 읽기 전용 조사. source freeze 중 제품/빌드/DB/native 호출 변경 0. migration 번호는 부모가 구현 시작 시 배정한다.

## 확인된 공백

`orchestration/engine.ts:115,196`의 두 replay 경로는 저장된 claim/reservation/activity를 검증하지만 `selection:null`을 반환한다. 새 실행에서는 monetary `selectCandidate` 및 local `selectLocalCandidate`의 frozen 결정을 lifecycle에 전달한다(:121,143,200,212,249). 현재 영속 activity는 정확한 **request** JSON만 담고 있다. 새로운 engine 인스턴스/재개방에서 선택 이유를 복원할 근거가 없다.

monetary `SelectionDecision`은 mode/selectedId/reason 및 최대 1000개 candidate별 score/exclusions를 제공한다(`selection/policy.ts:41,95,103–118,144`). local 결정은 fixed pair, selected/candidateId/reasons와 `ranking:not-performed`, `authority:none`이다(`local-policy-store.ts:86–100`). 두 결정을 같은 최적화 점수/비용으로 변환하면 안 된다.

## 첫 연결 단위

신규 `daemon/src/selection/attempt-decision-store.ts`, 신규 `<TBD>_attempt_selection.sql`, 기존 `orchestration/engine.ts` 두 start 경로, 신규 `integration-attempt-selection.test.ts` 및 기존 monetary/local engine regression을 소유 단위로 잡는다. ledger/copy-assets 등록은 부모가 맡는다. policy snapshot/run binding 테이블을 다시 만들지 않는다.

테이블 `attempt_selection`은 attempt_id PK/FK, run_id, request_id, kind, digest, bounded canonical payload를 갖는다. payload 예:

```ts
{
  version: 'cue-attempt-selection-v1',
  runId, taskId, attemptId, requestId,
  planDigest, envelopeHash,
  policy: { kind: 'monetary' | 'local-invocation', policyId, revision, digest },
  requestDigest, selectedAtMs,
  decision: SelectionDecision | LocalSelectionDecision,
  authority: 'historical-explanation-only'
}
```

정책 식별은 기존 `readRunPolicyIdentity`로 읽고, 기존 plan/claim 및 reservation/request activity와 정확히 대조한다. canonical decision output만 저장한다. 자유형 estimate.source, 인증/계정/환경, callback, prompt/input/response, 임의 provenance blob은 넣지 않는다. 이 첫 단위는 점수·exclusion·선택 이유의 보존이지 원래 모든 관측 입력을 재계산하는 감사 trace가 아니다.

현재 출력 validator는 export되어 있지 않다. 정책 입력을 다시 정의하지 말고 각 selector 모듈의 작은 output snapshot validator를 공유하게 추가한다. 기존 reason/exclusion 상수를 재사용하며 기존 selector의 결과 bytes/order/score는 바꾸지 않는다. strict plain data, 고정 keys/enum, unique bounded candidate IDs, finite score 또는 null, selectedId와 무제외 assessment의 일관성을 검사한다. local은 fixed pair/role과 candidate를 재확인하고 점수를 만들지 않는다. payload 상한은 최대 1000 assessment를 수용하는 1MiB 이내로 제한한다.

### 트랜잭션과 replay

1. 현재 host 관측/선택 → authorize → 기존 claim/claimRetry → 기존 reservation → 기존 synchronous stage 준비를 유지한다.
2. 같은 outer IMMEDIATE 안에서 selection snapshot을 INSERT하고 기존 request activity를 남긴다. snapshot/activity/준비/예약 중 하나라도 실패하면 전체 rollback한다. runtime 호출은 commit 뒤에만 발생한다.
3. read/replay는 saved decision의 canonical hash·정책/plan/claim/request/selected candidate 관계를 검사하고 frozen 값을 반환한다. `observeCandidates`, `observeCandidate`, selector, live price lookup은 재실행하지 않는다. 선택 snapshot은 현재 실행 admission이나 launch 권한이 아니다.
4. 정확한 replay는 같은 기록 반환, 다른 request/kind/plan/policy/후보는 거부한다. UPDATE/DELETE뿐 아니라 BEFORE INSERT duplicate guard로 REPLACE/UPSERT도 거부한다. 재시도는 새 attempt ID에 별도 snapshot을 남기고 과거 실패 선택은 유지한다.
5. 과거 업그레이드 전 attempt에는 snapshot이 없을 수 있다. `selection:null`을 현재 선택처럼 꾸미지 않고 `legacy-not-recorded`로 명시한다. 과거 history에 새 결정을 소급 생성하지 않는다. 새 engine 기록에는 snapshot 존재를 요구하는 journal insertion guard를 고려하되 기존 request JSON bytes나 ordinal을 바꾸지 않는다. 과거 결측과 손상된 새 기록의 판별은 migration에서 구현 전에 확정할 작은 호환성 조건이다.

## 실패 범위와 이후 UI

선택 성공 뒤 launch/cleanup이 failed/unknown이면 선택 설명은 그대로 남지만 성공 증거가 아니다. unknown estimate 때문에 제외된 후보가 있는 정상 선택도 exclusion을 보존한다. 후보가 하나도 없어 **claim 전에** selector가 거부한 요청은 attempt가 없고 현재 transaction이 rollback되므로 이 attempt snapshot에 억지로 넣지 않는다. 그런 rejection의 영속 요청 감사는 별도 request-level 계약이 필요하며 첫 단위 완료로 주장하지 않는다.

UI 후속은 기존 orchestration projection에 bounded DTO만 붙인다: historical kind/mode/selected candidate/reason 및 제한된 assessments와 truncation/count. local은 최적화 미수행을 표시하고 재생 값을 현재 eligibility/quality/cost로 표시하지 않는다. 검사 전 corruption/결측은 unknown 또는 legacy-not-recorded이며 selector를 재호출하지 않는다. UI의 최근 50개 기록 제한은 저장/무결성 판정에 쓰지 않는다.

## Done과 테스트

구현 cap2. build/typecheck exit0 및 신규 store + 기존 두 engine/retry focused gates, 별도 독립 검토:

- 실제 SQLite 두 모드 새 claim에서 selection+reservation+activity 원자 저장.
- stage prepare/selection INSERT/activity failure의 전체 rollback, runtime 호출 0.
- DB reopen 및 새 engine replay에서 최초 decision 동일, selector/host 관측 spy 호출 0, launch/count/reserve 중복 0.
- exact replay/conflict, mutation/REPLACE/UPSERT, hash/lineage/request/kind mismatch 거부.
- launch 실패·unknown cleanup에서도 설명 보존; unknown estimate exclusions 보존; no-eligible에서는 fabricated attempt/selection 없음.
- retry별 과거 설명 유지, legacy 결측 명시, 기존 monetary/local policy bytes/digest 동일.
- 자유형 secret sentinel/경로/대화가 저장·UI DTO에 들어가지 않음. immutable output과 크기/비정상 score/중복 ID 거부.

migration 번호, missing-new-vs-legacy 구분 방식, output validator 파일 소유권을 배정한 뒤 첫 단위를 시작할 수 있다. 전체 자동 선택 최적화/입력 provenance 저장/UI 연결 완료와 혼동하지 않는다.
