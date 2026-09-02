# P1-4 / P1-5 / P1-6 — 사실 수집 프로브

너는 Cue v0.1 빌드 체크리스트의 **Phase 1 잔여 항목 P1-4, P1-5, P1-6**을 실행한다.
지휘자(@claude)가 P1-1 ~ P1-3을 이미 돌렸고, 그 결과가 네 출발점이다.

## 절대 규칙

1. **증거 없이 결론 금지.** 문서에 그렇게 써 있다는 것과 실제로 그렇게 동작한다는
   것은 다른 사실이다. `--help` 출력만 보고 "지원한다"고 적지 마라. 실제로 실행해라.
2. **"없음"도 훌륭한 결과다.** 기능이 없으면 없다고 적고, 없다는 근거(명령 + 그 출력
   원문)를 남겨라. 있는 척하는 것이 유일한 실패다.
3. **모든 명령의 stdout/stderr 원문을 원장에 남겨라.** 요약본만 남기지 마라.
4. **읽기 전용을 지켜라.** 이 프로브는 조회만 한다. 기존 Orca run/task를 수정·삭제·
   재시작하지 마라. 새 run을 만들지 마라.
5. **아래 경로에 절대 쓰지 마라: `D:/AI2_WIN/AI-backup-20260505/tactics`.**

## 이미 아는 사실 (재조사 금지)

- npm `codex` shim은 stdio JSON-RPC를 중계하지 않는다. vendor 바이너리를 써라:
  `C:/Users/User/AppData/Roaming/npm/node_modules/@openai/codex/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe`
- 오염된 `CODEX_HOME`은 hook·MCP 노이즈를 만든다. 깨끗한 홈을 써라.
- Codex permissions 프로파일은 강제하지 않는다(P1-2 FAIL). 다시 확인하지 마라.

## 참고 자산

- `probes/appserver.py` — JSON-RPC stdio 클라이언트. raw 텍스트만 운반하고 판정은
  호출자가 한다. 원장 자동 기록. 재사용해라.
- `probes/p1_1_approval_roundtrip.py`, `probes/p1_2_permissions.py` — 참고 구현.
- `evidence/P1/P1_1A_VERDICT.md`, `P1_2_VERDICT.md` — 판정문 서식 참고.

---

## P1-4 — `orca orchestration worker-read` 페이징 실동작

**질문:** 워커 출력을 커서로 나눠 읽을 수 있는가. 중간에 소스가 바뀌면 무슨 일이 나는가.

**해야 할 일**
- 이미 존재하는 완료된 run/task를 하나 골라 `worker-read`를 호출한다.
  (조회 전용. 새로 만들지 마라. `orca orchestration --help`, `run list`, `task list`
  계열로 후보를 찾아라.)
- `--cursor`를 실제로 2회 이상 왕복시킨다. 1회차 응답의 커서를 2회차 입력으로 넣어라.
- 각 왕복의 요청 명령줄과 응답 원문을 기록한다.
- 응답에 `source_changed`(또는 유사 필드)가 있는지 확인하고, 있으면 어떤 조건에서
  발생하는지, 없으면 없다고 기록한다.
- 커서 소진 시(더 읽을 게 없을 때) 무엇이 반환되는지 기록한다.

**기록할 사실:** 커서 필드 이름, 페이지 크기 제어 가능 여부, 소진 신호, 재개 가능 여부.

---

## P1-5 — codex / orca 비용·토큰 회계 존재 여부

**질문:** 실행 하나가 얼마를 썼는지 도구가 알려주는가.

**해야 할 일**
- `codex` 쪽: app-server 이벤트 스트림과 `exec` 출력에 토큰/비용 필드가 있는지
  확인한다. P1-1 원장(`evidence/P1/p1_1_ledger.log`)과 P1-2 원장을 먼저 grep 해라 —
  이미 받아둔 이벤트 안에 있을 수 있다. 없으면 짧은 턴을 하나 돌려 `turn/completed`
  전후 이벤트를 전량 열거해라.
- `orca` 쪽: run/task 조회 출력에 usage·cost·token 필드가 있는지 확인한다.
- 필드를 찾으면 **정확한 필드 경로와 실제 값 하나**를 기록한다.
- 못 찾으면 **찾아본 명령 목록과 그 출력**을 근거로 "없음"을 기록한다.

**이 결과의 용도:** 회계가 없으면 v0.1에서 `blocked/budget` 상태를 계속 봉인한다.
있으면 어떤 필드로 집계할지 정한다. 그러니 "있다/없다"보다 **필드 경로**가 중요하다.

---

## P1-6 — hermes 이벤트 스트림 / 실행 중 개입

**질문:** hermes가 실행 중인 작업의 이벤트를 밖으로 흘리는가. 밖에서 끼어들 수 있는가.

**주의:** v0.1 범위 밖이다. 어댑터 구현 순서를 정하려고 사실만 확보한다.
**결과와 무관하게 hermes는 v0.1에서 `enforcement-only`로 남는다** — 이 결론을 바꾸려
들지 마라.

**해야 할 일**
- hermes CLI/설정에서 이벤트 스트림, 웹훅, IPC, 로그 tail 중 무엇이 존재하는지 조사.
- 실행 중인 작업에 외부에서 메시지를 주입하는 경로가 있는지 조사.
- 조사 명령과 출력 원문을 남긴다. 없으면 없다고 적는다.

---

## 산출물 (정확히 이 경로)

- `probes/p1_4_worker_read_paging.py` — P1-4 프로브
- `evidence/P1/p1_4_ledger.log` — P1-4 명령·출력 원문
- `evidence/P1/p1_5_accounting.log` — P1-5 조사 원문
- `evidence/P1/p1_6_hermes_events.log` — P1-6 조사 원문
- `evidence/P1/p1_456_result.json` — 구조화 결과. 각 항목에
  `{"id", "question", "commands_run", "finding", "evidence_excerpt", "verdict"}`.
  `verdict`는 `SUPPORTED` / `ABSENT` / `INCONCLUSIVE` 셋 중 하나.
- `evidence/P1/P1_456_VERDICT.md` — 판정문. 항목별로 질문 / 실측 / 판정 / 이 사실이
  설계의 무엇을 바꾸는가.

## 마지막에 보고할 것

1. 세 항목 각각의 `verdict`와 한 줄 근거.
2. **P1-5가 `ABSENT`인지 아닌지** — 이게 `blocked/budget` 봉인 여부를 가른다.
3. 조사 중 발견한, 설계를 바꿔야 하는 예상 밖 사실이 있으면 별도로 적어라.
   없으면 "없음"이라고 적어라. 지어내지 마라.
