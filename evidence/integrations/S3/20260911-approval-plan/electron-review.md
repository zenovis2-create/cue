# 승인 전 계획 화면 실제 Electron QA

2026-09-11 · 독립 QA reuse_transport · **PASS (fixture 표시·준비 흐름 범위)**

명령 `node scripts/reuse/approval-electron-proof.mjs`, 첫 시도 exit 0. Electron 44.2.0의 새 숨김 BrowserWindow에 실제 renderer HTML/JS/CSS를 로드했다. nodeIntegration=false, contextIsolation=true, sandbox=true, show=false와 60초 외부 deadline/owned cleanup을 적용했다.

`window.cue.prepare`를 명시적인 합성 응답으로 대체하고 실제 goal form submit 이벤트를 보냈다. 결과:

- prepare 호출 1회 이후 계획 details가 열린 상태로 표시되고 승인 버튼이 활성화됨.
- 가성비 모드·정책·예산과 구현/검증 역할, 선행 impl, req1 요구사항, workspace 범위, 각각의 후보가 표시됨.
- legacy 준비 응답은 기존 계획을 숨기고 단계 항목을 제거함.
- 새 계획 표시 후 prepare failure는 summary/단계를 지우고 승인 버튼을 비활성화함.
- 이전 SQLite 기반 observation fixture를 같은 renderer에 표시해 관측 패널·인수 미확인·중단 버튼이 유지되는 회귀 검사 통과.
- renderer의 Node process/require 미노출과 창 비표시를 assert함.

`electron-approval-plan.png`를 view_image로 직접 검사했다. 중앙 계획 카드가 읽을 수 있게 표시되고 두 단계의 역할/선행 관계/범위/후보에 겹침이나 잘림이 없다. 전체 페이지는 세로 스크롤이 있으며 승인 버튼은 화면 하단에 위치한다. 긴 지문은 줄바꿈되고 fixture임을 목표/단계 후보에 표시한다.

스크린샷 SHA256 `875c62a3bcd15950da4bf41d59cd846536669051dcde89bcd77f526896dc58cc`. renderer/source/fixture hash는 `electron-result.json`, 실제 자식 PID/exit는 `electron-process.json`, 입력은 `electron-fixture.json`에 있다.

범위 제한: prepare API stub을 사용한 실제 renderer 표시/폼 처리 검사다. production IPC/preload, 실제 plan 생성·승인·후보 선택·도구 실행·정지 완료를 검증한 것이 아니다. 유료 호출·보이는 창·사용자 설정 변경 없음.
