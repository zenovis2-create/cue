# 실제 Electron 관측 패널 QA

2026-09-11 · 독립 QA: reuse_transport · 결과: **PASS (합성 원장 fixture의 실제 renderer 표시)**

명령: `node scripts/reuse/observation-electron-proof.mjs` · 최종 exit 0 · Electron 44.2.0 / Chromium 152.0.7977.76.

Node에서 실제 in-memory SQLite ledger 및 `readOrchestrationSnapshot`으로 DTO를 생성했다. SQLite ABI를 Electron에서 재사용하지 않고 JSON fixture만 전달했다. 새 `BrowserWindow(show:false)`에서 실제 `app/renderer/index.html`과 JS/CSS를 로드했으며 Node integration 비활성, context isolation·sandbox 활성 상태를 유지했다. 사용자에게 보이는 창·유료 호출·실제 에이전트 실행은 없다.

자동 assert:

- orchestration 없는 기존 카드에서 새 패널 hidden.
- 고정 정책 가성비 모드/r1 표시.
- 구현 실행 중·검증 대기 두 단계 표시.
- 인수 검증 및 최종 비용 미확인 표시.
- running 카드에서 실행 중단 버튼 표시/활성.
- 비공개 ledger payload 문자열 미노출, renderer의 process/require 미노출, 실제 창 숨김 유지.

`electron-observation.png`를 view_image로 직접 검사했다. 정책·단계·최근 활동·미확인 상태·붉은 중단 버튼이 한 화면에 들어오며 글자 겹침이나 잘림은 보이지 않는다. 기록된 UI 캡처는 합성 fixture임을 화면 자체에 표시한다.

실행 이력: 첫 proof launcher는 ESM 최상위 `await app.whenReady()`로 준비가 막혀 55초 내부 deadline에서 exit124. 수정 1회로 Electron 비동기 시작을 모듈 평가와 분리했다. 이후 실제 자식 PID 61240은 exit0으로 종료했다. 외부 60초 deadline와 owned process-tree cleanup도 스크립트에 있다. UI 소스 수정은 하지 않았다.

파일/fixture/PNG SHA256은 `electron-result.json`, 종료 PID/code는 `electron-process.json`, 입력은 `electron-fixture.json`에 보존한다. 최종 PNG hash는 `7e8641fc7647d8caeaeb71f7895faea98212ba24550ffc195b9db2dfcaae94f4`다.

한계: DTO를 실제 renderer의 renderCard에 주입한 표시 검사다. production IPC 연결, 실제 작업 지휘, 버튼 클릭 뒤 실행 정지, 최종 인수 검증, 비용의 실물 정확성을 증명하지 않는다. completed 제목 구분은 이 running 화면 캡처의 범위 밖이며 별도 maker 회귀에 있다.
