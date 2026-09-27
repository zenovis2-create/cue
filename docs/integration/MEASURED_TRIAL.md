# 저장된 측정 fact → trial 변환

2026-09-22 / batch94. 읽기 전용 backend 경로이며 실제 측정기·UI 비교 실행 연결 완료를 뜻하지 않는다.

## API

```ts
// Core: 현재 workspace의 저장 fact만 허용. measuredFactHost 구성이 필요하다.
const result = core.convertEvaluationMeasuredTrial({ factId: 'saved-fact-id' });

// Daemon의 신뢰한 호스트용 API. renderer payload/측정값을 받지 않는다.
const converter = createMeasuredTrialConverter(db, measuredFactHost);
const result = converter.convert({ factId: 'saved-fact-id' });
```

`status:'convertible'`이면 `trial`은 기존 `createEvaluationStudy(dataset).record(trial)`이 받는 정확한 계약이다. `status:'insufficient'`이면 `trial:null`과 `reasons`를 반환한다. 변조·다른 원장 계보·변경된 증거 등 검증 오류는 예외로 거부한다. 어느 경우에도 실행/승인/측정 수집·원장 삽입·정책 승격을 수행하지 않는다.

결과는 fact/enrollment/observation/계약/인계 분할/실행 조합 digest에 묶인다. 반환 객체는 중첩까지 동결된다. 이는 별도 불변 저장 행이 아니라 **현재 시점에 다시 검증한 파생값**이다. 동일한 증거/상태에서는 재열기 후에도 동일하게 파생되지만 청구/실행이 바뀌면 같은 fact도 더 이상 변환되지 않을 수 있다.

## 변환 조건

- fact 저장소의 canonical 검증과 증거 바이트 재검증, enrollment/관측 연결, 실제 정책 및 불변 plan 일치.
- 수동 기준선이면 저장 선언과 원래 후보/계획 결합도 검사한다. 일반 mode와 비교군 manual-baseline을 혼동하지 않는다.
- 실행 입력 digest가 기대값과 일치하고 모든 계획 작업의 실행 관측이 있다. 도구/모델·생산자·시계·계약 revision이 알려져 있어야 한다. 검증 작업 관측이 필요하다.
- 종료되지 않은 attempt, 실행 중/대기 중 작업, 미확인 정리·쓰기 상태, 남은 writer lease는 불가하다. 재계획 실행은 현재 미지원이다.
- 명시적 품질 metric 범위는0..1이어야 한다. 다른 척도를 임의 정규화하지 않는다. 환경·계정 계약은 complete여야 한다.
- 실제 품질 값과 `execution-queue-cleanup` 범위의 시간 값이 모두 있어야 한다. 실행 시간만 있는 부분 범위는 완전한 완료 시간으로 취급하지 않는다.
- final monetary receipt 전체와 그 영수증을 base/retry/verification/handoff로 분할한 저장 증거가 필요하다. 분할 합계가 원래 총액과 같아야 하며 BigInt 합산 후 안전 정수 범위를 검사한다. local invocation 횟수를 돈으로 바꾸지 않는다.
- 가격 계약의 authority·통화/단위·시각이 일치해야 한다. 비교 시점의 가격 신선도/품질 하한/표본/짝지음 조건은 기존 study.compare가 별도로 판단한다.
- 더 새로운 receipt/예약 내역이나 달라진 종료 결과가 있으면 기존 측정으로 현재 비교 trial을 만들지 않는다.
- fact의 uncertaintyReasons는 모두 변환 차단 사유로 남긴다. 관측의 선택 이력 누락/성공 인수 부재 등은 `outcomeUncertainty`로 별도 보존한다. 실패·취소·unknown을 성공으로 바꾸거나 배열에서 제거하지 않는다. 일부 fact가 미변환이면 해당 케이스를 비교에서 조용히 제외해서는 안 된다.

## 여러 도구·모델의 식별

trial의 단일 문자열 필드에 임의의 대표 모델을 골라 넣지 않는다. `executionIdentity.members`에 역할·후보 digest·도구/모델 ID/revision의 정렬된 고유 조합을 남긴다. `toolId:'cue-execution-toolset-v1'`, `modelId:'cue-execution-modelset-v1'`과 조합 digest는 **복합 실행 식별자**다. 실제 공급자 모델 이름/새 버전/설치 측정값을 뜻하지 않는다. 각 시도와 반복 횟수의 전체 계보는 원본 fact digest가 결합한다.

## 권한·동시성

- offline-fixture → `source:'fixture'`, host-observed → `source:'observed'`. 이름을 바꿔 fixture를 승격하지 않는다. 후자는 신뢰한 host의 관측 계약을 전제로 하며 테스트에 주입한 host는 여전히 합성 증거다.
- `promotionEligible:false`는 항상 유지한다. 변환 가능은 성과 개선/독립 검토/실제 공급자 자격을 뜻하지 않는다.
- callback 재진입은 원장별로 거부한다. 검증 전후 `data_version`, `schema_version`, `total_changes()`를 대조해 관측 중 같은/다른 SQLite 연결이 변경하면 반환을 거부한다. 이는 낙관적 안정성 검사이며 외부 호스트가 수행한 변경을 롤백하거나 OS/원격 측정을 원자적으로 만드는 기능이 아니다.
- Core는 호스트 호출 전에 현재 workspace의 fact인지 검사한다. renderer용 새 IPC나 값 입력 권한을 열지 않았다.

## 그대로 남는 경로와 다음 작업

기존 저장 fact의 `trialReady:false`, outcome-only projection의 `trial:null`, UI의 설명용 evidence와 비교 snapshot 의미는 변경하지 않았다. 새 변환 결과를 자동으로 기존 비교군에 끼워 넣지 않는다.

남은 코드: production 실행 입력/품질/시간/환경/계정/가격/비용 생산자, 기본 앱 measuredFactHost 구성, 변환 결과를 명시적 cohort membership/비교 snapshot/UI에 연결. 실제 baseline과 네 모드 holdout 실측은 새 호출 범위·예산 승인 및 현재 자격이 필요하다. Qwen OFF·구독4/4 소진 유지.

[검증 기록](../../evidence/integrations/S5/20260922-measured-trial/RESULTS.md): build0·32파일277pass·실패/skip0, 신규28개. 완전한 실패/취소/unknown fact 및 별도 기준선·비용/경계 검사는 합성 호스트/영수증/활동을 사용했다. 실제 공급자 성공이나 성과 개선 증거가 아니다. 전체 suite·독립 검토는 별도다.
