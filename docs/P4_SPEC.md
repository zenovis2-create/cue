# Phase 4 — 어댑터와 디스패치 (P4-1 ~ P4-7)

Phase 3까지 봉투·승인·강제층이 섰다(`daemon/`, 테스트 65개 통과).
Phase 4는 **Cue를 실제 도구(Orca, Codex)에 연결**한다.

## 구속력 있는 전제 (실측, 바꾸지 마라)

1. **Codex는 강제하지 않는다.** 판정 신호원(`advisory`)일 뿐이다.
2. **파일시스템 봉투는 강제(AppContainer), 네트워크 봉투는 탐지 + 즉시 중단.**
   네트워크를 "강제"라고 쓰지 마라.
3. **승인 1건 ≠ 실행 1건.**
4. 도구의 권한 응답을 근거로 Cue의 강제 검사를 건너뛰는 경로를 만들지 마라.
5. `worker-read`는 **감사 원장으로 쓸 수 없다** — oversized 레코드를 skip/clip한다.
   원장의 진실은 Cue가 직접 기록한다.
6. 세션 진실은 list API가 아니라 **`{pid, start_time, handle, cwd, task_id, run_id}` spawn table**이다.

## 만들 것

### P4-1 Orca 어댑터 — worktree 생성/조회/fence
- `orca` CLI 왕복: `worktree create`, `worktree ps`, `worker-stop`, `worker-abandon`.
- **주의:** Orca JSON 출력에 제어문자가 섞인다 → 관대한 파싱 필요(`strict=False` 상당).
  `task-show` 서브커맨드는 **없다**. `task-list --run <id> --json`이고 `--run-id`가 아니다.
- 검사: 각 명령 왕복 테스트. **실제 CLI가 없으면 SKIPPED로 정직하게 기록**하고
  파서 단위 테스트만 남겨라. 위장 PASS 금지.
- **기존 Orca run/task를 생성·변경·삭제하지 마라.** 읽기와 격리된 임시 자원만.

### P4-2 Codex는 Orca worktree "안에서" 실행
- 검사: 데몬이 `codex exec`를 **형제 프로세스로 spawn하지 않는다**(프로세스 트리 확인).
- Phase 2의 `spawnVendorCodex`(절대경로 vendor 바이너리, 격리 `CODEX_HOME`)와
  Phase 3C의 AppContainer 기동을 **결합**해라. 두 경로가 갈라지면 안 된다.
- 검사: 실제 기동 후 부모-자식 관계와 `cwd`가 worktree임을 단정.

### P4-3 워크스페이스 리스 — worktree당 쓰기 태스크 1개
- 같은 worktree에 두 번째 쓰기 태스크 → **큐잉**(거부가 아니라 대기).
- 읽기 전용 태스크는 리스를 잡지 않는다.
- 검사: 동시 요청 2건 → 하나는 running, 하나는 queued. 첫 번째 종료 시 두 번째 진입.
- 검사: 리스 보유자가 죽으면 리스가 회수된다(하트비트 노화 연동, P2-4 재사용).

### P4-4 세션 핸들 기록이 진실
- 모든 자식 세션이 `{pid, start_time, handle, cwd, task_id, run_id}`와 함께 원장에 생긴다.
- **소유자 없는 생성 경로가 없어야 한다.**
- 검사: 아키텍처 테스트 — spawn 계열 호출이 전부 원장 기록 함수를 거친다.
  (`child_process` 직접 호출이 spawn 래퍼 밖에 존재하지 않음을 grep/AST로 단정)
- `{pid, start_time}` 복합 신원을 쓴다(pid 재사용 방어, P2-4와 동일 원칙).

### P4-5 종료가 태스크의 일부 — 닫기 실패는 성공 아님
- 검사: close 실패를 주입하면 태스크가 `succeeded`가 **되지 않고**
  `아직 위험한 것(still_unsafe)`에 기록된다.
- 검사: 정상 종료 경로에서는 `succeeded`가 된다(양성 대조군).

### P4-6 고아 청소는 표시만
- 원장에 없는 세션을 만들어 두고 데몬을 재시작 → **목록에 뜨지만 자동으로 죽지 않는다.**
- 검사: 재시작 후 고아가 나열되고, 프로세스가 살아있음을 단정.
- **자동 kill 경로가 없음**을 grep 테스트로도 확인.

### P4-7 `routing.yaml` + `default: ask_me`
- 어떤 규칙에도 안 걸리는 태스크는 **디스패치되지 않고 사용자에게 묻는다**.
- 검사: 미매칭 태스크가 `ask_me` 상태로 가고, 어떤 도구도 spawn되지 않는다.
- 검사: `routing.yaml`이 없거나 깨져도 **fail-closed**(전부 ask_me). 기본 허용 금지.
- **YAML 편집 UI는 만들지 마라**(v0.1 영구 제외). 파일을 읽기만 한다.

## 절대 규칙
1. **증거 없이 완료 주장 금지.** 항목마다 실제 테스트 출력.
2. **위장 PASS 금지.** 못 하면 `FAIL`, 부분이면 `PARTIAL`, 환경 부재면 `SKIPPED` + 이유.
   3B에서 정직한 FAIL을 냈던 그 기준을 유지해라.
3. 기존 65개 테스트를 깨지 마라. Phase 3 테스트 파일을 수정하지 마라.
4. 작업 범위는 `C:/Users/User/cue/daemon`. 금지: `D:/AI2_WIN/AI-backup-20260505/tactics`.
   `probes/`, `evidence/P1/`, `evidence/P2/`, `evidence/P3/` 건드리지 마라.
5. 시스템 상태 영구 변경 금지. 임시 worktree/프로세스/파일은 `finally`에서 정리.
6. 자격 증명 값 출력 금지. 존재 여부만.

## 산출물
- `daemon/src/` 확장 + `daemon/test/p4.test.ts`
- `evidence/P4/p4_test_output.log` — `npm test` 전체 출력 verbatim
- `evidence/P4/p4_result.json` — `[{id, verdict: PASS|PARTIAL|FAIL|SKIPPED, evidence, note}]`
- `evidence/P4/P4_VERDICT.md` — 한국어 판정문

마지막에 한국어로 항목별 판정 표 + **실제 Orca CLI로 검증한 것과 못 한 것**을 구분해 한 문단.
