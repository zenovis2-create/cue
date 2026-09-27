# 재시도 계약·이력 실제 Electron QA

2026-09-11 · 독립 QA reuse_transport · **PASS (합성 DTO UI 범위)**

`node scripts/reuse/retry-electron-proof.mjs` 첫 실행 exit 0. Electron 44.2.0 새 숨김 창에서 실제 renderer를 로드하고 prepare fixture를 실제 form submit으로 표시했다. 기존 proof 파일/증거는 보존했다.

DOM 검사: 최초 실행 포함 단계당 2회·전체 4회·기한·계약 지문과 실패도 기록/비용에 포함한다는 안내가 승인 전에 표시됨. retry 없는 이전 형식에서는 해당 문단이 숨겨지고 내용이 제거됨.

관측 fixture 검사: implementation 단계는 최신 retry-attempt 한 줄만 보이고 총 2회/실패 1회가 표시됨. 별도 시도 이력에는 새 완료와 이전 실패가 둘 다 남음. 이전 비용 미확정 DTO는 최종 비용 미확인으로 표시되고 실행 완료는 인수 미확인과 구분됨. 가로 overflow 없음.

`electron-retry-approval.png`, `electron-retry-history.png`를 view_image로 직접 확인했다. 승인 계약과 이력이 읽을 수 있게 줄바꿈되며 겹침·가로 잘림이 없다. 페이지는 해당 패널로 세로 스크롤한 캡처이며 합성 fixture라는 설명이 화면에 남아 있다.

PNG SHA256:

- approval `a3f3da813e469e792a928e5a2eeeceb2efd60533318f599833cbe9c57c9b2842`
- history `9a68b52cf34429614583b66baca06284b040867f8002078808d134a808d4164d`

source/fixture hash와 DOM 값은 `electron-result.json`, 자식 PID/exit는 `electron-process.json`에 기록했다. 직접 재시도 실행, DB의 최신 시도 선택 query, 실제 과금·기한 강제·자격검사·IPC를 증명하지 않는다. 이들은 별도 구현/계약 검증 범위다. 유료 호출·보이는 창·제품 코드 수정 없음.
