# 모드 선택 UI 실제 Electron QA

2026-09-11 · reuse_transport 독립 QA · **PASS (renderer fixture 범위)**

명령 `node scripts/reuse/selection-mode-electron-proof.mjs` 최종 exit 0. 현재 build 0/UI 관련 21 PASS 소스에서 새 hidden Electron 44.2.0 창을 실행했다. 네 모드와 저장/준비 API만 합성 구현으로 전달하며 실제 renderer DOM 이벤트를 구동했다.

검사:

- 효율·고성능·가성비·속도 4개 옵션과 저장된 기본 가성비 표시.
- 각 옵션을 차례로 선택·폼 제출해 prepare.selectionMode와 일치 확인.
- 고성능으로 준비 후 기본 속도 저장: expectedRevision=2, 반환 revision=3, 저장 상태 표시. 이미 승인 대기 중인 고성능 계획 요약은 그대로 유지.
- 저장 충돌 시 저장 실패 문구, 현재 선택 유지. 재조회한 revision=4로 다음 저장 요청을 보내는지 확인.
- 미지원 호스트에서는 컨트롤 숨김/비활성, 지원하지 않는다는 설명, prepare에서 selectionMode 생략, 계획 패널 숨김.
- 가로 overflow 없음, show:false 유지.

첫 실행 DOM 검사는 통과했으나 PNG가 hidden compositor의 저장 직전 프레임이었다. proof capture만 1회 수정해 첫 capture로 compositor를 갱신하고 최종 프레임을 다시 캡처했다. 최종 PNG를 view_image로 직접 확인했으며 왼쪽 속도 모드/기본 저장 문구와 중앙의 고정된 고성능 승인 계획이 동시에 보인다. 겹침·잘림 없이 읽을 수 있다. 제품 코드는 수정하지 않았다.

PNG SHA256: `bbf6aa7a33bb2dac757dd28134f3bf8c7d4566b905e0bedb09d71ba56088dadb`. source hashes·DOM 결과는 `electron-result.json`, PID/exit는 `electron-process.json`. 이전 S2/S3/S4 증거는 보존했다.

실제 IPC, DB 기본값 영속화, 실행 후보 선택/승인/에이전트 호출을 검증한 것은 아니다. renderer의 fixture API 호출 및 상태 표시만 검증했다. 유료 호출·보이는 창 없음.
