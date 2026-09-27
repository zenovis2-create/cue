# 고정 작업 계획 수동 기준선

2026-09-22 / batch92. 구현 및 오프라인 검증 범위다. 실제 사용자 선택·공급자 실행·성과 실측의 증거가 아니다.

## 사용하는 순서

1. 보호된 기존 파일 실행 설정으로 실행을 **준비**한다. 아직 승인하지 않는다. 계획 생성 실행 자체는 기준선으로 등록할 수 없다.
2. 평가 패널에서 전체 workload manifest 또는 준비/목록 JSON을 가져오고 케이스를 명시적으로 선택한다. [작업셋 사용법](FROZEN_EVALUATION_WORKLOAD.md).
3. 등록 ID, 지표·환경·계정 한도의 ID/revision/digest를 입력한다. 이는 사용자 참조이며 실제 관측값이나 계정 자격 인증이 아니다. 일반 모드 등록 버튼을 먼저 누르지 않는다.
4. 수동 기준선 ID를 입력하고 **고정 조합을 수동 기준선으로 확인**을 누른다. 정책/후보는 입력창 값이 아닌 현재 Core의 불변 작업 계획에서 가져온다.
5. 시스템 확인 창에서 작업공간·실행·데이터셋/케이스·정책·작업별 후보/담당자·참조를 확인한다. 기본 버튼은 취소이며, 확인 체크박스와 등록 버튼을 모두 선택해야 등록된다. 2분 경과, 새 실행 준비, 실행 승인/시작/정지, 창/작업공간 변경 등은 미처리 확인을 무효화한다.
6. 등록은 작업 실행을 승인하지 않는다. 별도의 원래 실행 승인과 현재 후보 자격·계정·격리·예산 조건이 계속 필요하다. **현재 구독4/4 소진과 Qwen OFF가 해제되는 것은 아니다.** 실제 호출은 새 범위/예산 승인 후에만 진행한다.

등록 뒤 입력 연결은 `claimed-not-verified`, outcome-only 투영은 `trial:null`, 성과/정책 승격은 불가다. 초기 seed 검사 역시 실제 실행 입력 증거를 만들지 않는다.

## 지원하는 조합

- 명시적인 `planDigest`를 가진 새로운 선언 변형만 task별 고정을 사용한다.
- 현재 monetary 정책은 전역 pin이 **없어야** 한다. 각 작업은 후보1개만 가지며 모든 implementation 작업의 후보가 같아야 한다.
- 최대16작업, 구현1개 이상과 독립 verifier1개. verifier 후보/담당자는 구현자와 달라야 하고 모든 구현 작업에 의존하며 쓰기 scope를 가지지 않는다.
- planner/model-producer, 후보 fallback 목록, 여러 구현 후보, 전역 pin과 task pin 혼용은 미지원이다. 임의 후보 선택/모델 편집기가 아니라 **현재 보호된 실행 설정의 고정 조합을 기준선으로 선택**하는 경로다.
- 선언/읽기/관측 결과 변환 시 원래 plan·policy·envelope·후보를 대조한다. 다른 후보의 attempt나 replan revision이 생긴 실행은 원래 고정 기준선으로 인정하지 않는다. 원래 후보/계획 내 retry는 기존 비용·실패·정리 조건을 따른다.
- candidate revision `fixed-task-plan-v1`과 digest는 선택 계획을 식별한다. 모델 버전/설치 바이트/계정/공급자 자격을 측정한 값이 아니다.
- `planDigest` 없는 기존 계약은 그대로 전역 pinned candidate를 요구한다. 새로운 변형을 암묵적으로 추정하지 않는다. 기존 저장 선언의 canonical bytes도 바꾸지 않는다.

## 권한 및 구현 경계

`cue:evaluation {operation:'baseline', ...}`에는 ID·dataset/case·사용자 참조만 허용한다. run ID는 IPC가 추적하는 현재 준비 실행에서, 시각/정책/후보/plan digest/확인 참조는 Core/호스트가 생성한다. renderer가 `confirmed`, `authorityRef`, policy/candidate, 시각, callback을 전달하면 거부한다.

`requestManualEvaluationBaseline(input, confirm)`의 `confirm`은 **신뢰한 호스트 전용 callback**이다. 제품은 `app/main.mjs`의 Electron `dialog.showMessageBox`에 연결한다. 라이브러리 호출자가 주입한 `async()=>true`는 테스트/호스트 권한 주입일 뿐 실제 사용자가 확인했다는 증거가 아니다.

입력을 동결하고 실제 eligibility preflight 후에만 창을 연다. 확인 뒤 유효 시간·현재 scope를 재검사하고 IMMEDIATE SQLite 잠금 아래 원래 preflight를 다시 수행한다. 같은 원장에 진행 중 확인은 하나뿐이다. 동일 선언의 재요청은 저장된 확인을 재사용하지만 내용이 달라지면 거부한다. 확인은 메모리에서만 일회성으로 소비되고 재시작 시 진행 중 창의 권한을 재생하지 않는다.

[검증 기록](../../evidence/integrations/S5/20260922-fixed-plan-baseline/RESULTS.md):38파일257pass/build0. JSDOM→직렬화 IPC→Core→SQLite와 기존 native 호스트가 생성한 실제 계획을 사용하지만 공급자·native 확인 응답은 fixture다. 새 Electron 화면 실행/실제 사용자 인수/독립 검토는 하지 않았다. 생산 측정 입력·품질/시간/비용 producer와 fact→trial 변환은 별도 구현 작업으로 남는다.
