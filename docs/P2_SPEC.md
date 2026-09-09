# Phase 2 — Cue 데몬 뼈대 (P2-1 ~ P2-9)

너는 Cue v0.1의 **데몬 뼈대**를 만든다. 여기서부터가 제품 본체다.
Phase 1(프로브)은 끝났고 그 실측 결과가 아래 설계 전제다. **전제를 바꾸지 마라.**

## Phase 1에서 확정된 사실 (구속력 있음)

1. **Codex에는 강제층이 없다.** `permissions` 프로파일로 worktree를 좁혀도
   승인 후 실행은 worktree 밖에 그대로 쓴다(실측: `source:"unifiedExecStartup"`).
   네트워크 `deny`를 줘도 `example.com`에서 HTTP 200을 받았다.
   → **경계 강제는 전부 Cue가 한다. 도구 응답을 강제로 세지 마라.**
2. **빈 permissions 응답은 허용(allow)으로 해석된다.** 절대 금지.
   거부는 `decline` 하나로만 표현한다.
3. **승인 1건 ≠ 실행 1건.** permissions 승인 1건이 후속 command approval을 삼켰다
   (accept 시나리오에서 command approval 0건). 재생 방지 키를 `itemId` 단독에 의존하지 마라.
4. **토큰 회계는 존재한다.** 두 경로뿐:
   `thread/tokenUsage/updated.params.tokenUsage.last` (app-server),
   `turn.completed.usage` (`codex exec --json`).
   Orca에는 토큰·비용 필드가 없다. **통화 환산 금지**(가격표가 원천에 없다).
5. **`worker-read` 페이징은 동작하지만 원장이 아니다.** oversized record를 skip/clip한다.
6. **모든 워커는 깨끗한 `CODEX_HOME`에서 뜬다.** 오염된 홈에서 hook이 승인보다 먼저 돌았다.

## 작업 디렉터리

`C:/Users/User/cue` (git repo). 여기 밖에 쓰지 마라.
금지: `D:/AI2_WIN/AI-backup-20260505/tactics` (읽기 전용 dirty root).
기존 Orca run/task를 만들거나 변경하지 마라.

## 스택

- **TypeScript + Node.js**, `better-sqlite3`, `vitest`.
- `npm init` → `daemon/` 디렉터리. `tsconfig.json` strict.
- 테스트는 `daemon/test/`.
- 빌드·테스트가 실제로 돌아야 한다. "돌 것이다"는 실패다.

## 만들 것

### P2-1 SQLite 원장 스키마
테이블 9개: `task`, `run`, `envelope`, `approval_event`, `session_handle`,
`artifact`, `annotation`, `recovery_attempt`, `verification`.
- 마이그레이션 파일 방식(`migrations/001_init.sql`), 빈 DB에서 끝까지 돈다.
- `envelope`: `envelope_hash`(불변), `worktree_realpath`, `egress_json`, `created_at`.
  **봉투는 UPDATE 금지** — 트리거로 막고 테스트로 증명해라.
- `approval_event`: 재생 방지 키를 **`(run_id, envelope_hash, thread_id, item_id, approval_id, request_ordinal)`**
  복합 UNIQUE로 잡는다. `approval_id`가 null일 수 있으므로 `request_ordinal`(단조 증가)을 반드시 넣어라.
  이게 사실 3에 대한 대응이다.
- `session_handle`: `{pid, start_time, handle, cwd, task_id, run_id}`. `start_time` 없이는 신원이 아니다.
- 검사: 각 테이블 1행 삽입/조회 테스트 통과. 봉투 UPDATE 시도가 실패하는 테스트 통과.

### P2-2 IPC
`127.0.0.1` HTTP + 256비트 bearer 토큰.
- 토큰은 기동 시 생성해 `0600` 권한 파일에 쓴다. 로그에 절대 찍지 마라.
- 검사: 토큰 없음 → 401. 스키마 위반 → 400. `0.0.0.0`에 바인드 안 됨(리스닝 주소 단정).

### P2-3 상태 기계
6상태 + 타입 있는 blocked 사유.
- `blocked/budget`은 **토큰 임계값으로만** 발화한다.
- **통화 금액을 계산·표시하는 코드 경로가 없어야 한다.**
  검사: `grep -riE "usd|dollar|price|\\$[0-9]" daemon/src` 결과 0건인 테스트.
- 토큰 집계 원천은 위 두 경로뿐. 다른 데서 추정하지 마라.

### P2-4 프로세스 신원 + 하트비트
파일 하트비트(`state/heartbeat.json`), 신원은 `{pid, start_time}`.
- **포트 체크로 살았는지 판단하지 마라.**
- 검사: 프로세스를 죽인 뒤 하트비트 나이가 자란다.

### P2-5 건강 벡터 API
Orca / Codex app-server / 데몬 / sentinel 각각 상태를 **이름과 함께** 반환.
- 검사: 하나를 끈 상태에서 "무엇이 죽었는지" 이름이 나온다.

### P2-6 sentinel (별도 프로세스, LLM 없음)
- 발화 조건: **하트비트 만료 AND 연결 실패** 둘 다. 각각 단독이면 침묵.
- 출력 문자열은 fixture와 **정확히 일치**. 문장 생성 금지.
- 릴레이 차단 시 `cue.dead` 마커 파일 생성.
- 검사 3개 전부 테스트로.

### P2-8 재시작 조정
- 쓰기 중 데몬이 죽었다 살아나면 태스크는 `blocked/crash`.
- `git status` 캡처가 원장에 있어야 한다.
- **워커를 자동 재개하지 마라.**

### P2-9 깨끗한 도구 홈 강제 기동
- Cue가 일회용 `CODEX_HOME`을 만든다. `auth.json` + Cue가 쓴 `config.toml`만.
  hook·MCP·plugins·skills 전부 `false`.
- 사용자 홈이나 `orca/codex-accounts/*/home`의 `hooks.json`을 상속하지 않는다.
- 어댑터는 npm shim이 아니라 **vendor 바이너리 절대경로**를 호출한다.
  검사: 경로 단정 테스트.

**P2-7(Windows 예약 작업)은 이번에 하지 마라.** 시스템 상태를 바꾼다. 설계만 문서에 남겨라.

## 절대 규칙

1. **증거 없이 완료 주장 금지.** 각 항목마다 실제로 돌린 테스트 출력이 있어야 한다.
2. 자격 증명 값을 절대 출력하지 마라. 존재 여부만 확인.
3. 테스트를 통과시키려고 검사를 약화시키지 마라. 못 하면 못 했다고 써라.
4. 기존 `probes/`와 `evidence/`를 건드리지 마라.

## 산출물

- `daemon/` — 소스 + 테스트
- `evidence/P2/p2_test_output.log` — `npm test` 전체 출력 verbatim
- `evidence/P2/p2_result.json` — 항목별 `{id, verdict: PASS|FAIL|SKIPPED, evidence, note}`
- `evidence/P2/P2_VERDICT.md` — 한국어 판정문. 실패는 실패라고 써라.

마지막에 항목별 판정 표를 한국어로 요약해라.
