# 로컬 횟수 UI 독립 QA — 현재 상태

최종: 독립 테스트 **14 PASS**, 실제 core 준비 및 Electron 횟수/미확인/금전 분기 **범위 한정 PASS**. 제품 수정과 모델 호출 없음. 아래 두 초기 fixture 실패는 역사적 기록으로 유지한다.

- `npx vitest run test/integration-local-observation.test.ts test/integration-approval.test.ts test/integration-observation-core.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`: 실제 일치 파일 2개, **5 PASS**. `integration-approval.test.ts`는 존재하지 않아서 이 결과에 포함되지 않았다.
- 정확한 승인 파일을 별도로 `npx vitest run test/integration-approval-plan.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`: **9 PASS**.
- 첫 Electron 실행: 시험용 host의 필수 `engine.maxRequestAgeMs` 누락으로 생성 거부. `electron-failure-attempt1.json` 보존.
- host에 1000ms를 명시한 둘째 실행: 실제 core 준비에서 정책 불일치 거부. fixture 정책은 value이고 core가 보관된 기본 efficiency를 선택했다. `electron-failure.json` 기록.

두 번의 시도 상한에 도달해 부모에게 인계했다. 부모가 진단된 최소 fixture 교정인 실제 `prepareGoal(goal, 3, 'value')`와 세 번째 준비 시도를 명시적으로 승인했다. 두 실패 모두 보호 장치가 부정확한 fixture를 거부한 것이며 제품 결함으로 분류하지 않는다.

## 최종 실제 검증

`node scripts/reuse/local-count-ui-electron-proof.mjs --explicit-policy-fixture` exit0, tool1da79f. 보호된 main-process fixture의 local host는 candidate catalog를 unavailable로 반환하고 claim/runtime/stage 실행을 거부한다. fake qualification을 만들지 않는다. 실제 createCueCore → driver → local policy/count store 준비 후 immutable summary와 persisted projection을 shipped renderer에 QA 입력했다. production preload/IPC, 실제 모델 서버, 승인 실행은 이번 범위가 아니다.

- 실제 core threeLines: 실행 지시 상한2회, 제한시간10000ms, 고정조합, 금전비용미측정. undefined/USD/micro/예산상한 없음. summary에 currency/unit/limitUnits 속성 없음.
- 실제 화면 승인: 가성비 모드, 정책, 실행지시상한2회, 고정조합(모드별 성능 차이 미검증), 금전비용미측정, 2단계.
- 실제 원장 projection: 실행지시0/2회, 잔여2회, 시작실패포함, 공급자 요청수와 금전비용 미측정. 인수는 미확인 유지.
- 합성 unknown 분기: `실행 지시 횟수 미확인 · 금전 비용 미측정`.
- 합성 기존 money 분기: 승인 `예산 100 (TEST/micro)`, 관측 `예약 기준 잔여 80 · 초과 0 (TEST/micro) · 확정 비용 20`. localAccounting 없는 분기만 사용. 실제 비용 실측이 아니다.
- legacy orchestration null은 패널 숨김 유지. launch callback0, session_handle0. renderer process undefined, 내부1487px에서 가로넘침 없음.

`local-count-approval.png`와 `local-count-observation.png`를 실제로 열어 확인했다. warm capture 뒤 최종 캡처한 숨김 Electron 화면이며 승인·관측 문구가 읽힌다. 두 PNG는 해당 배치에서 같은 프레임이다. 합성 card에 기존 진행률 필드를 제공하지 않아 **상태 제목 아래 별개 stage 줄에는 `undefined · QA 합성 관측`이 보인다**. 이 fixture 외관 결함을 숨기거나 새 횟수 분기의 결함으로 분류하지 않는다. 검토 대상인 실제 core 승인 문구·count 승인·count 관측에는 undefined가 없다. 화면의 초기 봉투와 비활성 승인 버튼도 QA 직접 렌더링 범위이며 실제 IPC 승인 흐름 PASS를 의미하지 않는다.

소스/PNG SHA256와 실제 DTO·각 분기의 정확한 문자열은 `electron-result.json`에 기록했다. native/user folder dialog, 로컬 모델 실측 성능, 금전 비용, 모델 요청 횟수, 성공/인수 증거는 발행하지 않는다. 제품 메이커와 독립된 검토이며 count 단위와 기존 금전 분기 보존에 한정한다.
