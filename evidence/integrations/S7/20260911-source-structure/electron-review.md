# S7 소스 구조 목록 — 실제 브라우저 QA

`node scripts/reuse/source-structure-electron-proof.mjs` → exit 0, 첫 시도 통과. 기존 제품 `openReportWindow`를 사용하고 실제 BrowserWindow의 show만 억제했다. 원본 HTML을 검증한 정확한 바이트의 data URL로 열었으며 실행 전후 파일 해시는 동일하다.

- 실제 DOM: 파일 104행, 관계 212항목. 모든 행과 관계는 미검증 소스 선언 표시를 유지한다.
- mainFrame의 정확한 data bootstrap 1건만 관측됐다. 외부 요청 0건이다.
- javascript=false, nodeIntegration=false, contextIsolation=true, sandbox=true, preload 없음. CDP의 독립 DOM 관측에서 process와 cue는 undefined다.
- 기본 innerWidth 1087과 좁은 innerWidth 787 모두 가로 넘침이 없다. 원본 HTML은 62,499바이트다.
- `electron-source-overview.png`, `electron-source-relations.png`를 직접 열었다. 경고·기준 revision·IR 지문은 읽힌다. 표의 좁은 상태 열에서 unverified 단어가 두 줄로 나뉘며, 관계는 긴 경로들의 단순 글머리 목록이다.

**읽기 쉬운 아키텍처 다이어그램으로는 부족하다.** 전체 높이는 13,287 CSS px이고, 104개 파일 표와 212개 관계 목록을 길게 스크롤해야 한다. 모듈별 그룹·계층·의존 방향을 배치한 그림은 없으며 SVG/canvas도 0개다. 현재 결과는 근거가 붙은 정적 import 목록 기반이지, 전체 구조를 빠르게 이해할 수 있는 다이어그램 완료 증거가 아니다. 이번 QA에서는 제품 코드를 바꾸지 않았다.

입력 SHA-256: `0496128e8d90ad161caa1d5595dbce0d15e4ea9d74da3fcf0fbeb0bcb439aa67`.
개요 PNG: `331317ec288559857a569dcb8541fd799d282eb016abbf04a3a9d348a747e16a`.
관계 PNG: `0ad3d177dbc345bc51547676f54f41c3a1c31cddce53f16f90be05a633cc99a1`.

창·자식 프로세스를 종료하고 검증한 소유 임시 폴더만 삭제했다. 모델·AppContainer·프로필 조작은 없다. 브라우저 표시와 격리 경계의 이 표본 검증이며, upstream deliver나 실행 의미·안전성·성능 검증을 대신하지 않는다.
