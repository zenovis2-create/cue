# S7 앱 보고서 실제 Electron 흐름

`node scripts/reuse/report-app-electron-proof.mjs` → exit 0. 실제 `createCueCore`/AppDaemon과 임시 SQLite를 Electron main에서 초기화했다. `prepareGoal`/`approve` 후 합성 계획과 실패 시도 기록을 넣고, 실제 core의 card를 renderer에 표시했다. 모델 호출은 없다.

실제 `app/preload.cjs` → `registerIpcHandlers` → `core.exportRunReport` → `openReportWindow` 경로를 보고서 버튼 클릭으로 통과했다. 등록한 신뢰 조건은 main webContents와 mainFrame 모두의 일치다. 다른 실제 창의 같은 preload 호출은 `sender denied`로 거부됐다. subframe에서 직접 IPC를 발신하는 별도 실험은 이번 스크립트에 포함하지 않는다.

독립 검토에서 원본 파일 재읽기 경합이 수정된 뒤 실행했다. 보고서 창 URL은 파일 URL이 아니라 검증한 바이트의 `data:text/html;base64` URL과 정확히 일치했다. 기록된 요청은 해당 mainFrame 1건, 외부 요청 0건이다. 원래 제품 report-window는 그대로 사용했고 실제 BrowserWindow 하위 클래스의 `show()`만 억제해 창이 사용자 화면에 나타나지 않도록 했다.

보고서의 실제 webPreferences: javascript=false, nodeIntegration=false, contextIsolation=true, sandbox=true, preload 없음. renderer의 `cue`와 `process`도 undefined다. JS-disabled 창의 DOM은 하네스 CDP Runtime.evaluate로 읽었다. 이것이 제품 페이지의 JavaScript 실행을 허용한다는 뜻은 아니다. 첫 시도의 일반 executeJavaScript 검사 오류는 `electron-failure.json`에 보존했고, CDP 검사로 수정했다.

`electron-app-report.png`를 직접 열어 확인했다. maker의 failed/observed, review의 pending/observed, maker→review의 planned 관계가 선명하게 구분된다. 가로 넘침은 없고 보고서 기준·IR digest가 보인다. 원장에 실패를 기록한 fixture의 표시 증거이며 실제 작업 실행·인수 통과 증거가 아니다.

최종 HTML SHA-256: `d05f27d6fa1564244117b5db2fb4e017097bd257cfd271440cdfe2d49fa206b3`.
PNG SHA-256: `e8b5308e51d4c97cfb2f10d18699c1730f9c37cb6d2a4942e053de30795660df`.
report-window SHA-256: `b79f071df4d0802a4b01babf38f5ccfa88a531b2bab772911a29574db1fa1789`.

모든 소유 창과 core DB를 닫았고, 부모 프로세스가 종료된 자식을 정리한 뒤 검증한 임시 루트만 삭제했다. 원본 보고서 복사본과 소스 지문은 evidence에 보존했다. upstream deliver 검증이나 보고서 전체 의미 정확성을 주장하지 않는다.
