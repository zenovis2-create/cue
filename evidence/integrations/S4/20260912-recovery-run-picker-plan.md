# 재시작 후 관측 대상 실행 선택 — 읽기 전용 계획

범위: 구현 전 source discovery. 소스/빌드/OS 관측/모델 호출 변경 0. 기존 DB 수정·정리·재시작·자동 실행 없음.

## 확인한 기존 경로

- `app/core.mjs:961` / `core.d.mts:31`: `listNativeIdentities({runId})`, `observeNativeRecovery(...)`만 있다. 역사 run 목록 API는 없다.
- `app/native-recovery-host.mjs:44,52`: 실제 daemon DB와 현재 worktree의 canonical 경로를 host가 보유한다. `parent(runId)`가 run/task/envelope + 현재 workspace 일치를 확인한다. 제거된 과거 stage workspace를 다시 realpath하지 않는다.
- 같은 파일 `:59–85`의 `resolve()`는 identity store read, attempt/stage/parent/child/envelope/plan/session/candidate 연결을 재검증한다. `:89` 목록은 실행 ID를 이미 알아야 하며 join 후 최대64 identities; 이 join만으로 orphan/missing 기록이 없다고 단정할 수 없다.
- `daemon/migrations/024_native_execution_identity.sql`: identity.run_id는 workflow가 아니라 실제 child attempt run에 연결된다. 따라서 workflow run 목록을 identity.run_id 그대로 나열하면 잘못된 대상이다.
- `app/ipc.mjs:108`, `app/preload.cjs:14`: 기존 `cue:native-recovery`와 `window.cue.nativeRecovery` 채널 재사용 가능. 현재 list/observe operation만 허용한다.
- `app/renderer/renderer.js:58–77`: 실행 pending/activeExecution과 별개인 nativeRecoveryRun/generation이 이미 있다. 그러나 prepare/renderCard가 이를 현재 run으로 덮어쓰므로 재시작 후 선택 경로와 선택 보존이 없다. renderCard를 역사 실행 선택 수단으로 재사용하면 Stop/승인 상태까지 섞인다.

## 최소 API 및 구현 파일

1. `app/native-recovery-host.mjs/.d.mts`에 `listRecoveryRuns({})` 추가. exact empty plain DTO; renderer가 workspace/path/SQL/limit을 지정하지 않는다. 기존 current() guard를 시작·끝에 호출한다. DB closed/outer transaction/guard mismatch는 unavailable.
2. 현재 workspace에 속하는 **workflow parent run**을 run→envelope와 orchestration_plan으로 좁힌다. child stage run 제외. stage worktree를 기준으로 전체 설치 DB를 노출하지 않는다. 기존 canonical path comparison을 재사용한다(단순 substring/LIKE prefix 금지). task는 LEFT JOIN하여 상태 누락을 unknown으로 남긴다.
3. fixed recent50+sentinel1, run.rowid DESC 안정 순서. 정확한 전체 total을 약속하지 않고 `truncated`만 제공한다. 경로 정규화가 SQL에서 불가하면 현재 workspace envelope 후보를 먼저 유한 상한으로 읽고 host same() 검사; 이 경우 scanTruncated를 별도 표시하고 '전체 중 최신50'이라고 주장하지 않는다. 조회 상한/완전성을 명시해야 다른 workspace 기록이 많을 때 빈 목록을 완전한 부재로 오해하지 않는다.
4. 응답 예:
   `{version:'cue-native-recovery-runs-v1',authority:'observation-only',records:[{runId,state,recordedAttemptCount,identityRecordCount,missingIdentityAttemptCount,missingStageLinkCount,recordStatus}],truncated,scanTruncated}`.
   state는 고정 enum/unknown, runId는 기존 opaque ID validator. goal/prompt/task text/error/path/PID/session handle/subject/created_at 자유문자열은 제외한다. 날짜 필드 없이 최소 계약 유지.
5. counts는 선택된 parent의 attempts에 대해 native_identity.run_id=attempt_id를 직접 LEFT JOIN하여 구한다. stage join이 없는 identity를 숨기지 않도록 missingStageLinkCount를 별도 집계한다. recordStatus는 `recorded-unverified` / `no-recorded-identities` / `lineage-incomplete`이며 깊은 identity 검증 성공이나 현재 OS 상태를 뜻하지 않는다. 0은 '저장된 신원 없음'이지 '실행·잔여 프로세스 없음'이 아니다. 안전한 parent workspace를 정할 수 없는 orphan run은 목록에 노출하지 않으며 이 목록이 전체 DB orphan 감사라는 주장도 하지 않는다.
6. 실제 선택 후 기존 listNativeIdentities→resolve로 엄격 검증한다. corrupt/missing stage 연결이면 unavailable 상태를 보이고 자동 observe하지 않는다. 목록 자체에서는 모든 identity의 payload/guard를 반복 검사하지 않는다.
7. `core.mjs/.d.mts`는 같은 host 메서드 위임만. `ipc.mjs/.d.mts` 기존 채널에 `{operation:'runs'}` exact branch와 응답 bounded DTO validation 추가. preload는 기존 invoke 그대로여서 새 capability 불필요.
8. `renderer/index.html`, `renderer.js`: 관측 패널에 '과거 실행 읽기' 버튼과 run 선택 목록. 선택은 `selectNativeRecoveryRun(runId)`만 호출하며 list/observe도 명시적 버튼으로 유지. pending/activeExecution/lastLedgerCard/approve/stop/report/form을 수정하거나 execute/prepare/activate를 호출하지 않는다. `recoverySelectionMode:'follow-current'|'historical'`로 분리해 진행 카드 polling이 역사 선택을 덮어쓰지 않게 한다. '현재 실행으로 돌아가기'만 기존 current run으로 복귀. run 변경 시 generation 증가로 지연 목록/관측 결과를 폐기한다.

## 최소 검증 및 분리 gate

- 실제 SQLite reopen: 같은 workspace의 과거 parent를 목록에 표시; child run/다른 workspace 제외. 준비만 한 실행·identity0·missing stage·corrupt identity는 서로 구분. 안전한 parent가 없는 orphan은 노출하지 않음.
- 51개 이상/scan cap: deterministic bounds+truncation, 빈 incomplete result를 완전 부재로 표현하지 않음. raw sentinel goal/env/path/PID 필드가 JSON에 없음.
- strict DTO/getter/proxy/extra field/invalid host response 거절; total_changes 불변. OS observer spy 0, capability/evidence/cleanup writer 0.
- same DB core→IPC read, no runtime queue/approval/execute invocation. unavailable host/guard drift 응답.
- renderer JSDOM: 재시작 초기 pending=null에서 목록→선택 가능; 별도 activeExecution의 Stop 대상 그대로; poll/renderCard가 historical selection을 바꾸지 않음; 선택 A→B 뒤 늦은 A 응답 폐기. empty/lineage incomplete/corruption 한국어 상태 별도.
- backend+IPC independent gate 먼저, renderer gate 후 별도 actual Electron 읽기 전용 검증. 기존 실제 native/model allowance 재사용 금지. 신규 migration/table 필요 없음.