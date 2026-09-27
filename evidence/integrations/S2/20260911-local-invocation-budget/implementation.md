# 비금전적 실행 횟수 원장 foundation

승인된 run의 committed dispatch intent만 센다. `initialize({runId,limit,policyRevision,source,observedAtMs})`, `reserve({runId,requestId,attemptId,taskId,candidateId,kind,observedAtMs})`, `summary(runId)` API를 제공한다. Kind는 model-producer 역할의 producer 또는 verifier 역할의 checker다. 실제 run/attempt/candidate/plan/envelope/policy revision을 검사한다. Canonical versioned digest와 immutable SQL을 사용한다.

`reserve`는 외부 transaction을 필수로 요구한다. 실제 claim과 같은 transaction에서 호출하는 연결은 다음 engine 작업의 책임이다. 이 단위가 app/engine에 자동 연결된 것은 아니다. 초기화 시 run은 존재해야 하며 승인 출처와 상한은 trusted host 입력이다. 1..100000 제한은 초기 구현의 입력 크기 제한이다.

Count는 immutable reservation 행에서 파생하며 가변 counter를 중복 저장하지 않는다. 같은 request/attempt/payload replay는 추가 소비가 없고, 충돌은 거절한다. 실패 실행 및 dispatch 전 crash도 committed row가 있으면 계속 소비한다. Retry의 새 attempt는 새 1회를 소비한다. Provider 실제 요청 수, 품질, 시간, 금전, cleanup, acceptance 또는 환불을 추론하지 않는다.

Migration 021의 additive INSERT trigger로 기존 금전 원장과 양방향 동시 초기화를 거절한다. 기존 monetary columns/payload/digest/API는 변경하지 않았다. 이 단위에서 migration 자동 등록은 부모 담당이다. Fixture는 현재 openLedger 후 021을 명시 적용한다.

Gate: `npm run build` exit 0, `npx tsc --noEmit -p tsconfig.json` exit 0, `npx vitest run test/integration-local-invocation-budget.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` 7/7 PASS (1.16s). 실제 SQLite/서로 다른 worker DB connection으로 1-slot 경쟁에서 하나만 commit, 나머지 claim rollback 확인. 외부 rollback, 재개, failed/retry history, exact replay, 종류/계보 충돌, SQL update/delete/REPLACE, accessor/prototype/unsafe count 및 hash tamper 거절 포함.

진단 상한 2회. 첫 타입 검사에서 never-return arrow helper가 제어흐름 narrowing에 사용되지 않아 오류가 발생했고 explicit function declaration으로 수정한 후 gate 통과(가설 1회). 독립 maker/checker 분리: 최종 source hashes와 판정은 별도 review artifact에 기록한다. 모델 호출 0회.
