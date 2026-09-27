# 실제 실행 정리 기록 실패 — 읽기 전용 분석

실제 호출 추가 0, 코드/빌드/원본 원장 변경 0. 현재 분석은 실제 native cleanup을 PASS로 판정하지 않는다.

## 확인한 데이터

- 새 원장: D:/Temp/User/Cue.ElectronGate.IyTVWW/data/cue-ledger.sqlite, node:sqlite readOnly 조회.
- 생산 시도: attempt-76fd81197c24eb0340dead193cdc459044e95f09f28b47d9.
- candidate_id: `cue.local.qwen38-27b-unc`, 상태 running, cleanup_verified 0.
- 생성물: 42바이트, SHA-256 `7b8d013d7fbae03576cf41a22662292c69cd7d2be94f6839b284fe2b9090c50b`, 같은 candidateId.
- 해당 시도의 cleanup_observation 0, orchestration_receipt 0, acceptance_final 0.
- 전체 정리 관찰 16개는 qualification-model 6개, qualification-json-checker 10개다. workflow 기록이 아니다.
- 부모 task: blocked / orchestration_timeout.

## 직접 재현한 계약 결함

cleanup-observation-store.ts의 공통 id 검증은 `[a-zA-Z0-9:_-]{1,128}`만 허용하고 metadata()가 candidateId에도 적용한다. 실제 기본 후보 ID의 점을 거부한다. 카탈로그는 `[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}`, 로컬 정책은 동일 문자 집합의 128자 제한을 사용한다.

컴파일된 실제 createCleanupObservationStore에 inTransaction=false와 transaction 진입 시 예외를 내는 읽기 전용 sentinel 객체를 전달했다. observation의 나머지 필드는 유효한 unknown 관찰 형태다.

| candidateId | 결과 | transaction 진입 |
|---|---|---|
| cue.local.qwen38-27b-unc | cleanup_observation_identity | false |
| fixture-model | READONLY_REPRO_TRANSACTION_SENTINEL | true |

따라서 이 결함은 OS 정리 성공·실패와 무관하게 실제 후보의 관찰 저장을 차단한다. 실제 원장이나 별도 원장에 쓰지 않았다.

## 완료 연결 분석

generated-model-output.ts는 native result와 completion을 Promise.all로 기다린 뒤 생성물 관찰을 저장한다. 실제 생성물이 저장되어 있으므로 native completion이 영원히 pending이라는 가설은 현재 데이터와 맞지 않는다.

정리 관찰 persist의 검증 예외는 generated-json-host.verifyCleanup의 clean.set 이전에 발생한다. integration-runtime.inspectCleanup은 예외를 unknown으로 바꾼다. generated-json-host.engine.receipts는 clean 항목이 없으면 execution:null을 반환한다. engine.reconcile은 finish를 실행하지 못하고 생산 단계는 running을 유지한다. driver는 이후 deadline에 부모를 blocked로 변경한다. 원장의 완료·정리 미확인 때문에 종료 보호가 정상 종료를 거부하는 흐름과 부합한다.

실제 프로세스의 호출 스택/삼켜진 예외 로그는 없으므로 유일한 원인이라고 단정하지 않는다. 그러나 실제 데이터로 반드시 발생하는 저장 계약 오류를 직접 재현했고, observed running/receipt0와 연결되는 충분한 경로를 확인했다. 이전 Node canary의 짧은 guardian residual과 같은 원인이라고 추정하지 않는다.

## fixture 누락과 최소 교정 제안

기존 cleanup store와 local host 통합 fixture는 fixture-model/fixture-checker를 사용했다. 기본 설정의 실제 dotted candidate ID를 같은 저장 경로에 전달하는 검사가 없었다.

1. candidateId 전용 검증을 카탈로그의 허용 문자·길이 계약과 맞춘다. run/session/task ID를 무차별 확장하지 않고 기존 canonical encoding/내용 hash/영속성/자격 판단을 보존한다.
2. 실제 설정 상수의 생산·검사 ID를 사용하는 저장소 재개방·정확 재전송 검사를 추가한다. 메타데이터가 unknown이어도 저장되고 내용이 바뀌면 새 hash가 생성되는지 확인한다.
3. 기존 local host 오프라인 통합 fixture를 실제 설정 ID로 구성하여 생산 capture→durable cleanup→receipt→checker→acceptance까지 진행되는지 확인한다. 정리 관찰을 callback 상수로 대신 성공시키지 않는다. 필요하면 기존 실제 native wrapper+고정 transport fixture를 사용하되 모델 호출은 0으로 유지한다.
4. 저장 오류/미확인 정리를 성공으로 승격하지 않고 기존 fail-closed 경로를 유지한다. 이번 실패 기록을 수정하거나 모델 호출을 재시도하지 않는다.

## 분석 대상 소스 SHA-256

- cleanup-observation-store.ts: E995688B4228BF633AC944763D785DEA19C31ED9F3D03376E44191C939E34D69
- integration-runtime.ts: 27331A2FA59209943371D5F0707AFB5C8875D06DF755204101A9D58845227590
- generated-json-host.mjs: 8A7EA3E9DC23C6DD2A64BBF51A1D08083AA292C5D5DBBA4AFA19C00C1796B080
- generated-model-output.ts: DE7D100074227B6E5D7CC23109C85EE0D2E8092606F198521F11C4DEEEABC80C
- integration-generated-json-local-host.test.ts: 9EEEB2D0669B80F5E9DB9C115527DBF1BAC7B576E2FE3CCED0960E0521C4D77E
