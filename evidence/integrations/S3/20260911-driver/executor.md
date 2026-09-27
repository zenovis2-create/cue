# 실제 앱 오케스트레이션 드라이버 실행 기록

- 범위: `app/orchestration-driver.mjs`, `daemon/test/integration-driver.test.ts`. 부모 작업의 core 연결/타입은 별도 소유다.
- 완료 기준: daemon build + focused driver 테스트, 변경 파일 SHA-256, 독립 검토. 최초 구현 이후 수정 가설 최대 2회.
- 구성: 실제 SQLite policy binding, budget manager, orchestration store/engine, stage envelope binder, admission runtime을 한 드라이버에서 연결한다. 호스트가 카탈로그/측정/권한/영수증을 제공한다. 기본 qualified 프로필은 없다.
- 승인 전에 정책·계획·예산을 고정하고 JSON-safe DAG 요약을 반환한다. 활성화는 부모 writer lease를 잡지 않는다. 단계는 직렬 실행하며 같은 start Promise/attempt ID를 재사용한다.
- 모든 단계의 실행이 성공해도 root는 `acceptance_unverified`로 blocked다. 정리 불확실성은 lease와 예산을 유지하고 close를 거절한다. 재시도/병렬화/요구사항 최종 수락/앱 재시작 복구는 이 단위 범위 밖이다.
- 테스트의 live 형태 evidence bytes와 주입 adapter는 명시적인 테스트 fixture다. 실제 provider 검증·과금 호출·production qualification을 주장하지 않는다.

## 검사

1. 최초 `npm run build` (daemon): PASS.
2. 최초 focused: 3 PASS / 3 FAIL. fixture SQL에서 존재하지 않는 `run_id`를 조회해 launch가 예외로 끝남.
3. 수정 1: fixture가 실제 `stage_run_id`를 검증하도록 고침. 외부 트랜잭션 rollback 이후 캐시를 승인 권한으로 쓰지 않도록 영속 run/policy/plan/budget 재확인과 회귀 테스트 추가. 잘못된 ValidatedPlan 직접 필드 접근으로 focused 2 PASS / 5 FAIL. 같은 시점 build는 부모 core-test 타입 선언 미반영 3개 오류로 실패.
4. 수정 2: 정책 필드는 `plan.approval` 아래임을 반영. `npx vitest run test/integration-driver.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` (daemon): **7 PASS**, 2026-09-11 15:59:31. 승인 요약 불변성, 실제 make→check 순서, replay, prepare rollback, 외부 rollback 캐시 무효화, admission 거절, 불확실 cleanup, pending start 취소 및 late ownership을 검증한다.

## 현재 파일 SHA-256

- app/orchestration-driver.mjs: `1A75468C7698E07C9703901EB9C1EA93D0FCDE0E8961990CBD82FAA625FF5CF5`
- daemon/test/integration-driver.test.ts: `D002516927A5B464E9BCCC3B12803B4D0BC969C8B1824778BE2A97C608C8E970`

최종 build 및 독립 검토는 별도 결과로 연결한다. 현재 기록은 자체 실행 증거이며 독립 승인 선언이 아니다.
