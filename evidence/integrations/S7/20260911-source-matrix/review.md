# S7 소스 관계 행렬 — 독립 코드·실제 화면 검토

판정: **범위 한정 PASS**. 제품 작성자와 별도 검토자가 소스, 테스트, 실제 숨김 Electron 창을 검토했다. 제품 수정 없음. 새 QA 스크립트와 이 증거 디렉터리만 작성했다.

## 완료 기준과 시도 기록

- strict IR, 최대 8그룹, 중복 파일 쌍 집계, 기타 그룹과 전체 목록 보존, escaping/CSP, 기존 run 보고서 동작을 확인한다.
- 공유 빌드 성공 이후 소스 캡처 전후 digest 일치를 확인하고 새 HTML을 생성한다. 기존 `20260911-source-structure`의 104개 파일 역사적 증거는 수정하지 않는다.
- 실제 production `openReportWindow`를 숨김 BrowserWindow로 열어 기본/좁은 폭 PNG, DOM 집계, 전체 목록 펼치기, 보안 설정과 요청을 확인한다. 최대 2회이며 실패는 새 원인 확인 후 교정한다.
- 첫 QA 실행은 스크립트의 최상위 await와 Electron ready 순서가 교착해 55초 타이머 exit 124로 종료했다. `electron-process-attempt1.json/.log` 보존. 기존 proof와 같은 async IIFE로 QA 스크립트만 교정했고 둘째 실행 exit 0. 제품 결함이나 제품 교정으로 분류하지 않는다.

## 검증

- 공유 build: transport_review가 보고한 `npm run build` exit 0, tool 92e82d. 독립 검토자가 별도 중복 빌드를 실행하지 않았다.
- `cd daemon; npx vitest run test/integration-reports.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`: **7 PASS**, 982ms, 21:20:03 KST.
- `cd daemon; npx vitest run test/integration-report-app.test.ts test/integration-report-delivery.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`: **17 PASS**, 1.79s, 21:21:58 KST. 전체 독립 보고서 테스트 **24 PASS**.
- `node scripts/reuse/source-matrix-electron-proof.mjs`: 실제 Electron **PASS**, exit 0. 마지막 읽기에서 검토 소스 해시가 `electron-result.json`과 모두 일치했다.

## 코드 검토

`sourceArchitecture`는 branded validated IR만 받고 source 종류를 요구한다. IR의 256노드/4,096관계 한도 및 endpoint 검증을 재사용한다. 경로 디렉터리별 파일 수로 상위 7개와 나머지를 묶고 8×8 이하 행렬을 만든다. 같은 from/to 파일 쌍은 행렬에서 한 번만 세지만 원본 관계 목록은 그대로 남긴다. 파일 수 동률과 그룹 정렬은 결정적이다. 기타 그룹의 실제 디렉터리 명단과 같은 집계의 텍스트 대안을 제공한다.

모든 입력 기반 문구는 escape되며 실행 가능한 script나 외부 링크를 만들지 않는다. source 전용 CSS까지 포함한 실제 style 바이트로 CSP hash를 계산한다. run 보고서에는 source 행렬과 접힌 단계 목록을 넣지 않는다. hostile label, 순서 결정성, 중복 관계, 기타 그룹, 원본 IR 보존, run 보고서 회귀 테스트를 확인했다. 차단 finding 없음.

## 실제 화면과 수량

새 캡처는 **109파일, 13디렉터리, 224 IR관계, 224 고유 파일 쌍**이다. 8그룹 파일 수 합계 109, 행렬 64칸 합계 224를 독립 원본 endpoint 집계와 칸별 비교했다. 기타 그룹은 **6디렉터리/12파일**이며 텍스트 대안에 실제 전체 디렉터리 명단이 있다. 원본 109행과 224관계는 두 native details를 펼치면 모두 표시된다.

- 기본 내부 폭 **1087px**, 접힌 문서 높이 **1207px**, 가로 넘침 없음. 화면 상단에는 기준 digest와 한계를 표시하고 그 아래 행렬과 그룹 범례를 병렬 배치한다. 첫 화면 아래 행은 세로 스크롤로 접근한다. 이전 약 13,000px 목록형 화면과 달리 요약이 짧아졌지만 서로 다른 소스 스냅샷이므로 정확한 동일자료 성능 비교는 아니다.
- 좁은 내부 폭 **467px**, 문서 높이 **1764px**, 가로 넘침 없음. 직접 PNG를 열어 한국어 줄바꿈, 8×8 행렬의 숫자와 G1–G8 구분이 읽힘을 확인했다. 범례는 아래로 이어진다. 전체 목록을 펼친 상태도 가로 넘침 없이 모든 행/관계가 표시됐다.
- `electron-source-overview.png`, `electron-source-narrow.png`를 실제로 열어 검토했다. 숨김 창의 실제 `capturePage`이며 생성 이미지/목업이 아니다.
- JavaScript false, nodeIntegration false, contextIsolation true, sandbox true, preload 없음. `window.cue`와 `process` undefined. script/src/href 요소 0. 관측 요청은 정확한 HTML data URL main-frame 1개뿐이다. QA용 CDP 검사는 제품 스크립트가 아니다.

## 해시와 한계

- 소스 캡처 digest: `5b0cca2d9ca262c580bfa3fa2d7b95f69f276d59ef315234c4a74da5550b8453`
- HTML SHA256: `caa6b839d28fad7de4a1850a2f4c611e2d8c6704481208d655d79751d2775661`
- architecture.ts: `4d0fd1a634bb61ab59bfe0240e18b517f5567a6c540c05e9ad793eae07af92ef`
- html.ts: `b886ff8c658748ef50a3800271fb306c8e77434b0247617817cedd95deac98e1`
- integration-reports.test.ts: `6e61dc1d478e489ed4c34f7b6ed8a7d74071f4a8486806fd0f6dfe9d51ebea50`
- 나머지 창/QA 소스 및 PNG 해시는 `electron-result.json`에 기록했다.

생성 전후 소스 digest 일치는 그 시점의 정적 문법 스냅샷을 의미한다. 실제 호출 관계, 런타임 계층, 안전성, 효율, 모델 자격 또는 현재 이후 변경의 정확성을 증명하지 않는다. 이 검토에서 Cue 작업이나 모델을 실행하지 않았다. 전체 스크린리더/키보드 접근성 감사와 인쇄/PDF 검증은 수행하지 않았다.
