# 불변 측정 비교 snapshot

2026-09-22 / batch96. Backend/Core에 전용 목록·IPC·desktop UI를 연결했다. 실제 측정 생산자와 기본 앱의 `measuredFactHost` 구성은 아직 남아 있다.

## API

```ts
const saved = core.createEvaluationMeasuredComparison({
  snapshotId: 'comparison-1',
  baselineEnrollmentIds: ['baseline-eval', 'baseline-holdout'],
  candidateEnrollmentIds: ['mode-eval', 'mode-holdout'],
  constraints: {
    mode: 'efficiency',
    baselinePolicyDigest, candidatePolicyDigest,
    maxPriceAgeMs: 60_000, minPairsPerSplit: 2,
    qualityFloor: 0.8, minSuccessRate: 0.9, maxUnknownRate: 0,
    costLimitUnits: null, costBasisUnits: 100, timeBasisMs: 1000,
    minImprovement: 0,
  },
});
const historical = core.readEvaluationMeasuredComparison('comparison-1');
const inspected = core.inspectEvaluationMeasuredComparison('comparison-1');
// inspected.historical: 저장 당시 결과
// inspected.current.status: unchanged | changed | unavailable
```

예시는 필드 형식만 보여준다. 실제 enrollment/정책/측정 증거가 필요하며 평가1개+holdout1개만으로 minPairsPerSplit2를 충족하지 않는다. create 시각은 Core의 시계에서 가져온다. raw trial/점수/출처/확인 권한/시각을 요청에 주입할 수 없다. 조건은 명시하는 설명용 비교 기준이며 실행/정책 승격 권한이 아니다. renderer는 등록 ID·정책 digest·비교 조건만 제출하고 측정값/시각/영수증/권한은 제출할 수 없다.

## 구성과 누락 처리

- 한 데이터셋, 기준선 manual-baseline과 요청 mode의 후보군, 지정 정책 digest에 속하는 등록 ID를 명시한다. 데이터셋 최대64케이스, 군당 최대64등록, 전체 snapshot 최대1MiB다.
- ID 목록은 집합으로 canonical 정렬한다. 같은 snapshot ID/같은 요청은 원래 결과·시각을 재사용하며 host를 다시 호출하지 않는다. 다른 구성/조건은 거부한다.
- 각 등록의 **최신 관측**과 그 관측에 정확히 속하는 fact를 선택한다. 최신 관측에 fact가 없더라도 과거의 잘 변환되는 fact를 골라 대체하지 않는다.
- 없는 등록/관측/fact, 증거를 읽지 못한 fact, 비변환 fact를 분모에서 제거하지 않는다. `availability`는 split별 **전체 기대 케이스 수**를 outcomeDenominator로 쓰고 success/fail/cancelled/unknown/unavailable 및 누락별 개수를 보존한다.
- 모든 기대 슬롯에 trial이 있고 품질 metric digest도 같을 때만 수치 비교를 수행한다. 일부만 변환되거나 metric이 다르면 `numericInputs:'withheld-incomplete-or-incompatible-cohort'`로 부분집합의 성능 평균/개선 수치를 계산하지 않는다. 이때 기존 evaluator의 빈 입력 진단보다 `availability`의 전체 분모/결과를 먼저 해석해야 한다.
- 완전한 cohort라도 가격 신선도, 품질 하한, 성공률, unknown 비율, 단위, 짝지음, 표본 등의 기존 조건을 통과해야 설명용 개선 결과가 나온다.
- fixture/observed 출처는 원래 값을 유지한다. `promotionEligible:false`, `improvementProven:false`는 항상 유지된다. 합성 fixture의 숫자를 실제 개선 증거로 계산하면 안 된다.

## 저장 당시와 현재 상태의 분리

새 `cue-measured-comparison-v1`은 기존 `evaluation_comparison_snapshot` 불변 저장 envelope를 재사용한다. 새 테이블/마이그레이션은 없으며 기존 outcome-only snapshot을 변환하거나 덮어쓰지 않는다. **기존 comparison-read/list 경로는 이 새 형식을 측정 결과로 표시하지 않는다.** batch96의 전용 목록/IPC/UI만 새 형식을 표시한다.

저장값은 enrollment·observation·fact·변환 영수증·비용 분할·비교 조건/결과의 digest를 결합한다. read는 원장 안의 불변 출처를 검증하고 trial 점수/시간/식별자/비용을 다시 대조한다. 외부 evidence resolver, provider, capture callback은 호출하지 않는다. 후속 청구 수정이나 로컬 증거 접근 불가 때문에 원래 숫자를 바꾸지 않는다. 반대로 원장 출처 자체가 변조/삭제됐으면 무조건 신뢰해 반환하지 않고 거부한다.

inspect는 저장 결과를 별도로 유지한 채 최신 관측/fact 참조와 원래 fact의 현재 변환을 검사한다. changed/unavailable이 있어도 원래 행은 변경하지 않는다. **evidence-revalidation-only**이며 현재 시각으로 가격 신선도나 개선 여부를 재판정하는 API가 아니다. 새 비교가 필요하면 명시적으로 새 snapshot ID로 생성해야 한다. host가 없는 상태에서도 역사 read는 가능하지만 현재 fact 재검사는 unavailable이다.

## 경계

- 모든 선택 등록이 현재 Core workspace에 속해야 한다. 호스트 callback 전에 요청/군/정책/출처를 검증한다.
- 생성 중 원장 변경은 total_changes/schema_version/data_version으로 검사하고, 최종 IMMEDIATE 잠금 아래 다시 검사한 뒤 단일 행만 삽입한다. 같은 로드된 모듈의 원장별 callback 재진입을 막는다. 증거 callback은 writer 잠금 밖에서만 실행한다.
- 관측 중 다른 SQLite 연결의 쓰기가 있으면 전체 생성을 거부한다. 외부 callback이 이미 수행한 변경까지 롤백한다는 보장은 아니다.
- JSON에서 NaN/Infinity가 null로 변해 재요청 digest가 충돌하지 않도록 비유한 수는 해시 전에 거부한다. 접근자/Proxy/희소 배열·중복·잘못된 receipt 형태도 거부한다.
- checksum은 원장 무결성과 출처 결합 검사이며 신뢰한 DB 관리자/호스트가 모든 자료를 다시 쓰는 공격에 대한 외부 서명이나 실제 측정 인증이 아니다.

## 전용 앱 사용 경로 (batch96)

`평가 코호트 기록 → 측정 기반 비교 — 별도 저장 기록`에서:

1. 수동 기준선/후보의 **enrollment ID** 목록(군당1–64개), 정책 digest, 모드와 설명용 조건을 입력하고 명시적으로 저장한다. 기존 projection ID/fact ID를 입력하는 폼이 아니다. 고성능 모드는 비용 상한이 필수다.
2. 저장 ID로 **저장 당시 결과 읽기**, 또는 전용 목록에서 선택한다. 등록 누락/관측 누락/사실 누락/변환 불가, 실패·취소·unknown·unavailable과 전체 기대 분모를 표시한다. 완전하고 호환되는 코호트만 저장 평균/짝지은 목표 차이를 표시한다. 비성공 품질은 기존 evaluator 규칙대로0점이며 raw checker 점수의 평균이 아니다.
3. **현재 증거만 재검사**는 별도 요청이다. `unchanged/changed/unavailable` 개수를 표시하며 저장 결과는 변경하지 않는다. read로 돌아가면 현재 상태는 다시 '재검사하지 않음'으로 표시한다. 무측정 슬롯이 unchanged라고 해도 측정 완성이나 현재 자격을 의미하지 않는다.

`listEvaluationMeasuredComparisons({limit,cursor})`: limit1–20, cursor는 null 또는 이전 페이지의 양수 rowid. 한 페이지는 최대64개 envelope만 검사한다. 새 버전/현재 workspace/무결성 검사를 통과한 행만 반환하고 기존 형식·다른 workspace·손상 행은 건너뛴다. 따라서 빈 페이지라도 nextCursor가 있으면 다음 페이지가 있다. 순서는 기록 시각이 아닌 SQLite 삽입 역순이다. 목록과 historical read는 evidence callback을 호출하지 않는다.

IPC `cue:evaluation`의 전용 operation은 `measured-comparison-create/read/list/inspect`다. 추가 권한/측정 필드, Proxy/접근자/희소 배열, 중복 membership, 비유한 scalar는 거부한다. 반환값은 bounded descriptor-only 복사 후 안전한 요약만 투영한다. run/fact/attempt/receipt/evidence 경로, 원래 변환 trial, raw provider 메시지는 renderer로 보내지 않는다. 알려진 제한 사유는 보존하고 생산자 임의 사유는 `other-measurement-uncertainty`로 합산한다. 출처 개수는 저장된 **변환 receipt**의 fixture/observed/unavailable이며, 변환을 읽지 못한 fact의 출처를 observed로 추정하지 않는다.

자동 생성/수집/모델 호출/재시도는 없고 새 실행 준비·승인/Stop 시 늦은 UI 응답은 폐기한다. **현재 기본 앱에는 측정 host가 없어 새 생성은 unavailable**이다. 이미 저장된 workspace의 역사 read/list는 가능하고 fact 현재 검사는 unavailable일 수 있다. 이 연결을 실제 측정 완료/네 모드 성과로 계산하지 않는다. 네이티브 Electron 화면 인수·보조기술 테스트와 독립 검토도 별도다.

[batch96 검증 기록](../../evidence/integrations/S5/20260922-measured-comparison-ui/RESULTS.md).

## 이전 backend 검증 (batch95)

[검증 기록](../../evidence/integrations/S5/20260922-measured-comparison/RESULTS.md): 최종33파일296pass/build0/실패·skip0, 신규19개. 실제 임시 SQLite의 완전한8등록/4케이스 paired fixture와 부분/누락/변경/재열기 경계를 사용했다. 도구 실행·결과·청구·사용자 확인은 합성이다. UI·독립 검토·실측 성과·현재 전체 suite는 아직 별도다.
