# S7 역사 소스 비교 — 독립 코드·실제 Electron QA

판정: **보관 스냅샷 비교 범위 PASS**. 메이커와 별도 검토자가 제품 소스 및 실제 화면을 검토했다. 제품 변경·현재 소스 재생성·모델 호출 없음.

완료 기준은 고정된 source/result 바이트, 원래 HTML/IR receipt의 일관성, 파일/노드/관계 차이, 전체 목록 보존, escaping/CSP, 기본·좁은 실제 창의 가독성 및 격리 설정이다. 시도 상한2, 실제 proof **첫 실행 PASS**. run IR parser를 비교 결과에 적용하지 않고 comparison 전용 API와 독립 원본 집계를 사용했다.

## 코드·무결성 검토

`restoreArchivedSource`는 크기 제한 후 source/result SHA256과 원본 HTML artifact SHA/바이트 수, 복원한 source IR의 canonical specification SHA/바이트 수, revision/파일·관계 수를 확인한다. 원래 HTML을 현재 renderer로 다시 생성해 과거 증거를 바꾸지 않는다. runner는 고정 두 경로/pin만 사용하고 파일 종류/크기·UTF-8을 검사하며 외부 입력 인자를 받지 않는다. 쓰기는 임시 파일의 fsync/readback hash 후 rename으로 수행하고 디렉터리 내구성은 미보장으로 명시한다.

`buildSourceComparison`는 branded source IR 및 같은 identity 조건을 재사용한다. 동일 경로의 내용 hash 변경을 node/edge ID 차이와 별도로 계산한다. 화면 주요 목록은 경로순 최대12개이고, 남은 항목과 원본 전체 노드/관계는 native details에 보존한다. 입력 기반 문구는 escape하며 script/외부 링크를 만들지 않는다. 실제 style hash를 CSP에 사용한다. 현재 소스·깨끗한 Git·런타임 영향·안전/성능에 대한 증명을 주장하지 않는다. 차단 finding 없음.

핀은 신뢰된 호스트가 선택한 보관 바이트의 식별자일 뿐 작성자 인증 서명이나 의미의 진실성 증거가 아니다. runner는 workspace 소유의 고정 증거 파일을 읽는 도구이며 임의 공격자 경로를 받는 sandbox API로 평가하지 않았다.

## 독립 실행

- `cd daemon; npx vitest run test/integration-report-comparison.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`: **5 PASS**,953ms,21:41:11 KST(tool ba9e9a). 원본 바이트/receipt 변조, forge/unrelated IR, 동일 경로 내용 변경, 노드/관계 변경, escaping/CSP 포함.
- `node scripts/reuse/source-comparison-electron-proof.mjs`: **PASS**,exit0(tool7dfc4d). 원본 보관 receipt를 다시 검증하고 comparison 결과와 일치 확인. 별도로 원본 file hash map과 node/edge ID 집합을 직접 계산했다.
- 테스트용 proof 전용 소스와 이 증거만 작성했다. 메이커의 build0은 전달받은 결과이며 여기서 중복 빌드를 실행하지 않았다.

정확한 차이는 이전104파일/104노드/212관계 → 이후109파일/109노드/224관계다. 파일 추가5·동일 경로 내용 변경12·삭제0, 노드 추가5·변경0·삭제0, 관계 추가12·변경0·삭제0. 전체 차이 표의34행은 파일17+노드5+관계12에 대응한다. 이전104/212와 이후109/224 전체 목록도 모두 보존되고 펼치면 표시된다.

## 실제 화면

`comparison-default.png`, `comparison-narrow.png`, `comparison-file-details.png`를 도구로 직접 열어 확인했다. production `openReportWindow`의 실제 BrowserWindow이며 show()만 억제했다. 기본 내부1087px, 접힌 문서높이1327px; 좁은 내부467px, 높이1741px. 둘 다 가로 넘침 없이 요약 수치와 문구가 읽힌다. 좁은 화면에서는 세 요약 카드가 한 열로 이어진다. 17개 파일 상세 표는 긴 SHA를 줄바꿈하며 펼친 모든 표/목록도 가로 넘침이 없다. 한 화면에 전체17행을 담는 것이 아니라 정상 세로 스크롤로 접근한다.

Javascript false, nodeIntegration false, contextIsolation true, sandbox true, preload 없음. `window.cue`/`process` undefined. script/src/href 요소0. 요청은 정확한 artifact data URL의 main-frame만 관측됐다. CDP는 QA 검사 수단이며 제품 JS가 아니다. 출력 artifact hash는 창 로드 전후 동일했다. native details의 펼침/내용 표시를 실제 DOM에서 확인했으나 별도 스크린리더 인증이나 PDF 검증은 하지 않았다.

## 고정 증거

- HTML: `790f86cbdf038a61f4eca3cf4b742d6e9ed34b2fac985ee8e9f093292b157aef`, **95,898bytes**.
- comparison.ts: `259d522d854bc9eb4f0149513637f75e008170c5391ac0519d7f2240c821d00e`
- integration-report-comparison.test.ts: `113d69328160e94058243fc22e3e0227b61b90bffc1341af3deda478fcfd43bb`
- runner: `aa73c47361da53cf8c8011e7f348c4e04d2fd7225452b1b067290ea80d356b5c`
- 실제 설정·DOM·PNG·QA source hash: `electron-review-result.json`.

현재 움직이는 core/driver 변경은 이 고정 역사 비교의 새 사실로 반영되지 않는다. 원본 snapshot/HTML/receipt는 덮어쓰지 않았다.
