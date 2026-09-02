# Phase 4.5 — 기동 경로 봉인 (P4-2 / P4-4 FAIL 해소)

Phase 4에서 P4-2와 P4-4가 FAIL이다. 원인은 하나다:
**워커를 띄우는 경로가 두 개인데, 그중 하나가 원장 소유도 봉투 강제도 없다.**

- `src/codex-session.ts` → `spawnVendorCodexInAppContainer(db, owner, ...)` — 소유 O, 강제 O
- `src/tool-home.ts` → `spawnVendorCodex(path, args, codexHome, options)` — **소유 X, 강제 X**

두 번째가 살아 있는 한 Phase 3C에서 얻은 파일시스템 강제는 **우회 가능**하다.
강제층은 우회로가 하나라도 있으면 없는 것이다.

**실측 확인(claude):** `spawnVendorCodex`의 프로덕션 호출자는 **0개**다.
유일한 호출자는 `test/p2.test.ts:155`. 즉 제거 비용이 거의 없다.

## 만들 것

### S-1 단일 기동 관문
- 프로세스를 실제로 만드는 함수는 **저수준 `launchProcess` 하나**로 유지하되,
  **`launchProcess`를 모듈 밖으로 내보내지 않거나**(모듈 내부화),
  내보낸다면 **직접 호출자가 소유 spawn 래퍼뿐**이어야 한다.
- 워커 기동의 유일한 공개 API는 **원장 소유를 강제하는 시그니처**여야 한다.
  즉 `(db: Ledger, owner: SessionOwner, ...)`를 **필수 인자**로 받는다.
  소유자 없이 워커를 띄우는 공개 함수가 **존재하지 않아야 한다**.
- `spawnVendorCodex`(무소유 버전)를 **`src/`에서 제거**한다.
  순수 함수 `vendorCodexLaunchSpec` / `assertVendorBinary` / `createCleanCodexHome`은 유지 —
  이들은 프로세스를 만들지 않으므로 위험하지 않다.

### S-2 P2 테스트 재배선 (테스트를 약화시키지 말 것)
- `test/p2.test.ts:155`의 P2-9 검사(격리 `CODEX_HOME`에 `auth.json,config.toml`만 존재)는
  **의미를 그대로 유지**한 채 소유 경로로 옮긴다.
- **금지:** 이 테스트를 삭제하거나 skip 처리하거나 단정을 약화시키는 것.
  P2-9는 실제 vendor 바이너리 기동 검사다. 계속 실제로 띄워야 한다.

### S-3 아키텍처 테스트 강화 (P4-4)
- 리포지토리 전역(`src/` 전체) 검사:
  1. `child_process`의 `spawn`/`exec`/`execFile`/`fork` 직접 사용이
     **허용된 spawn 래퍼 모듈 1개 밖에서 발견되면 FAIL**.
  2. 워커를 만드는 공개 export 중 `db`/`owner`를 안 받는 것이 있으면 **FAIL**.
- 이 테스트는 `src/`만 스캔한다(테스트 자기 자신 때문에 실패하지 않도록).
- 이 테스트가 **미래의 회귀를 잡는 것이 목적**이다. 문자열 매칭이 느슨하면 의미가 없으니
  실제로 새 위반을 넣었을 때 잡히는지 **양성 대조**를 함께 넣어라
  (임시 위반 파일을 만들어 검사기가 FAIL을 내는지 확인 후 삭제).

### S-4 P4-2 프로세스 트리 독립 검증
- Phase 4의 P4-2는 "자식 PID 발표를 관찰"했을 뿐 **OS에 직접 묻지 않았다**.
- 실제 기동 후 **OS에 부모-자식 관계를 질의**해 단정하라
  (`Get-CimInstance Win32_Process`의 `ParentProcessId`, 또는 동등 수단).
- 워커의 `cwd`가 worktree임을 OS 기준으로 확인하라.
- 환경이 안 되면 **SKIPPED + 이유**. 위장 PASS 금지.

### S-5 P4-3 / P4-5 마무리 (가능한 범위)
- P4-3: 리스 큐에서 승격된 요청이 **자동으로 기동**되는 것까지 연결하고 테스트.
- P4-5: 디스패처의 spawner를 **소유·강제 경로로 고정**한다(주입으로 우회 불가).
- 못 하면 PARTIAL 유지 + 이유. 억지 PASS 금지.

## 절대 규칙
1. **기존 79개 테스트를 깨지 마라.** P1~P3 테스트 파일(`p1*`,`p2*`,`p3*`)의 단정을
   약화·삭제하지 마라. S-2의 재배선만 예외이며, 이때도 검사 강도는 유지한다.
2. **증거 없이 완료 주장 금지.** 항목마다 실제 테스트 출력.
3. 판정은 `PASS|PARTIAL|FAIL|SKIPPED`. **위장 PASS가 진짜 실패다.**
4. 작업 범위는 `C:/Users/User/cue/daemon`. 금지: `D:/AI2_WIN/AI-backup-20260505/tactics`.
   `probes/`, `evidence/P1..P4/` 기존 파일을 수정하지 마라(새 파일만 추가).
5. 시스템 상태 영구 변경 금지. AppContainer 프로파일·임시 파일은 `finally`에서 정리.
6. 자격 증명 값 출력 금지.

## 산출물
- `daemon/src/` 수정 + `daemon/test/p45.test.ts`
- `evidence/P45/p45_test_output.log` — `npm test` 전체 출력 verbatim
- `evidence/P45/p45_result.json` — `[{id, verdict, evidence, note}]`
  (id는 `S-1`..`S-5` 및 재판정된 `P4-2`, `P4-3`, `P4-4`, `P4-5`)
- `evidence/P45/P45_VERDICT.md` — 한국어 판정문

마지막에 한국어로:
① 항목별 판정 표
② **`src/`에 소유자 없이 프로세스를 만드는 공개 경로가 남아 있는지 예/아니오로 단답**
③ P4-2를 OS 프로세스 트리로 실제 확인했는지 예/아니오
