# 실행 소유권 completion 투영 — 독립 검토

판정: **PASS (제한된 core 투영 단위)**. 검토자 `/root/reuse_pure`는 해당 제품/테스트를 수정하지 않았다. UI 연결과 실제 OS 정리 증명은 별도이다.

## 검토 결과

- `AppDaemon.hasUnsettledRun`은 실행 worker, 종료 대기 Promise, 정리 실패 quarantine을 합산한다. Stop 응답으로 worker가 종료 대기 맵으로 이동해도 `hostRetained`가 유지된다.
- completion은 하나의 읽기 트랜잭션 안에서 run의 write 플래그와 **전체** orchestration attempt의 `cleanup_verified=0` 수를 확인한다. 화면의 최근 50개 기록 제한을 소유권 판정에 재사용하지 않는다.
- run 기록 없음은 unknown, retained/write/unresolved 중 하나라도 있으면 unresolved, 모두 해제되어 기록상 미해결이 없을 때만 released이다. DTO와 outer card는 동결된다.
- task의 blocked/completed 문자열이나 Stop ACK 자체로 released를 계산하지 않는다. 신규 테스트는 미해결 과거 시도 1개와 최신 clean 기록 50개의 차이를 입증하며, 조회의 `total_changes()` 무변경도 검사한다.
- 기존 P12 소유권/terminal transaction 검증을 함께 실행했다. 실패 quarantine/리스 해제 실패의 기존 동작을 약화하는 변경은 발견하지 않았다.

추가 actionable finding 없음. `released`는 현재 호스트 맵과 기록된 원장 상태의 투영이다. 새로운 OS 관측이나 원격 provider 종료, acceptance를 증명하지 않는다. UI는 terminal 상태와 이 DTO를 함께 확인해야 하며 이 리뷰는 렌더러 구현을 승인하지 않는다.

## 독립 명령

```text
npx tsc --noEmit -p tsconfig.json
exit 0
npx vitest run test/integration-execution-ownership-core.test.ts test/integration-observation-core.test.ts test/p12-process-ownership.test.ts test/p12-terminal-transaction.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
2026-09-11 22:18:58 KST: 4 files / 12 PASS / exit 0 / 7.23s
```

실제 임시 SQLite, 제어된 fake runtime 완료 Promise, P12 소유 프로세스 fixture를 사용했다. 실제 모델 호출 0.

## 검토한 최종 SHA-256

| 파일 | SHA-256 |
|---|---|
| app/core.mjs | 74C3854250310EBE7106D64DDBA4CF51C427ADACD34147C0E9E43EC3CE24CBEB |
| app/core.d.mts | 7241C7CB93B96DF22965C492D5B1CF424B32C89DE83DD63BA193D5595BF51EA5 |
| daemon/test/integration-execution-ownership-core.test.ts | 543E63BD2FBE5F8FDF1C25EC3BC75EF515BB61AC3AE40D12E44E3E8F8FDF3F59 |
