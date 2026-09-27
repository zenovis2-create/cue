# 로컬 환경·검사 척도 생산자

2026-09-22 / batch97.

기본 앱이 신뢰 가능한 로컬 관측으로 **측정 계약 일부**를 만들 수 있도록 연결했다. 사용자 JSON을 `host-observed`로 다시 포장하거나 가짜 `measuredFactHost`를 주입하지 않는다. 실제 실행 입력·품질 점수·전체 경과·계정·가격·최종 비용 생산자는 아직 별도 작업이다.

## 사용

```ts
const saved = core.captureLocalEvaluationContracts(); // 인자 없음
saved.metric;       // 0..1 검사 척도 계약, 실제 점수 아님
saved.environment;  // complete:false
saved.trialReady;   // false
```

앱의 `평가 코호트 기록 → 로컬 환경·검사 척도 계약`에서 **로컬 환경·검사 척도 기록**을 누른다. `cue:evaluation`은 `{operation:'local-contract-capture'}`만 받는다. 정의·시각·runId·complete/확인 권한 등 추가 필드는 거부한다.

화면은 불완전 상태와 지표/환경 ID·revision·digest·기록 시각만 보여준다. 실행이 준비되어 있고 등록 폼이 잠기지 않았을 때 **등록 폼에 지표·환경 참조만 복사**할 수 있다. 복사는 두 참조만 명시적으로 덮어쓰며 계정 한도를 채우거나 등록/승인/실행하지 않는다. 새 실행/승인/Stop 뒤 늦게 돌아온 응답은 버린다. 이미 저장된 불변 계약 자체를 삭제하는 동작은 아니다.

## 직접 관측하는 것

- Node `os.type/release/platform/arch` 및 프로세스 아키텍처, Node/V8 버전. Electron/Chrome 버전은 해당 프로세스가 제공할 때만 기록하고 없으면 null이다. `os.arch()`는 Node 바이너리의 빌드 아키텍처이며 별도로 검증한 커널/물리 CPU 아키텍처가 아니다.
- 고정된 생산자 모듈과 native existing-file checker 모듈의 **디스크 파일 바이트 SHA-256**. 임의 입력 경로는 받지 않는다. 파일당256KiB 제한, regular-file/단일 링크, FD 전후 identity/크기/mtime/ctime 확인과 EOF 검사로 읽는 동안 발견된 변경을 거부한다.
- 코드 관측은 `regular-file-bytes-not-loaded-memory`다. 이미 로드된 실행 메모리, 전체 의존성, 공급자 설치 바이너리, Windows snapshot helper의 실행 자격을 증명하지 않는다. source TS와 packaged JS는 다른 코드 identity를 가지며 동일하게 취급하지 않는다.
- host/user 이름·홈 경로·환경변수·자격증명·프로필 파일·작업 파일은 읽거나 저장하지 않는다. IPC 응답에는 raw OS/코드 관측 필드도 노출하지 않는다. 원장에는 위 제한된 로컬 필드가 저장된다.

## 계약 의미와 불변 재생

Metric ID는 `cue-exact-artifact-quality`이며0..1 척도다. 알고리즘 identity는 '모든 승인 artifact 바이트 일치' 규칙, native checker ID/revision 및 디스크 코드 digest를 결합한다. **검사 척도를 등록한 것뿐**이며 실제 checker 실행이나 pass/fail/품질 점수는 만들지 않는다. metric revision은 canonical 정의 digest라서 같은 정의를 다시 등록하면 최초 timestamp/source를 그대로 재사용한다.

Environment ID는 `cue-local-process-environment`, revision은 호스트가 매 명시적 관측마다 만드는 고유 capture ID다. 같은 필드가 관측되어도 새 환경 관측은 새 revision/시간으로 저장되며 과거 행을 갱신하지 않는다. 이전 환경과 같다고 해서 그것을 실행 당시 환경으로 사용하거나 최신 자격으로 승격하지 않는다.

환경은 항상 **complete:false / local-process-at-capture-only**이며 다음 누락을 명시한다:

- execution-input / execution-sandbox
- provider-installation / model-revision
- account-limits / price / resource-contention

따라서 현재 fact→trial 변환의 완전한 환경 조건을 만족하지 않는다. UI 연결을 평가 trial 준비 완료나 paired 비교 성과로 계산할 수 없다. `qualityMeasured:false`, `executedInputVerified:false`, `trialReady:false`, `promotionEligible:false`를 유지한다.

## 저장·실패 경계

기존 metric/environment registry를 사용하고 새 마이그레이션은 없다. 관측 데이터/시각은 producer가 직접 만들며 공급자/서비스/native 실행을 시작하지 않는다. wall clock 역행/유효하지 않은 시각, 코드 읽기 문제, 외부 DB transaction에서는 실패한다.

두 registry 각각의 불변 등록을 호출하므로 **묶음 원자성은 없다**. 환경 등록이 실패하면 앞서 저장한 metric은 남을 수 있다. 성공 응답을 반환하지 않고 UI에 부분 저장 가능성을 표시한다. 불변 행을 지우거나 자동 재시도하지 않는다. 재요청은 명시적 새 관측이며 동일 metric은 원래 행을 재사용한다.

기존 `runtime.measuredFactHost`의 계약/사실 등록 경로는 바꾸지 않았다. 로컬 capture는 그 host의 read/capture/증거 callback을 호출하지 않는다. 기본 앱에서 계정 한도/가격 등록이나 측정 fact 생성이 가능해진 것은 아니다.

## 검증

[기록](../../evidence/integrations/S5/20260922-local-contract-producer/RESULTS.md): build0,37파일326pass,실패/skip0. 신규10개는 실제 로컬 OS/코드 바이트 및 SQLite 등록/재열기, 부분 실패 보존, 엄격한 IPC와 JSDOM 직렬화 경로를 검사한다. 공급자 결과를 합성해 `host-observed`로 승격하지 않는다. 실제 Electron 창/사용자 인수·독립 검토·전체 회귀·실행 시점 측정은 별도다.
