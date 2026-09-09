# Phase 3C — 하이브리드 강제층 (P3-9 / P3-16 재시도, P3-15 / P3-17 배선)

Phase 3B에서 P3-9·P3-16이 **정직하게 FAIL**했다. 원인은 명확하다:
argv 사전검사와 `NODE_OPTIONS` 몽키패칭은 **Node 프로세스 안에서만** 작동하고,
PowerShell·curl·vendor codex.exe·임의 자손 프로세스에는 효력이 없다.
**판정층을 강제층이라고 불렀던 것이 결함이다.**

사용자 결정: **하이브리드**. 파일시스템은 OS 수준으로 진짜 강제하고,
네트워크는 강제를 시도하되 안 되면 탐지로 내려간다.

## 이미 실측된 사실 (내가 직접 확인함, 2026-09-02)

- 이 머신은 **관리자 아님** (`net session` 실패). 따라서 **새 사용자 계정 생성 불가**.
- 그럼에도 **비관리자로 `icacls` DENY ACE 설정이 성공한다** (자기 소유 디렉터리).
- 그 DENY ACE는 **PowerShell 자식 프로세스의 쓰기를 실제로 차단했다** (`PS_WROTE=no(BLOCKED)`).
  → **OS 경계는 비관리자로도 도달 가능하다.** 이게 이번 배치의 출발점이다.

## 목표

워커 프로세스에 **자기 자신의 신원**을 주고, 그 신원에 대해 OS가 경계를 강제하게 한다.
Cue 데몬 자신의 권한은 줄이면 안 된다(데몬은 원장을 써야 한다).

### 사다리 — 위에서부터 시도하고, 되는 곳에서 멈춰라

**1단계: AppContainer 신원 (최선)**
- `CreateAppContainerProfile` 로 Cue 전용 AppContainer SID 생성 (비관리자 가능).
- 워커를 `STARTUPINFOEX` + `PROC_THREAD_ATTRIBUTE_SECURITY_CAPABILITIES` 로 그 SID 하에 기동.
- worktree에만 그 SID의 쓰기 ACE 부여. 그 외에는 부여하지 않음 → **밖은 기본 거부**.
- **`internetClient` capability를 주지 않는다** → 네트워크가 OS 수준에서 막힌다.
  이게 되면 P3-9와 P3-16이 **동시에** 해결된다.
- Node에서 이걸 하려면 PowerShell + P/Invoke(`Add-Type`) 래퍼가 현실적이다.

**2단계: DENY ACE 봉쇄 (차선, 파일시스템만)**
- 1단계가 안 되면: 워커가 건드릴 수 있는 상위 경로들에 현재 사용자 DENY ACE를 걸고
  worktree에만 ALLOW를 되돌린다.
- **주의: 이건 Cue 데몬 자신도 막는다.** 데몬 원장/DB는 반드시 DENY 범위 **밖**에 두어라.
- 적용 범위를 봉투 수명과 묶어라. 실행 종료 시 **반드시 원복**한다(finally 보장).
- 네트워크는 이 단계로 못 막는다 → 3단계로.

**3단계: 탐지 + 즉시 중단 (하한선, 네트워크용)**
- 막지 못하면 **놓치지는 마라.** 위반을 탐지하면 즉시 워커를 죽이고
  `blocked/violation` 으로 전이. **`succeeded` 전이 금지.**
- 네트워크는 이 단계가 유력하다. 그렇다면 그렇게 기록해라.

## 판정 규칙 (엄격)

- **1·2단계로 실제 차단에 성공** → `PASS`, 어느 단계인지 명시.
- **3단계 탐지만** → `PARTIAL`. **PASS라고 쓰지 마라.**
  "막았다"와 "알아챘다"는 다른 말이다.
- 아무것도 안 되면 `FAIL`.
- Phase 3B의 두 실패 테스트(`blocks a runtime-computed outside path in a non-Node worker`,
  `blocks a non-Node worker from a real local socket when egress is empty`)를
  **그대로 유지한 채** 통과시켜라. **테스트를 약화시키거나 삭제하면 그 자체가 실패다.**
- 검증은 반드시 **non-Node 워커**(PowerShell 또는 vendor 바이너리)로. Node 안에서만 되는 건 무의미하다.

## 함께 고칠 것 (3B에서 호출자 없음으로 FAIL)

### P3-15 — 완료 카드에 실제 배선
- `completionApprovalLabel` 을 실제 완료 경로에서 호출한다. 프로덕션 호출자가 존재해야 한다.
- 검사: 호출자 경로를 지나는 통합 테스트 1개.

### P3-17 — 실행 이벤트를 실제 워커 수명주기에 배선
- `recordExecution` 을 실제 워커 실행 지점에서 호출한다.
- 검사: 실제 워커를 띄우고 원장에 실행 행이 쌓이는 통합 테스트 1개.

## 절대 규칙
1. **위장 PASS 금지.** 3B에서 정직한 FAIL을 냈던 그 기준을 유지해라. FAIL/PARTIAL은 발견이다.
2. **시스템 상태를 영구 변경하지 마라.** 방화벽 규칙 영구 등록 금지.
   AppContainer 프로파일과 ACE는 테스트 종료 시 정리해라(`finally`).
3. Cue 데몬 자신의 DB/원장 쓰기 권한을 깨뜨리지 마라. 깨지면 즉시 원복.
4. 작업 범위는 `C:/Users/User/cue/daemon`. 금지: `D:/AI2_WIN/AI-backup-20260505/tactics`.
   `probes/`, `evidence/P1/`, `evidence/P2/` 건드리지 마라.
5. 기존 58개 통과 테스트를 깨지 마라.
6. 관리자 권한을 요구하는 경로는 **선택하지 마라**(이 머신은 비관리자다).

## 산출물
- `daemon/src/` 확장 + `daemon/test/p3c.test.ts` (3B 테스트는 유지)
- `evidence/P3/p3c_test_output.log` — `npm test` 전체 출력 verbatim
- `evidence/P3/p3c_result.json` — `[{id, verdict: PASS|PARTIAL|FAIL, tier, evidence, note}]`
- `evidence/P3/P3C_VERDICT.md` — 한국어 판정문

마지막에 한국어로: 항목별 판정 표 + **어느 사다리 단계에 도달했는지** + **무엇을 여전히 막지 못하는지** 한 문단.
