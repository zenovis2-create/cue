# S7 실제 브라우저·화면 확인

`node scripts/reuse/report-electron-proof.mjs` → exit 0, 첫 시도 통과. Electron 44.2.0 새 숨김 BrowserWindow, sandbox/contextIsolation 켜짐, Node integration 및 preload 없음. 실제 HTML을 파일에서 읽었으며 원본 해시는 실행 전후 동일하다.

- 관측/계획 구분 안내, 소스 선언 미검증, 역사적 인수와 현재 파일 검증의 구분이 실제 DOM에 있다. 세 행 모두 `unverified` / `source-declared-unverified`다. 이 파일은 소스 선언 보고서여서 실제 원장 관측 행의 렌더링은 이번 증거에 없다.
- 외부 요청은 0건이다. webRequest에서 허용한 것은 이 보고서의 file mainFrame 1건뿐이다. 추가 요청은 차단·기록하도록 설정했으며 시도 자체가 없었다.
- 원본 CSP 아래에 inline script DOM 요소를 삽입했으나 실행되지 않았다. 실제 `script-src-elem` / `inline` 위반 이벤트를 확인했다. 하네스의 executeJavaScript 접근이 CSP로 차단된다는 주장은 아니다.
- 기본 화면과 좁은 창(실제 innerWidth 787)에서 가로 넘침이 없다. CSS hash 정책 아래 system-ui 스타일이 적용됐다.
- `electron-report.png`를 직접 열어 제목·경고·표·관계·펼친 근거 JSON의 가독성을 확인했다. 모든 소스 해시가 보이고 표가 겹치거나 잘리지 않는다.

입력 HTML SHA-256: `d6cc1e3615296df8fbdde96356ce68c3c174ffa7868329d47080f13dd4a9722e`.
PNG SHA-256: `b063a6bd936ae8da4122fdbec211df0f8a1ed31870ba840751c0d96a167a1fcf`.
proof SHA-256: `e4c1215e7b0492e3fa3d9e17356da6f0e823120fee3006c2e8ac9ed96bad638d`.

범위는 이 HTML의 독립 브라우저·시각 QA다. upstream deliver 통과, 일반 보고서 의미 정확성, 원장 실측, 모델 호출·자격·인수 성공을 증명하지 않는다. 제품 코드와 원본 보고서는 수정하지 않았다.
