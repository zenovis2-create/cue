# Phase 3A — 봉투 + 승인 엔진 코어 (P3-1 ~ P3-8, P3-10, P3-13, P3-14, P3-18)

Cue v0.1의 심장이다. Phase 2 데몬 뼈대(`C:/Users/User/cue/daemon`)가 이미 있고 16개 테스트가 통과한다.
**기존 테스트를 깨지 마라.** 끝나고 전체가 통과해야 한다.

## 구속력 있는 전제 (Phase 1 실측, 바꾸지 마라)

1. **Codex에는 강제층이 없다.** `permissions`로 worktree를 좁혀도 승인 후 실행은 밖에 쓴다.
   네트워크 `deny`를 줘도 HTTP 200을 받았다. → 도구 응답을 강제로 세지 마라.
2. **빈 permissions 응답 = 허용(allow)으로 해석된다.** 절대 방출 금지. 거부는 `decline` 하나뿐.
3. **승인 1건 ≠ 실행 1건.** permissions 승인 1건이 후속 command approval을 삼켰다.
4. 토큰 회계는 `tokenUsage.last` / `turn.completed.usage` 두 경로뿐. **통화 환산 금지.**

## 작업 범위

`C:/Users/User/cue/daemon`. 이 밖에 쓰지 마라.
금지: `D:/AI2_WIN/AI-backup-20260505/tactics`. 기존 Orca run/task 생성·변경 금지.
`probes/`, `evidence/P1/`, `evidence/P2/` 건드리지 마라.

## 만들 것

### P3-1 정규화 봉투 + `envelope_hash`
- 봉투 자료형: `{run_id, worktree_realpath, egress[], expires_at, autonomy_level, allowed_actions[]}`.
- 해시는 **정규화 후** 계산(키 정렬, 경로 canonical realpath, 배열 정렬).
- 검사: 같은 봉투 → 같은 해시. 한 필드만 바꾸면 다른 해시. 키 순서만 다르면 같은 해시.

### P3-2 정규화 매핑은 데몬 소유, 어댑터는 원문만 운반
- `src/adapters/`는 raw 요청을 전달만 한다. 판정 로직 0.
- 검사: 아키텍처 테스트 — `src/adapters/**`가 `src/decide*`나 정책 모듈을 import 하지 않는다.

### P3-3 모르는 action = 거부 (fail-closed)
- 매핑에 없는 메서드 → `decline`. **기본값 허용 경로가 없어야 한다.**
- 검사: 무작위 미지 메서드 주입 → `decline`. switch에 default allow 없음(grep 테스트).

### P3-4 응답 변형 화이트리스트 — `accept`/`decline`/`cancel` 만
- 검사: 단위 테스트 + **소스 grep 테스트** 둘 다.
  금지 문자열: `acceptForSession`, `acceptWithExecpolicyAmendment`,
  `applyNetworkPolicyAmendment`, `scope:"session"`, `--yolo`, `--approve-for-me`,
  `--dangerously-bypass`, `-a never`.
  (테스트 파일 자체는 금지 문자열을 담아야 하므로 **`src/` 만 스캔**하도록 짜라.)

### P3-5 `permissions` 응답 빌더
- 항상 `scope:"turn"` 명시, `strictAutoReview:true`.
- `entries`는 worktree 아래 **구체 경로만**. glob 거부. 모든 `special.kind` 거부
  (`root`, `project_roots`, `minimal` 포함 — 열거를 하드코딩하지 말고 `special` 필드가
  존재하면 거부하는 방식으로).
- **빈 `entries` 응답을 방출할 수 없다.** 타입 수준에서 막아라(비어있지 않은 배열 보장).
  거부는 반드시 `decline`으로 나간다.
- 검사: 거부 케이스마다 테스트 1개 + 빈 응답 불가 테스트 + grep 테스트.

### P3-6 요청 전 검사기
항목마다 테스트 1개:
- `cwd` 불일치 → decline. `cwd`가 null이면 → decline.
- `command == null` → decline.
- `additionalPermissions` 별도 검사(봉투 밖이면 decline).
- `fileChange`의 `grantRoot`가 worktree 밖 → decline.
- `writeStdin`은 부모 명령 수락과 **독립** 판정.
- `chatgptAuthTokens/refresh` → 인증 게이트(자동 승인 금지).
- `item/tool/*`, `mcpServer/elicitation/request` → decline.

### P3-7 재생 방지
- Phase 2의 `approval_event` 유니크 인덱스를 실제로 쓴다.
- 같은 튜플 재전송 → `decline` **+ 원장에 경보 행**.
- 검사: `approval_id`가 null인 경우에도 재생이 막힌다.

### P3-8 봉투 수명
- 실행 종료 또는 `expires_at` 중 빠른 쪽에 소멸. 다음 실행이 상속하지 않는다.
- 검사: 만료 후 도착한 요청은 봉투 안 내용이어도 `decline`.

### P3-10 `payload_class`는 Cue가 바이트를 보고 분류
- 도구가 신고한 타입 필드를 **믿지 마라**. 실제 바이트를 본다.
- 못 보는 전송(불투명 바이너리, 암호화된 페이로드)은 거부.
- 검사: 도구 신고 필드를 읽는 코드 경로가 없다(아키텍처/grep 테스트).

### P3-13 위험 요청만 `cancel`
- `cancel` 허용 사유 3개뿐: 자격증명 요청, worktree 밖 `grantRoot`, 못 보는 전송.
- 검사: 그 외 어떤 경로도 `cancel`을 내지 않는다(전 경로 열거 테스트).

### P3-14 금지 플래그 실행 프로파일
- 어댑터가 만드는 codex 명령줄에 금지 플래그가 없다.
- codex는 `-a on-request`로 실행된다.
- 검사: 생성된 argv 배열 단정 테스트 + grep 테스트.

### P3-18 도구 등급 = `advisory` 고정
- 어댑터 레지스트리에 `{ name, enforcement_capable: false }`. Codex는 **반드시 false**.
- **도구의 권한 응답을 근거로 Cue의 강제 검사를 건너뛰는 코드 경로가 없어야 한다.**
- 검사: 아키텍처 테스트 — 강제 검사 호출이 도구 종류로 분기하지 않는다.

## 이번에 하지 않을 것
P3-9(realpath 경계), P3-11, P3-12, P3-15, P3-16(네트워크 게이트), P3-17(승인≠실행 회계).
다음 배치다. **건드리지 마라.**

## 절대 규칙
1. **증거 없이 완료 주장 금지.** 항목마다 실제 테스트 출력이 있어야 한다.
2. 테스트를 통과시키려고 검사를 약화시키지 마라. 못 하면 **FAIL이라고 써라.**
3. 자격 증명 값 출력 금지. 존재 여부만.
4. 기존 16개 테스트가 계속 통과해야 한다.

## 산출물
- `daemon/src/` 확장 + `daemon/test/p3a.test.ts`
- `evidence/P3/p3a_test_output.log` — `npm test` 전체 출력 verbatim
- `evidence/P3/p3a_result.json` — `[{id, verdict: PASS|FAIL, evidence, note}]`
- `evidence/P3/P3A_VERDICT.md` — 한국어 판정문

마지막에 항목별 판정 표를 한국어로 요약해라.
