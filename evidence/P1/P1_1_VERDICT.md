# P1-1 판정 — Codex 승인 실왕복 (2026-09-02)

체크리스트 P1-1: "disposable worktree에서 app-server를 띄우고, 실제 `item/commandExecution/requestApproval`을 받아 `accept` 1건·`decline` 1건을 보내고, 원문 요청/응답/후속 행동을 기록한다."

## 실행 사실

- 프로브: `probes/p1_1_approval_roundtrip.py`, 어댑터 `probes/appserver.py`
- 바이너리: `@openai/codex-win32-x64` vendor `codex.exe` (`codex` shim은 stdio JSON-RPC를 프록시하지 않음 → **직접 vendor exe 호출 필수**)
- worktree: `D:\Temp\User\cue-p1-1-ii7yppi7` (임시, 종료 시 삭제)
- thread/start: `approvalPolicy="untrusted"`, `approvalsReviewer="user"`
- 원장: `evidence/P1/p1_1_ledger.log` (in/out 전 라인 verbatim), 구조화 결과 `evidence/P1/p1_1_result.json`

## 관측 결과

승인 요청 **2건 실제 수신**. 응답 `{"decision":"accept"}` 1건, `{"decision":"decline"}` 1건 전송.

| seq | itemId | 우리 결정 | 실제 결과 |
|---|---|---|---|
| 1 | `exec-81748864…` | accept | 실행 **실패** — `CreateProcess { message: "Rejected(\"Failed to create unified exec process: orchestrator_helper_launch_canceled: ShellExecuteExW failed to launch setup helper: 1223\")" }` |
| 2 | `exec-93536cab…` | decline | 실행 **차단** — `CreateProcess { message: "Rejected(\"rejected by user\")" }` |

turn 최종 메시지: `` `echo cue-probe-first` — rejected; `echo cue-probe-second` — rejected. ``

## 판정

**P1-1 = PARTIAL. 하드 게이트 미통과.**

- **decline 경로: PASS.** 우리 `decline`이 프로세스 생성을 실제로 막았고 원인 문자열이 `rejected by user`로 우리 결정에 직접 귀속된다. 강제층이 판정층을 따랐다는 end-to-end 증거.
- **accept 경로: 미확인(UNPROVEN).** 승인은 통과했으나 명령이 실행되지 않았다. 차단 원인은 Cue의 결정이 아니라 Windows 측 `ShellExecuteExW` 코드 **1223(ERROR_CANCELLED)** — codex의 unified-exec setup helper 실행(UAC 승격 추정)이 취소됨. 비대화형 stdio 컨텍스트에서 UAC 프롬프트를 띄울 수 없는 것이 유력 원인.
- 설계의 fail-closed 원칙상 이 결과는 **안전 측 실패**다. 그러나 "승인하면 실제로 실행된다"는 절반이 증명되지 않았으므로 P1-1을 완료로 표기할 수 없다.

## 부수 관측 (설계 반영 필요)

1. `hook/started` / `hook/completed`가 승인 이전에 먼저 발생하며, 그 소스가 사용자 홈이 아닌 `AppData\Roaming\orca\codex-accounts\<uuid>\home\hooks.json`이다. **승인 요청보다 앞서 실행되는 코드 경로가 존재**한다 — 봉투 강제층 설계에 hook 계층이 빠져 있다.
2. `permissionRequest` 이벤트가 별도 hook으로 존재 → 승인 결정이 hook에 의해 선점될 수 있는지 별도 프로브 필요.
3. app-server 기동 시 MCP 클라이언트가 `http://127.0.0.1:8090/mcp` 로 반복 연결 실패. 프로브 격리를 위해 **깨끗한 `CODEX_HOME`으로 재실행**해야 환경 오염을 배제할 수 있다.
4. `codex` npm shim은 app-server stdio를 중계하지 않는다(`initialize` 무응답). 어댑터는 vendor 바이너리 경로를 고정해야 한다.

## 다음 조치

- P1-1a: 깨끗한 `CODEX_HOME`(hook 없음, MCP 없음)으로 재실행하여 accept 경로가 1223 없이 실행되는지 확인.
- 실패 지속 시: 로컬 `unified_exec`/sandbox 설정을 바꿔 helper 승격을 회피하는 경로를 찾고, 그래도 안 되면 Codex를 **enforcement-only**로 내리는 판단을 @user에게 올린다.
