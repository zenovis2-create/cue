# Phase 4 판정

전체 테스트는 **81/81 PASS**다. 다만 테스트 성공과 요구사항 완전 충족을 동일시하지 않았다. 실제 외부 도구 왕복 및 생산 경로 증거가 부족한 항목은 PARTIAL로 판정했다.

| 항목 | 판정 | 근거 |
|---|---|---|
| P4-1 Orca 어댑터 | PARTIAL | 설치된 Orca의 `worktree ps --json` 실제 왕복과 관대한 JSON 파서, 다섯 명령 argv 검사는 통과. 실제 `create/worker-stop/worker-abandon` 왕복은 미실시. |
| P4-2 Codex in worktree | FAIL | 실제 vendor `codex.exe`의 AppContainer 기동은 성공했지만 독립 OS process-tree 단정이 없고 기존 `spawnVendorCodex` 무강제 경로가 남아 있음. |
| P4-3 워크스페이스 리스 | PARTIAL | 2 writer의 running/queued/승계 및 P2 heartbeat age 연동 통과. 승계된 요청의 자동 실제 spawn E2E는 미검증. |
| P4-4 세션 원장 | FAIL | 복합 필드 기록과 spawn grep은 통과했으나 기존 P2 API 및 Dispatcher의 임의 spawner로 owner 없는 경로가 남음. |
| P4-5 종료 | PARTIAL | close 실패/정상 양성 대조는 통과했지만 Dispatcher spawner가 owned/enforced 경로로 제한되지 않음. |
| P4-6 고아 | PARTIAL | 원장 재개방 뒤 고아 표시 및 프로세스 생존은 확인. 생산 프로세스 발견은 외부 입력이고 no-kill grep 범위가 모듈에 한정됨. |
| P4-7 라우팅 | PASS | 미매칭·파일 없음·깨진 YAML 모두 `ask_me`; Dispatcher에서 spawn 0회 확인. |

## 구속 전제 확인

- Codex adapter는 advisory이며 강제 주체로 표기하지 않았다.
- 파일시스템 봉투는 AppContainer로 강제한다.
- 네트워크 봉투는 탐지 후 즉시 중단하는 gate이며 강제로 표현하지 않는다.
- 승인 원장과 실행 원장은 계속 분리되어 있다.
- Orca worker-read를 감사 원장으로 사용하지 않는다.
- 세션 조회의 기준은 Cue SQLite spawn table의 복합 프로세스 신원이다.

## 실제 Orca CLI 구분

실제 Orca CLI로 검증한 것은 설치 탐지와 `orca worktree ps --json` 읽기 왕복뿐이다. `worktree create`, `orchestration worker-stop`, `orchestration worker-abandon`, `orchestration task-list --run`은 정확한 argv 및 파서 단위 테스트만 수행했다. 기존 Orca run/task는 생성·변경·삭제하지 않았다. 따라서 P4-1을 PASS로 올리지 않았다.

원문 전체 출력은 `p4_test_output.log`, 기계 판정은 `p4_result.json`에 있다.
