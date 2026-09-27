# Local JSON 설정 원자 저장 — 구현 증거

- 완료 기준: `npm run build` exit 0; 기존 설정 8개 및 새 원자 저장 6개 테스트 통과. 독립 검토는 별도이다.
- 수정 가설 상한: 2. 이번 단위에서는 확인된 실패/수정 가설 없이 통과했다. 컨텍스트 전환으로 첫 명령 결과가 보이지 않아 결과 확인을 위해 같은 비변경 검증을 한 번 재실행했다.
- 각 검증: 아래 빌드와 두 집중 테스트. 실제 모델 호출 0, 실제 사용자 설정 DB 쓰기 0.

## 계약

`configureLocalJsonSettings(db, { expectedRevision, enabled, limits, createdAt })`는 보호된 호스트 설정 API이다. 고정 설정 ID `generated-json-default`, 생성기 `cue.local.qwen38-27b-unc`, 검사기 `cue.checker.json-format`을 내보낸 상수로 정의한다. 후보 ID/정책을 외부 입력으로 받지 않는다.

하나의 SQLite IMMEDIATE 트랜잭션에서 설정 CAS를 먼저 검사하고, 네 모드의 `cue.local-json.${mode}.v1` 정책과 V2 설정을 저장한다. sourceVersion은 `cue-local-json-setup-v1`이다. 호출 수 2..1000, 제한 시간 1000..120000ms, 출력 1..1048576 bytes, 출력 토큰 1..32768을 허용한다. 재호출은 정확한 최신 expectedRevision을 요구하며 승인된 과거 정책/설정은 유지한다.

기존 공개 `saveLocalHostSettings`의 외부 트랜잭션 거부와 정규 직렬화/해시를 유지하고 내부 행 저장 함수를 공유한다. enabled는 설정 의도이며 자격 증거, 실행 권한, 자동 탐색, 호출 실행을 부여하지 않는다. core/UI/main 연결은 이 단위 범위 밖이다.

## 검증

2026-09-11 21:53:23 KST:

```text
npm run build
exit 0
npx vitest run test/integration-local-json-setup.test.ts test/integration-local-host-settings.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
2 files, 14 passed, exit 0 (1.10s)
```

실제 임시 SQLite로 네 정책/설정의 원자 생성, 세 번째 정책 및 최종 설정 INSERT 실패 시 전체 롤백, 별도 DB 연결의 CAS 충돌, 재개방/과거 리비전 보존, 잘못된 입력/접근자/프록시/외부 트랜잭션의 무변경 거부를 확인했다. task/run/session/evidence/attempt/count budget/monetary policy/monetary budget 생성이 없음을 검사했다.

## 소스 SHA-256

| 파일 | SHA-256 |
|---|---|
| daemon/src/selection/local-host-settings.ts | 94466A3C36A408F2D0B519AB54F4D1FDF39414AA1EC6DD1E944E1947ED47D3FE |
| daemon/test/integration-local-json-setup.test.ts | 29A71ED4693B00A77D19F46F152B18CBAA7A081CA24A64A0DB576D45809A467F |
