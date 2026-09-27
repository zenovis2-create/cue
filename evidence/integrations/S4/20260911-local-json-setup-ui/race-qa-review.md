# 설정/승인 실행 경합 — 독립 실제 UI 검토

현재 판정: **차단 finding 있음**. 기존 `qa-review.md`의 설정 저장 범위 PASS를 전체 실행 UI PASS로 확대하지 않는다.

## 실제 화면 finding

초기 `cue:execute`가 거부되고 아직 실행 카드가 한 번도 표시되지 않은 경우, catch는 `stop.hidden=false`와 disabled=false만 설정한다. 그러나 준비 때 설정한 상위 `#result` 영역의 hidden=true가 유지되어 **실제 화면에는 중지 버튼이 보이지 않는다**. `race-reject.png`를 직접 열어 확인했다. `race-resolve.png`에서는 running 카드가 먼저 표시되어 중지 버튼이 보인다.

제품 source: renderer.js의 준비 후 `result.hidden=true`와 approve catch의 stop 처리. direct DOM `.click()`은 숨겨진 버튼에도 실행되므로, `stop.hidden/disabled`만 검사한 자동 assertion은 실제 접근 가능성을 증명하지 않는다. 다음 검증은 상위 hidden 및 실제 렌더 박스/visibility를 포함해야 한다. 제품 수정은 하지 않고 parent와 contracts_review에 전달했다.

## 수행 범위와 통과한 부분

실제 core에서 목표 준비·승인을 하고 shipped preload/guarded IPC를 사용했다. host QA wrapper의 execute/status/stop만 지연·실패 fixture로 대체했다. 실제 Codex/모델/native 런타임은 호출하지 않았다. 설정 row, capability evidence, session, attempt 모두0이다.

resolve/reject 두 경우 모두 execute 응답 대기 동안 설정/새 준비/템플릿 변경이 막히며 추가 prepare/configure 호출이 없다. 응답 후 최초 status를 보류한 상태 및 status transport 오류 후에도 원래 runId로 stop, 원래 taskId로 polling한다. 이 **ID 보존 검증은 통과**했다. 하지만 reject의 사용자 중지 가능성은 위 화면 결함 때문에 실패다. terminal blocked + cleanup unknown 상태의 소유권 해제는 이번 시험에서 만들지 않았으며 별도 source 검토 대상이다.

## 시도·증거

최대2회. 첫 실행은 resolve만 완료한 후 마지막 창 종료에 따른 Electron 기본 종료가 다음 reject 창 로딩을 중단했다. `race-electron-failure-attempt1.json`과 process 기록을 보존했다. process exit0만으로는 완료가 아니므로 최종 결과가 두 scenario를 포함하는지도 gate에 추가했다.

두 번째 `node scripts/reuse/setup-race-electron-proof.mjs --keep-app-until-both-scenarios` exit0(tool712242), 두 scenario JSON과 PNG 생성. `race-electron-result.json`의 passed=true는 **기록된 DOM/ID assertion만의 결과**이며 본 독립 화면 검토가 추가 발견한 차단 finding을 무효화하지 않는다. 두 PNG를 직접 열어 검토한 뒤에 finding을 보고했다.

`race-electron-result.json`은 현재 core/ipc/preload/renderer/index/proof 소스 SHA를 기록한다. 초기 `race-electron-failure.json`은 첫 실행에서 남은 역사적 실패이며 두 번째 성공 상태로 덮어쓰지 않았다. 제품 correction 준비 후 표적 재검증이 필요하다. 기존 설정 저장·CAS·재개방 증거 파일은 덮어쓰지 않았다.
