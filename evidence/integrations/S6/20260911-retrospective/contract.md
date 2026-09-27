# 원장 기반 로컬 회고 초안 — 구현 계약

완료 기준: `npm run build` exit 0, 신규 실제 SQLite 집중 테스트 통과, 독립 검토. 수정 가설 상한 2이며 실패하면 새 가설을 기록한다. 매 pass 빌드와 해당 집중 테스트를 실행한다. 범위를 벗어나면 부모에게 구체적으로 보고한다.

S6 명세의 회고 초안은 참고 데이터이며 실행·검증·승인 권한이 아니다. `createRetrospectiveStore(db)`의 `create({draftId,runId})`가 고정 허용 컬럼만 읽어 결정적으로 요약하고, `read(draftId)`가 불변 역사 기록을 재검증한다. 동일 draftId/runId 재생은 원래 기록을 반환하며 다른 run은 충돌 거부한다.

task/run/attempt/recovery의 제한된 식별자·상태·정리 플래그만 소스로 사용한다. 각 소스의 table/id와 안전한 컬럼 투영 바이트 SHA-256을 묶는다. 이는 원본 artifact 전체 바이트 해시라고 주장하지 않는다. artifact.content, verification.evidence, 원시 대화, 인증, 환경, 자유형 failure reason은 읽지 않는다. source snapshot과 고정 요약만 023에 저장하고 UPDATE/DELETE/REPLACE를 거부한다.

읽기는 저장된 snapshot/해시/요약의 무결성을 확인한다. 실행 상태가 이후 바뀌어도 과거 회고는 그대로 읽힌다. 새 draftId로만 새 관측을 만들 수 있다. 완료 여부는 원장 상태 관측으로 표시하며 acceptance는 항상 `not-assessed`이다. 외부 공유 함수/네트워크/모델 호출은 없다.

검증: 재생/충돌, rollback, 실제 DB reopen, SQL 불변성/REPLACE, 변조 거부, 종료 후 원장 변화에도 역사 보존, 비밀 sentinel 미포함, 어떤 실행·승인·증거 행도 생성하지 않음. 임시 테스트 원장 외 사용자 DB 쓰기와 실제 모델 호출은 0이다.

## 구현과 maker 검증

구현은 `task/run/orchestration_attempt/recovery_attempt_v2`의 안전한 컬럼만 사용한다. `recoveryRecords`는 V2 recovery 행 수이며 이전 legacy recovery 테이블이나 실행 성공을 추론하지 않는다. 각 배열 최대 1024행, 저장 payload 최대 1MiB이다. API는 `createRetrospectiveStore(db).create({draftId,runId})` / `.read(draftId)`이며 공개 공유/모델/승인 API는 없다. 부모가 기존 ledger/copy-assets 흐름에 023을 등록했으며 테스트는 실제 openLedger 자동 migration과 재개방을 사용한다.

```text
cwd: C:/Users/User/cue/daemon
npm run build
exit 0
npx vitest run test/integration-retrospective.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
2026-09-11 22:31:47 KST: 1 file / 5 PASS / exit 0 / 688ms
```

운영 명령 오류 보존: 첫 `npm run build`가 실수로 저장소 root에서 실행되어 `Missing script: build`로 실패했다. 제품/테스트 변경 없이 올바른 daemon cwd에서 실행하여 통과했다. 기능 수정 가설 0/2, 실제 모델 호출 0. 독립 리뷰는 별도이다.

| 파일 | SHA-256 |
|---|---|
| daemon/src/resources/retrospective.ts | D2E26F27FF0DD6EA73F463C1DA4BF11A3D6021C2D7B3961A4932B5F4ABA405CE |
| daemon/migrations/023_retrospective.sql | 92341CFBE2D1F2CF059D19C9F17C2CD1DDC4F64F1D2D2C8D0B74347BCBB87BE5 |
| daemon/test/integration-retrospective.test.ts | AE0495B1C7AA6090FB660BB3F579121F06AAD76F8837A2E49B37C518A1B5E427 |
