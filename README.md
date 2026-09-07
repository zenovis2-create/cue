# Cue v0.1

Cue는 자연어 코딩 목표를 승인된 작업 폴더에서 실행하는 독립 Electron 데스크톱 앱입니다. Buzz는 필요하지 않으며 기본 어댑터는 `none`입니다.

## 요구 사항

- Windows 11
- Node.js 및 npm
- Codex CLI `0.153.0`과 인증이 완료된 사용자 프로필 (`%USERPROFILE%\.codex\auth.json`)

Cue는 기본 Codex 실행 파일의 SHA-256을 고정 검증합니다. 다른 `CUE_VENDOR_CODEX`를 쓰려면 해당 파일의 64자리 SHA-256을 `CUE_VENDOR_CODEX_SHA256`에 함께 지정해야 하며, 불일치 시 모델 프로세스를 시작하지 않습니다.

자격증명 값은 앱 UI·작업자 환경·원장에 기록하지 않습니다.

## 실행

```bash
npm install
npm start
```

첫 실행 시 작업 폴더 선택 창이 한 번 열립니다. 이후 흐름은 다음과 같습니다.

1. 자연어 목표 입력
2. 세 줄 요약과 실행 봉투 확인
3. 자율성 수준 선택
4. **승인하고 시작** 클릭
5. 원장에서 읽은 진행 상태·격리 도구 PID·완료 또는 막힘 결과 확인
6. 실행 중에는 **중단**으로 실제 컨트롤러와 AppContainer 작업자를 종료

실행 봉투는 승인 후 확대되지 않습니다. 실패·크래시·정책 위반은 `completed`가 아닌 `blocked`/`human_required`로 표시됩니다.

## 실행 경계

- **호스트:** Codex app-server와 모델 통신만 담당합니다. 별도의 격리된 controller cwd를 사용하며 Codex 내장 shell과 권한 요청 도구를 비활성화합니다.
- **작업자:** `cue_workspace` 동적 도구 호출마다 capability-zero Windows AppContainer를 생성합니다. 실제 명령과 파일 작업은 승인된 worktree에서만 수행합니다.
- 호출자가 `cwd`를 지정할 수 없으며 서버가 승인된 worktree로 고정합니다.
- worktree 외부 경로와 junction 우회 쓰기는 OS 경계에서 거부됩니다.
- capability-zero 작업자의 일반 소켓 접근은 OS에서 거부됩니다. 기존 P3-16 정책은 별도의 **탐지 후 중단** 계층이며 syscall 차단으로 과장하지 않습니다.

## 검증

```bash
npm test
npm run evidence:p10c:manifest
npm run evidence:p10c
npm run live:p10c
npm run evidence:p10c:stop
npm run evidence:p10c:source
```

`evidence:p10c`는 실제 Codex 모델로 서로 다른 목표 A/B를 실행하고, `live:p10c`는 실제 Electron UI에서 승인→호스트 controller→AppContainer 작업자 경로를 실행합니다. 두 명령은 모델 사용 비용이 발생할 수 있습니다. `evidence:p10c:stop`은 deterministic host-controller fixture와 실제 capability-zero AppContainer 작업자로 중단·회수를 검증하며 실제 vendor-model A/B 증거를 대체하지 않습니다.

주요 증거:

- `evidence/P10C/p10c_manifest_proof.json` — pinned Codex 실제 outbound request의 전체 tool manifest와 해시
- `evidence/P10C/p10c_live_result.json` — 서로 다른 실제 목표 A/B, 봉투, 산출물 해시, controller/worker PID
- `evidence/P10C/p10c_electron_run.json` — Electron UI 승인부터 완료 카드까지의 실기동 기록
- `evidence/P10C/p10c_electron_window.png` — 실제 완료 화면
- `evidence/P10C/p10c_npm_start_result.json` — `npm start` 창·renderer·정상 종료 확인
- `evidence/P10C/p10c_first_run_cancel.json` — 첫 workspace 선택 취소의 fail-closed 확인
- `evidence/P10C/p10c_stop_result.json` — live controller와 AppContainer worker의 중단·회수 확인
- `evidence/P10C/source_tree_manifest.json` — evidence 디렉터리를 제외한 검증 대상 source tree 결속

## v0.1 한계

- **P3-16 PARTIAL:** 기존 네트워크 정책은 탐지 후 중단 계층이며 syscall 강제로 재표기하지 않습니다. capability-zero 작업자의 별도 socket 검사는 OS 거부를 증명합니다.
- **P4-2 PARTIAL:** OS 프로세스 트리는 확인했지만 Windows `Win32_Process`가 worker cwd를 제공하지 않아 독립 OS cwd 조회는 미검증입니다.
- **P6-3 PARTIAL:** 프론트도어 종료 후 daemon adapter 전달은 검증했지만 실제 Buzz 전달은 외부 상태 변경을 피하기 위해 실행하지 않았습니다. Buzz는 Cue 앱의 필수 런타임이 아닙니다.
- **목표 관련 검증 PARTIAL:** 현재 `goal_relevant_verification`은 파일 변경형 목표의 before/after SHA-256, 기대 경로 변경, 최종 보고 상관관계를 검증합니다. 파일을 변경하지 않는 조사·요약 목표를 일반적으로 판정한다고 주장하지 않습니다.

Phase 11 retains these release limitations verbatim:

- P3-16 network is detection-only
- P4-2 `Win32_Process` does not supply cwd
- P6-3 real Buzz delivery unverified
- Worker child processes are prohibited; commands requiring nested subprocesses are unsupported. Request each executable through a separate `cue_workspace` call so Cue can resolve and verify it outside writable worktrees.
- goal verification is oriented toward file-changing goals

Phase 11 security evidence is in `evidence/P11/`. The generated post-commit
`v01_verdict.json` binds the final source manifest and independent reviews to HEAD;
it is ignored by Git because a committed file cannot contain its own commit hash.
