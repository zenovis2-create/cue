# 인수 기준 승인 UI 실제 Electron QA

2026-09-11 · 독립 QA reuse_transport · **PASS (fixture UI 범위)**

`node scripts/reuse/approval-electron-proof.mjs --criteria` 첫 실행 exit 0. 기존 S3 증거 경로를 덮어쓰지 않고 S4 경로에 별도 기록했다. 숨김 Electron 44.2.0의 fresh renderer에서 실제 form submit을 실행하고 cue.prepare만 합성 응답으로 대체했다.

확인:

- 요구 ID·원문·종류·필수 여부, checker ID/revision/target IDs/parameter digest, 전체 requirements digest 표시.
- `<img ...>` 문자열이 원문 그대로 남고 실제 img element 수 0.
- 전체 원문 정확히 일치, 가로 overflow 없음.
- criteria 누락은 `기준 미등록 · 최종 인수 미확인`으로 명시.
- legacy 및 준비 실패 이후 requirements 내용/요약 제거, 실패 시 승인 비활성.
- 기존 정책·DAG 표시 및 observation의 인수 미확인/중단 버튼 회귀 통과.

`electron-approval-plan.png`를 view_image로 직접 확인했다. 세로 스크롤을 기준 패널로 이동한 캡처이며 두 단계, 전체 원문, 검사 설정 지문, 승인 버튼이 읽을 수 있게 표시된다. 긴 digest가 줄바꿈되고 겹침·가로 잘림이 없다.

PNG SHA256: `b8a1af0d68991bea7fb63ca7ab56918c651cba24fd0ffc877eaf318a329b4076`. 소스·fixture hash와 DOM assertions는 `electron-result.json`, PID/exit는 `electron-process.json`에 있다. UI 소스 수정은 하지 않았다.

실제 preload/IPC, 계획·기준 생성, 사용자 승인 후 실행, checker 실행·최종 인수 성공은 검증하지 않았다. 원시 실행을 대신한 fixture임을 화면과 evidence에 명시했다. 유료 호출·보이는 창·전역 설정 변경 없음.
