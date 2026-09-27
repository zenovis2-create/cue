# S6 리소스 UI — 독립 실제 Electron QA

판정: **데스크톱·시험용 폴더 선택 범위 PASS**. 제품 코드를 작성하지 않은 검토자가 실제 PNG를 열어 확인했다. 제품 수정 없음, 모델 호출과 실행 session 모두 0.

완료 기준: shipped renderer/preload → 실제 ipcMain → registerIpcHandlers → createCueCore/임시 SQLite → resource store/search를 연결하고, 가져오기·취소·목록·제거·고정 실행 검색·늦은 응답 차단·escaping을 확인한다. 기본 및 좁은 데스크톱 화면을 캡처한다. native OS 폴더 선택창 자동 클릭과 일반 main boot는 대체하지 않고 미검증으로 남긴다.

## 실제 경로 검증

`node scripts/reuse/resource-ui-electron-proof.mjs`의 둘째 실행 exit 0 (tool fcc223). `window.cue`를 가짜 객체로 교체하지 않았다. shipped preload의 `cue:resources` IPC를 통과했다. 유일한 입력 fixture는 임시 패키지를 반환하는 host `chooseResourcePackage`이며, 지연 시험은 실제 core 검색 결과를 IPC에 돌려주는 시점만 미뤘다.

- 선택 취소 후 등록 목록 0 유지. v1 manifest/hash/파일을 실제 loader로 등록하고 UI 목록에 표시.
- 범위 만들기 버튼으로 실제 run과 고정 resource pin 생성. 검색 결과는 한글·emoji·`<script>…</script>`를 포함한 원본 98 UTF-8 바이트와 일치.
- v2 등록 후 기존 v1 run 검색은 v1 원문 유지. active 목록 제거 후에도 기존 pin 검색 유지. 사용자 패키지 파일은 삭제되지 않고 v2 바이트 그대로 유지.
- v1 검색 응답을 보류하고 제거 후 새 run 준비 → 빈 pin 확인 → 이전 실제 응답 반환: 새 화면 결과 0, 검색 비활성, 새 run pin 유지.
- 실제 두 번째 BrowserWindow/preload의 조회 거부. renderer가 import에 임의 root를 추가한 요청 거부.
- 결과의 script/img/link DOM 0, injected global undefined, renderer process undefined. 목표 입력에 검색 원문이 자동 삽입되지 않았다. 참고 전용·원격 진위 미검증·권한 없음 문구 확인.
- sandbox/contextIsolation 유지, nodeIntegration false, 모든 관측 요청은 file scheme. 목표/봉투/승인 버튼 유지와 기존 report 요소 존재 확인. 승인·실행 버튼은 누르지 않았다. 보고서 열기 전체 회귀는 별도 S7 검토 범위다.

## 실제 시각 관측

기본 창 1180px(내부1167), 좁은 데스크톱 980px(내부967) 모두 가로 넘침 없음. 리소스 패널은 각각 약350/300px이며 텍스트·긴 지문이 줄바꿈된다. `resource-default-painted.png`, `resource-narrow-painted.png`, `resource-citation-painted.png`를 직접 열어 읽었다. 목록, 제거 버튼, run/pin, 검색어/버튼, 인용 메타데이터가 읽히며 reference-only 표시가 보인다.

긴 지문과 메타데이터 때문에 세로 길이가 길고, 검색 결과는 내부 스크롤을 사용한다. 인용 PNG는 메타데이터를 보여주며 원문 excerpt는 아래 내부 스크롤 영역에 있다. 원문과 escaping은 실제 DOM으로 확인했으나 PNG 전체에 모든 원문을 한 번에 담았다고 주장하지 않는다.

480px(내부467)에서 scrollWidth900의 가로 넘침을 관측했다. 이는 기존 전역 `body{min-width:900px}`의 데스크톱 최소 폭 제약이며 모바일 대응 PASS를 부여하지 않는다.

## 시도·증거 보존

처음 정한 실행 상한 2회. 첫 실행은 UI에 도달하기 전 다른 작업자의 편집 중 `app/orchestration-driver.mjs:163` 구문 오류로 실패했다. `electron-failure-attempt1.json`과 process/log 보존. 소유자가 안정화한 뒤 node syntax check0을 확인했고 둘째 실행 기능 시나리오 PASS였다.

둘째 실행의 첫 PNG가 숨김 compositor의 초기 프레임인 점을 직접 이미지 검토에서 발견했다. `resource-default.png`를 성공 화면으로 취급하지 않는다. 부모가 별도 관측 원인에 대한 capture-only 교정을 승인했다. warm capture 후 최종 capture하도록 QA만 수정하고 `node scripts/reuse/resource-ui-electron-proof.mjs --capture-only` exit0(tool76a2ea)을 실행했다. 새 임시 fixture의 import/prepare/search만 수행하고 mutation/stale/sender 시나리오는 반복하지 않았다.

원래 기능 결과 `electron-result.json`과 이전 PNG를 유지하고, 최종 캡처는 별도 `electron-capture-result.json` 및 `*-painted.png`에 보존했다. `electron-process.json/.log`는 마지막 capture-only 프로세스 기록이며 둘째 기능 실행의 exit0은 위 tool ID에 대응한다. wrapper의 일반 PASS stdout보다 각 JSON의 실제 수행 범위가 우선한다.

제품 소스 해시는 두 결과 JSON에 기록했다. 이 QA는 네이티브 폴더 다이얼로그의 선택/취소 UX, main.mjs의 실제 OS dialog 호출, 모드별 모델 실행, 원격 출처 진위 또는 전체 접근성 인증을 증명하지 않는다. transport_review의 별도 코드 검토와 합쳐 판단한다.
