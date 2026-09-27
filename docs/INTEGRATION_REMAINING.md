# Cue 남은 통합 작업

**batch102 후속:** [프로젝트/세션 관리](integration/PROJECT_SESSION_MANAGEMENT.md)는 임시 실제 Electron에서 합성 선택/확인에 따른 전환·새 Core 열기와 합성 held lease 거부까지 확인했다([검증](../evidence/integrations/S3/20260923-native-project-workflow/RESULTS.md)). 세션 검색은 추가됐지만 사용자 이름 변경/공급자 대화 재접속은 제공하지 않는다. 실제 OS 선택·사용자 확인/재시작, 준비된 승인과 활성 공급자 실패 복구, 키보드·스크린리더/대표 사용자 인수와 독립 코드 검토가 남는다. 최신 전체 테스트는 batch102에서307파일2,232pass·기존10skip으로 완료했지만 실물 인수를 대신하지 않는다. live 계정·모델 자격과 실측 개선은 별도 승인·예산 없이는 미완료다. 원본33완료/11미완료 유지.

**batch100 UI 후속:** [첫 workspace/session shell](integration/WORKSPACE_SESSION_SHELL.md)은 현재 프로젝트의 과거 run 탐색·화면 분리까지만 제공한다([선정28파일203pass/정적 화면](../evidence/integrations/S3/20260923-workspace-session-shell/RESULTS.md); 실제 Electron fixture timeout 보존). 다음은 프로젝트 추가/전환을 위한 Core·daemon·원장 소유권의 안전한 teardown/reopen과 설정 저장, 앱 소유의 다중 run 사용자 세션/검색·보관·이어쓰기의 새 승인 계약, 그리고 실제 Electron·접근성 인수다. 기존 single-worktree를 새 UI만으로 다중 프로젝트 지원으로 표시하지 않는다. 원본33완료/11미완료 유지. 아래 batch 문단들은 당시 기록이다.

**현재 batch99 (2026-09-23): 동결 작업셋의 실행 직전 staging seed 확인을 불변 원장 관측으로 남긴다.** [가이드](integration/STAGED_EVALUATION_INPUT_GUARD.md), [결과](../evidence/integrations/S5/20260923-staged-input-observation/RESULTS.md). 검사와 원장 기록은 실행 프로세스가 실제 소비한 바이트의 증명이 아니므로 measured fact의 executed-input matches:true로 쓰지 않는다. **다음은 프로세스 소비 입력의 독립 근거 및 실제 verifier 품질·queue-through-cleanup 시간·완전한 환경·계정/가격/최종 비용 생산자와 기본 앱 measuredFactHost**다. 원본33완료/11미완료; batch99의 연관41파일352pass와 별개로 전체 `npm test`는 timeout 중단·P12 한 건 실패를 보존했고 단독 재실행은 통과했다. 완결된 전체 후속 회귀, 독립/실물 인수 및 예산 승인 후의 실제 공급자 평가도 별개다. 아래 과거 batch 문단은 당시 기록이다.

**현재 batch98 (2026-09-23): [동결 작업셋 prelaunch staging guard](integration/STAGED_EVALUATION_INPUT_GUARD.md)를 추가했다.** 해당 native 구현 attempt에서 goal/전체 seed/검사 계약과 active stage를 시작 직전에 대조한다. [검증](../evidence/integrations/S5/20260922-staged-input-guard/RESULTS.md)은41파일344pass/build0/실패·skip0, 실제 native helper+합성 lineage의 자체 검사다. 결과는 point-in-time이며 실행 프로세스의 실제 소비 입력이나 `measuredFactHost`/trial을 만들지 않는다. **다음 코드 작업은 이 경계의 durable observation과 프로세스 소비·검증자 결과/시간·계정/가격/최종 비용을 별도 producer로 묶는 것**이다. 전체 suite·독립 검토·실물 사용자/공급자 자격과 실제 paired 평가도 남는다. 원본33완료/11미완료·실제 호출 제한 유지. 아래 batch 문단들은 당시 기록이다.

**현재 batch97 (2026-09-22): [로컬 환경·검사 척도 생산자](integration/LOCAL_EVALUATION_CONTRACTS.md)를 기본 앱에 연결했다.** 실제 OS/런타임/디스크 코드 바이트 관측, 불변 계약 저장, 명시적 화면 기록/참조 복사를 제공한다. 환경 complete:false·품질 미측정·trial 불가를 유지하며 기본 앱 measuredFactHost는 여전히 없다. [검증](../evidence/integrations/S5/20260922-local-contract-producer/RESULTS.md)은37파일326pass/build0/실패·skip0, 자체 검사다. **다음 생산 경로는 승인된 목표·초기 파일·검사 계약을 실제 attempt staging/launch와 결합하는 실행 입력 증거**다. 그 뒤 실제 verifier 품질, queue/cleanup 포함 시간, 실행 환경·계정/가격·최종 비용 관측을 연결해야 한다. 로컬 snapshot을 실행 문맥 전체나 실제 평가 성과로 계산하지 않는다. 원본33완료/11미완료·Qwen OFF·구독4/4 소진·실제 호출0 유지. 아래 batch 문단은 당시 기록이다.

**현재 batch96 (2026-09-22): [측정 비교 전용 목록·IPC·UI](integration/MEASURED_COMPARISONS.md)를 연결했다.** 명시적 생성, workspace-scoped 목록, 저장 당시 수치/전체 분모/누락과 별도 현재 증거 재검사를 제공한다. [검증](../evidence/integrations/S5/20260922-measured-comparison-ui/RESULTS.md)은36파일316pass/build0/실패·skip0, 합성 측정과 실제 IPC/Core/SQLite/JSDOM의 자체 검사다. **다음 코드 우선순위는 production 실행 입력/품질/시간/환경/계정·가격·비용 producer와 기본 앱 measuredFactHost 구성**이다. 기본 앱에 host가 없으면 새 측정 비교 생성은 unavailable이고, 전용 화면 완성을 실제 측정 완료로 계산하지 않는다. 실물 UI 인수·현재 전체 회귀·독립 검토 및 승인된 실제 평가도 남는다. 원본33완료/11미완료·Qwen OFF·구독4/4 소진·실제 호출0 유지. 아래 문단들은 각 batch 당시 기록이다.

**현재 batch95 (2026-09-22): [측정 비교 snapshot backend](integration/MEASURED_COMPARISONS.md)를 구현했다.** 명시적 등록 cohort, 최신 관측/fact 선택, 전체 분모·누락 보존, 부분집합 성과 보류, 불변 역사 조회와 현재 상태 재검사를 Core에 연결했다. [검증](../evidence/integrations/S5/20260922-measured-comparison/RESULTS.md)은33파일296pass/build0/실패·skip0이며 합성 측정의 자체 검사다. **다음 코드 작업은 전용 snapshot 목록/IPC/UI와 생산 측정 호스트 연결**이다. 기존 화면에 측정 비교가 이미 연결됐다고 표시하지 않는다. 원본33완료/11미완료·실물 호출 제한 유지; 아래 batch 문단들은 당시 기록이다.

**현재 batch94 (2026-09-22): [측정 fact→trial 변환 backend](integration/MEASURED_TRIAL.md)를 구현했다.** 완전한 저장 측정만 원래 비교용 계약으로 파생하고 누락·변조·청구 변경·미정리 실행은 거부한다. Core workspace 경계, fixture 출처, 실패/취소/unknown, 비용 분할을 보존한다. [검증](../evidence/integrations/S5/20260922-measured-trial/RESULTS.md)은32파일277pass/build0/실패·skip0, 합성 호스트를 사용한 자체 검사다. **다음 코드 작업은 생산 측정 호스트와 새 변환 결과의 명시적 cohort/비교 snapshot/UI 연결**이다. 기존 outcome-only 행이나 미측정 UI를 이미 변환된 것으로 표시하지 않는다. 원본33완료/11미완료와 실물 호출 제한 유지; 아래 batch들은 당시 기록이다.

**현재 batch93 (2026-09-22): [측정 계약 선행 결함](integration/MEASUREMENT_CONTRACTS.md)을 수정했다.** 정상 배열·중첩 동결·호스트 응답 snapshot·불변 ID/revision 재생·재진입/동시 등록과 전체 계약 참조 검증을 구현했다. [검증](../evidence/integrations/S5/20260922-measurement-contract-integrity/RESULTS.md)은 수정 전10fail, 최종31파일249pass/build0/실패·skip0이다. 이는 측정 생산자와 fact→trial 연결을 완료한 것이 아니다. 다음 코드 우선순위는 여전히 실행 입력/실측 생산자·앱 measuredFactHost 구성과 검증된 fact 변환이다. 실제 서비스 예산 제한과 별개로 구현을 계속할 수 있다. 원본33완료/11미완료 유지; 아래 수치는 각 batch 당시 기록이다.

**현재 batch92 (2026-09-22): [고정 계획 기준선/사용자 확인](integration/MANUAL_BASELINE.md) 연결을 구현했다.** batch91의 unpinned native 정책↔global-pin 기준선 불일치는 명시적인 task별 고정 planDigest 변형으로 해소했다. native/선택기 조건은 완화하지 않고 고정 구현·독립 검증 조합만 지원한다. 기준선 전용 화면 동작, host-derived 정책/후보, 기본 취소 시스템 확인, 만료/실행 변경 후 거부, 원자 등록/재열기를 연결했다. [검증](../evidence/integrations/S5/20260922-fixed-plan-baseline/RESULTS.md)은38파일257pass/build0/실패·skip0, 자체 검토 및 합성 확인 응답이다. 실제 사용자 인수·실측을 완료한 것은 아니다. **다음 코드 우선순위는 실행 입력/실측 생산자와 fact→trial 변환이다.** 원본33완료/11미완료와 실제 호출 제한은 유지한다. 아래 batch91/90 수치는 당시 기록이다.

**batch91 (2026-09-22) 추가 진행:** [수동 기준선 결과 저장/검증 수정](../evidence/integrations/S5/20260922-baseline-outcome/RESULTS.md)으로 실제 정책 모드와 manual-baseline 비교군의 혼동을 해소하고, 선언/enrollment 전체 일치·권한 확인 전 preflight·확인 후 IMMEDIATE 잠금 재검사·재진입 방지를 구현했다. 최신 결합28파일206pass/build0, 자체 검토다. 기준선 UI는 아직 미완료다. 특히 현재 native 호스트는 **unpinned 정책만 허용**하고 기준선 저장소는 **pinned 후보를 요구**하므로, 실제 수동 기준선 실행 구성과 사용자 명시적 확인 UI를 함께 연결해야 한다. 승인 callback만 true로 만들어 이 불일치를 우회하면 안 된다. 원본33완료/11미완료를 유지한다.

## 현재 실행 안내 — batch90, 2026-09-22

**33개 완료/11개 미완료는 넓은 원본 상위 조건의 개수이며, 개선할 코드가 없다는 뜻이 아니다.** 아래 batch78 이하 문단은 당시 기록이다. 완료 여부는 최신 `INTEGRATION_CHECKLIST.md`를 따른다.

최근 직접 구현: Claude 취소 결과 확정/명시적 설정 전달(batch86–87),8개 동결 mini-workload와 준비 명령(batch88), 전체 회귀296파일2,055pass(batch89). 이번 [batch90](../evidence/integrations/S5/20260922-workload-app-bridge/RESULTS.md)은 전체 작업셋을 실제 화면→IPC→Core→SQLite로 등록하도록 연결하고 재시도 시각 충돌을 수정했으며 읽기 전용 초기 파일 검사를 추가했다. 최신 변경의 검증은44파일269pass/기존1skip/build0이다. batch89 전체 회귀는 이 변경 전의 기록이다. 자체 검토이며 독립 검토를 대신하지 않는다.

### 호출 없이도 계속 구현할 작업

1. **실행 입력·측정 생산자:** batch97의 로컬 환경/척도는 complete:false이며 batch98의 staging 초기 입력 검사는 실행 직전 시점별 안전 게이트다. 다음은 durable prelaunch observation과 실제 프로세스 소비 입력의 구분, verifier 품질·queue/cleanup 포함 시간·완전한 실행 환경·계정/가격·재시도/검증/인계 비용의 출처와 기본 앱 measuredFactHost를 연결한다. 현재 검사 결과를 measured-fact matches:true로 자동 승격하지 않는다.
2. **측정 비교의 생산 연결/인수:** batch94의 fact→trial, batch95의 불변 비교 backend와 batch96의 전용 bounded 목록/안전한 IPC/UI는 구현됐다. 남은 것은 실제 producer/기본 앱 host를 통한 사용과 네이티브 화면 인수다. 기존 outcome-only projection의 trial:null은 유지하며 부분 측정의 전체 분모를 줄이거나 역사 snapshot을 현재 자격으로 표시하지 않는다. 대표 workload 선택과 실제 paired holdout 성과는 별도 승인/증거가 필요하다.
3. **수동 기준선의 남은 범위:** batch92가 현재 보호된 고정 조합을 기준선으로 선택/확인하는 desktop 경로를 구현했다. 임의 후보/모델 조합 편집은 미지원이며 새 native 확인 화면의 실제 사용자 인수는 대기다. 테스트 callback을 실제 사용자 선택 증거로 계산하지 않는다. 실제 기준선과 대표 workload의 실측은 아래 승인·관측 범위에 남는다.
4. **Claude production 연결:** 비활성 실행기와 설정 전달은 있지만 실제 authorized-session/account/config 관측 생산자와 후보 admission 연결이 없다. 파일 존재나 요청 값을 되돌려주는 callback을 인증 증거로 사용하지 않는다.

### 실제 권한·관측이 있어야 마무리할 작업

- 현재 source에 대한 실제 공급자/계정/격리·정리 자격, 원격 종료와 최종 청구 확인.
- 사용자가 선택한 실제 수동 기준선, 대표 작업셋 검토, 네 모드의 짝지은 평가/holdout 실측 및 개선 판정.
- 최근 변경의 독립 검토, 필요한 실제 UI/릴리스 인수. 기존 실패 gate의 소진된 범위를 이름만 바꿔 재실행하지 않는다.

Qwen OFF와 구독4/4 소진은 유지한다. 새 실물 호출에는 범위·예산 승인이 필요하지만, 위 코드 구현 전체가 예산 승인까지 정지되는 것은 아니다. [사용법](integration/FROZEN_EVALUATION_WORKLOAD.md)에는 새 manifest 가져오기와 `verify` 명령을 기록했다.

**최신 batch78 (2026-09-17):** 원본 44개 중 33개 완료, **11개 미완료**다. S0-01을 [독립 검토](../evidence/integrations/S0/20260917-identity-auth-protocol/REVIEW.md)로 닫았다. Codex 실행 파일 SHA의 보류가 해제됐다: npm published integrity와 SLSA provenance v1 attestation이 같은 tarball digest를 가리키고 그 tarball의 `codex.exe`가 설치 바이트와 동일하며 Authenticode 서명자는 `OpenAI OpCo, LLC`다. 핀을 `be96b992…`로 갱신했고 `p10c-manifest` 게이트가 실제 0.154.0 app-server로 통과한다. 현재 소스 전체 회귀는 269/269 파일·1772 pass·0 fail·9 skip·exit 0이다. 실패 15건은 로직 회귀가 아니라 stale 소스 텍스트 가드 3건과 하네스 예산이 측정 대상 자체 마감보다 짧았던 경우들, 그리고 `p11-electron-proof.mjs`의 고정 inspector 포트가 자기 TIME_WAIT와 충돌한 결함 1건이었다. 회귀 통과는 실측·독립 리뷰·출시 인수를 대신하지 않는다. 구독 호출 예산은 새 승인이 필요하고 Qwen OFF를 유지한다.

**batch77 (2026-09-16):** 원본 44개 중 32개 완료, 12개 미완료다. 이번 native 실행 증거·계정 관측 보완은 하위 구현이며 추가 상위 항목 완료로 계산하지 않는다. 구독 호출4/4 소진과 Qwen OFF를 유지한다.

[실행 결과·정리·파일 검사 독립 검토](../evidence/integrations/S1/20260916-native-authorities/REVIEW.md): 실제 native 실행기가 발급한 정확한 결과만 migration050에 저장하고, 저장 실패에서는 완료를 거부한다. 프로세스 생성 identity·소유 자원·역할·검증 모드를 대조한다. 기반6파일22/22·migration2/2, 별도 실제 실행기 경로20/20·기존 회귀35/35를 통과했다. 예상 hash/길이 검사는 명시적으로 선택하는 기계적 계약이며 일반 코딩 목표의 의미 검증을 대신하지 않는다.

[현재 runtime 측정 검토](../evidence/integrations/S1/20260916-native-provider-subject/REVIEW.md): 고정한 Codex 실행 파일·런타임·경계·검사 파일과 Windows 버전을 실제 바이트에 묶는다. 집중2/2·기존 측정11/11을 통과했다. 이 측정은 인증·자격이 아니며 필요한 source/probe 파일이 없는 배포 패키지는 사용할 수 없다. 새 인증 발급기와 권한 구성기의 revision은 별도 결합이 필요하다.

[계정 관측 수정 이력](../evidence/integrations/S1/20260916-native-account-observation/REVIEW.md)과 [서비스 관측 최종 검토](../evidence/integrations/S1/20260916-native-service-authentication/REVIEW.md): 정상 알림·응답 크기·종료 직전 무효화 결함을 수정했다. 선택한 정확한 프로필·계정·설치·현재 subject·발급 코드·유효 시간을 결합하고 다른 프로필의 증거 재사용을 거부한다. 최종 결합12/12는 오프라인 합성 응답 검사다. 특정 서비스 요청의 인증 관측을 모델 사용 권한·capability·쿼터·청구·실제 계정 확인으로 확대하지 않는다.

[설치 결합 회귀 수정](../evidence/integrations/planning/20260916-progress-reconcile-77/PROVIDER-BINDING-REVIEW.md): 필수 실행 resolver가 빠진 오래된 테스트 설정을 수정하고 누락 거부도 검사해2/2를 통과했다. 실제 공급자 실행은 없었다. 지정 runtime/evaluation 계약은 별도33/33을 통과했으며 전체 npm test나 출시 인수 통과를 뜻하지 않는다.

[첫 권한 구성 시도](../evidence/integrations/S1/20260916-native-authority-composition/RESULTS.md)와 [후속 시도 결과](../evidence/integrations/S1/20260916-native-authority-implementation/RESULTS.md): 외부 정리/실행 권한 주입과 미연결 최종 인수 문제가 남은 초안은 제거했다. 선언·검사 파일도 원래의 부재 상태로 복구했으며 부정 입력 검사2/2를 구현 완료로 계산하지 않는다. 실제 Core·staging·원장·파일 게시를 잇는 고정 권한 구성기 및 보호 setup/시작 연결은 코드 작업으로 남아 있다.

[컴파일 후 실제 로딩 검토](../evidence/integrations/planning/20260916-progress-reconcile-77/BUILD-IMPORT-REVIEW.md): source와 dist의 깊이 차이로 생긴 잘못된 import를 빌드에서 정확히 보정했다. 설치 identity 발급기는 복제하지 않는다. 실제 Node import와 관련 회귀4파일17/17을 통과했으며 이전 컴파일 지문은 이 수정 전의 기록으로 보존한다.

[현재 정적 구조 보고서](../evidence/integrations/S7/20260912-current-source/generations/445049e6571c308317ad748fd92f17c8f6402d59d9007ccb1b73b0fd4cf02e54/cue-current-source.html)는 198 JS/TS 파일·464 import 연결이다. [이전 batch76 판정](../evidence/integrations/planning/20260916-progress-reconcile-76/ROOT-REVIEW.md)을 보존한다. 로컬 Qwen OFF·출처 불명 Codex SHA 보류·GOAL usageLimited를 유지한다. 실제 공급자 자격·baseline/holdout 네 모드 개선 및 전체 출시는 미완료다.

2026-09-16 기준. 이 문서는 [통합 체크리스트](INTEGRATION_CHECKLIST.md)의 미완료 항목을 정리한 실행 안내다. 체크리스트가 완료 판정의 기준이며, 아래 목록을 작성한 것만으로 구현이나 실측이 완료되지 않는다.

현재 원문 상위 미완료 항목은 11개다. 각 항목에는 이미 검증된 하위 기능도 포함되므로 전체 미구현 개수나 예상 작업량으로 해석하지 않는다.

최근 [초기 기본 후보 호스트 연결](../evidence/integrations/S2/20260915-initial-default-host/review.md)은 독립 결합6파일94/94·build0, 최종 문구 수정 후 Core5/5 재검증(중복 집계하지 않음)로 검증했다. 주입된 호스트를 사용한 드라이버/Core 검증이다. 실제 공급자 통계·가격 수집, 배포 호스트의 설정 공급, 사용자가 설정을 편집하는 UI/IPC, 실물 자격은 남아 있다. 탐색 승인·실행 요청 연결은 아래 최신 독립 검토로 완료했다. 로컬 모델은 계속 보류한다.

[전체 실행 목록](integration/REMAINING_EXECUTION_MAP.md)은 원래 44개 항목을 추적한다. [최신 독립 검토](../evidence/integrations/S2/20260915-exploration-consent-review/review.md) 최종 독립10파일151/151·build0·migration042 새 DB/재시작 및 보호 장치 손실 거부 검증로 S2-05(초기 기본 선택/별도 탐색 예산)와 A05(부분 결과의 허위 완료 거부)를 닫았다. 실제 관측·도구 자격·출시 단계와 구분한 완료 판정이다.

**이전 batch64 기록 (당시 33개 미완료):** 원래 조건에 따라 S0-02/S2-01/S2-04/S4-02/S4-04/S5-02/S5-06/A02/A07을 닫아 상위 미완료는 **33개**다. [복구·완료 증거 검토](../evidence/integrations/S4/20260915-recovery-branch-completeness/review.md)의 독립5파일95/95·build0와 [원래 완료 조건 감사](../evidence/integrations/planning/20260915-original-contract-audit/review.md)의 별도10파일100/100을 통과했다. 새 기능 불일치·쿼터 대체 fixture는 실패/후보/비용/재생 기록을 확인한다. [출시 표시 검토](../evidence/integrations/release/20260915-readiness-truth-correction/review.md)는 문서만으로 자격·효율 입증을 선언하던 보고서 결함을 보정해 S0~S4/S5/S6~S7을 독립 표시한다. [도구 등록 감사](../evidence/integrations/planning/20260915-reuse-original-contract-audit/review.md)로 요청 9종의 비활성 제품·역할·미지원 조건 등록을 확인했다. 실제 도구 자격·실측 개선·전체 출시는 미완료다. 특히 인계 비용의 권위 있는 수집(S2-03/S5-03), 계정 승인 identity의 실행 연결(A06), 최종 파일의 경합 방지(S3-03), 검증된 정책 승격/복원(S5-07)은 구체적인 구현 공백으로 남긴다. 로컬 모델은 계속 보류한다.

## 다음 구현·검증 순서

1. [초기 기본 후보 엔진](../evidence/integrations/S2/20260914-initial-selection-staged/engine/review.md)은 단계별 구현 후39/39·build0·컴파일 시작 검증을 통과했다. [탐색 예산 저장소](../evidence/integrations/S2/20260914-exploration-budget-store/review.md)도29/29·build0으로 통과했고, [탐색 실행 엔진](../evidence/integrations/S2/20260914-exploration-engine/review.md)의 이중 예약·요청 의도/재생·초과 지출·DB 보호 장치 손실 차단까지 최종14파일169/169·build0·컴파일된 새 DB/재시작 검사로 검증했다. 과거 세 번 실패한 전면 구현은 복원 이력으로 보존하고 재사용하지 않았다. 실제 호스트 설정·통계/가격 관측·UI/IPC 연결은 남아 있다.
2. 실제 도구/모델 등록·자격·계정 권한과 가격/쿼터/최종 과금 출처 연결. 테스트 fixture의 참값을 실제 공급자의 검증 증거로 승격하지 않는다.
3. 실행 중 크래시의 소유권 대조와 재연결. 이번 응답 전달 claim의 프로세스 간 재전송 방지와 실제 에이전트 세션 재접속·종료 확인은 다른 검증이다. 쓰기 자동 재개 권한을 추정하지 않는다.
4. 네 선택 모드의 동결 평가셋·holdout·실측 비교. 기능이 동작한다는 사실과 효율/가성비가 개선됐다는 실증을 구분한다.
5. 남은 UI/실물/전체 릴리스 게이트. 현재 소스의 통합 회귀와 전체 출시 인수를 구분하며, 역사 보고서의 통과를 재사용하지 않는다.

최근 [복구 분류 근거 수정](../evidence/integrations/S4/20260914-recovery-observation-integrity/review.md)은 독립80/80·build0을 통과했다. 저장되지 않은 후속 콜백 값이 복구 승인에 쓰이던 결함을 막았으며, 실제 공급자 원인 분류·완료 자격 등 나머지 S4 항목은 미완료다.

## 유지되는 실행 제한

- 사용자가 꺼둔 Qwen 로컬 모델 서버는 접속·재시작·다운로드하지 않는다.
- 실패 후 한도가 소진된 WFP/실제 Electron/Qwen 게이트는 이 목록 작성이나 다른 이름의 작업으로 다시 열리지 않는다. 보존된 실패 기록을 기준으로 별도의 변경된 실험 범위를 먼저 검토한다.
- 이전의 출처 불명 Codex SHA 보류는 해제됐다. `@openai/codex@0.154.0-win32-x64`의 npm published integrity·SLSA provenance attestation·tarball 내 실행 파일·설치 바이트·Authenticode 서명이 한 체인으로 확인됐고 핀은 `be96b992…`다. 이 출처 확인은 인증 성공·entitlement·쿼터·청구를 뜻하지 않는다.
- GOAL 도구의 기존 목표는 usageLimited 상태이며 전체 완료로 바꾸지 않았다.

## 현재 미완료 항목 목록

### 재사용 공통 게이트 — 기능별 반복

- [x] repo/package identity·commit/hash·공개 API·내부 workspace 결합을 확인한다.
- [x] license/제3자 고지·Windows/runtime·설치/실행 부작용·유지보수 경로를 확인한다.
- [x] 정상/실패/취소/재시작/중복/경계를 검사한다. 순수 함수의 해당 없음은 이유를 기록한다.
  - [batch76 독립 판정](../evidence/integrations/S0/20260916-selected-lifecycle-matrix/REVIEW.md) — 선택된 R-04/R-05/R-06/R-08의 정상·실패·취소·재시작·중복·경계를 실행 영수증 또는 이유가 있는 순수 함수 해당 없음으로 대조했다. R08 소비자 바이트 검증 누락을 수정했고 미채택 transport·도입 승인은 포함하지 않는다.
- [x] 채택 부품을 고정 버전/출처 고지·얇은 어댑터·필요한 patch 목록으로 편입한다.
  - [batch76 독립 판정](../evidence/integrations/S0/20260916-selected-adoption-gates/REVIEW.md) — 동일한 선택 범위의 revision·출처 고지·실제 Cue adapter/caller·명시적 patch 목록을 강제 검사한다. R08은 원칙 참고만 포함하고 외부 코드 채택 승인을 만들지 않는다.
- [x] upstream 테스트와 별도로 Cue 계약·회귀·필요한 실제 경계 검증을 통과한다.
  - [batch76 독립 판정](../evidence/integrations/S0/20260916-selected-adoption-gates/REVIEW.md) — 선택 revision의 upstream 해당 없음 근거, Cue 회귀 및 실제 로컬 CLI 경계 결과를 별도로 검증하고 영수증에 묶는다. 미선택 공급자 transport의 실제 자격은 포함하지 않는다.
- [x] 업데이트 시 재검증·지문 무효화·fallback 규칙을 확인한다.

### S0 — 기준선·선행 조건

- [x] Codex, Claude Code, 로컬 endpoint부터 identity·auth 참조·프로토콜을 확인한다. ([독립 검토](../evidence/integrations/S0/20260917-identity-auth-protocol/REVIEW.md) — 세 대상 모두 현재 바이트에 묶어 판정했고 과대 주장 없음을 확인했다. 인증 성공·entitlement·쿼터·청구·dispatch 권한은 부여하지 않는다.)
- [x] 외부 코드 commit/hash·라이선스·제3자 자산 조건을 기록한다.

### S1 — 공통 레지스트리·런타임 (PI-02)

- [ ] R-01~R-03 연결 실험으로 정상/실패/취소/재시작을 검증하고 부품을 선택한다.
- [ ] 기존 Codex의 동작을 공통 어댑터로 보존한다.
- [ ] 두 번째 에이전트와 로컬 모델 전용 경로를 실물 검증한다.
- [ ] 원격 취소 요청과 실제 종료, 하위 작업 ID/소유권을 구분한다.
- [ ] `integration-runtime-contract.test.ts`와 필요한 P13/M 게이트를 통과한다.

### S2 — 모드·선택·비용 (TA-02)

- [x] API/구독/로컬 비용과 actual/estimated/unknown/stale를 구분한다.
  - [batch76 독립 판정](../evidence/integrations/S2/20260916-cost-dimensions/REVIEW.md) — 실제 engine→불변 관측 저장소→UI 경로에서 API·구독·로컬 비용의 단위·상태·시각을 구분한다. 계정/로컬 identity와 출처 바이트를 결합하며 관측으로 정산·권한을 만들지 않는다. 실제 공급자 청구 정확성이나 후속 관측 수정 스트림을 뜻하지 않는다.
- [x] 호출·재시도·검증·인계 비용을 포함하고 병렬 예산 예약/정산을 검증한다.
  - [batch75 독립 판정](../evidence/integrations/S2/20260916-phase-accounting/REVIEW.md) — 실제 engine의 영수증→인계→단계 배분 원자 기록, 정확한 합계·재생·병렬 예산 및 미확정 예약 보유를 주입된 청구 증거로 검증했다. 실제 청구 출처는 S2-02에 남는다.

### S3 — 작업 지휘·관측 (PI-03, PI-04)

- [x] 읽기 병렬화와 쓰기 lease/별도 worktree·통합 검증을 구현한다.
  - [batch76 독립 판정](../evidence/integrations/planning/20260916-progress-reconcile-76/BACKEND-CLOSURE-REVIEW.md) — 실제 driver의 읽기 병렬·쓰기 순서, lease 경합, 별도 Git worktree와 게시·통합 검증 경계를 현재 회귀로 확인했다. 기본 앱의 native 배포 및 공급자 실물 자격은 별도다.
- [x] UI에서 선택 이유·진행·차단·비용/불확실성·Stop 결과를 확인한다.
- [x] `integration-orchestration.test.ts`에서 중복 실행 0·최종본 덮어쓰기 0을 확인한다.
  - [batch75 독립 판정](../evidence/integrations/S3/20260916-writer-boundary-completion/REVIEW.md) — 지정 suite의 실제 native 게시에서 중복/재전송 0·승자 파일 보존·패자 경합·재개방을 확인했다. command/write_stdin/미지원 동작은 실행 전 거부한다. 별도 실패 작업 폴더 정리와 S3-01 실제 workflow는 미완료다.

### S4 — 복구·검증·완료 (PI-01)

- [ ] 현재 source의 일반 agent/mode/target 전체에 대한 자격과 실제 workflow checker/최종 인수를 통과한다. [v1 Electron gate](../evidence/integrations/S4/20260911-fresh-electron-gate/live-review.md)는 자격 성공 뒤 응답42바이트/시간 초과, checker0/인수0/정리 미확인으로 실패했고 별도 Qwen2회도 소진했다. [역사 canary](../evidence/integrations/S4/20260911-generated-json-live-canary/resume-result-review.md)의 응답35바이트 후 차단과 기존2회 소진 기록도 보존한다. 이전 자격은 소스 변경 후 재사용 불가.
- [x] 크래시 후 held 복구와 외부 부작용 대조, 쓰기 자동 재개 금지를 검증한다.
  - [batch76 독립 판정](../evidence/integrations/planning/20260916-progress-reconcile-76/BACKEND-CLOSURE-REVIEW.md) — 프로세스 재시작의 held 복구·외부 부작용 증거 대조·쓰기 자동 재개 금지를 검증했다. 관측이 없거나 불일치하면 held와 소유권을 유지한다. 실제 공급자 재연결·청구 최종성은 별도다.
- [x] `integration-verification.test.ts`와 정지/부모 사망/봉인 게이트를 통과한다.

### S5 — 실제 효율·가성비 개선

- [x] 평가 UI 실제 Electron 화면 검증: [batch66 실제 화면 독립 검토](../evidence/integrations/S5/20260915-evaluation-ui-v2/correction/actual-review.md)로 완료했다. 현재 renderer/preload/IPC/Core, 화면 6장, 오류·늦은 응답 처리, 정상 종료·백업·정리를 확인했다. 합성 unknown 기록이며 실측 성과·정책 승격 증거가 아니다. [과거 attempt1 실패](../evidence/integrations/S5/20260912-evaluation-ui/actual-attempt1/actual-audit.md)·[attempt2 실패](../evidence/integrations/S5/20260912-evaluation-ui/actual-attempt2/actual-audit.md)는 보존하며, 변경된 fixture·비동기 IPC 응답 지연·정리 검사를 별도 검증한 새 단일 실제 실행이다.
- [x] 실패·취소·unknown을 포함하고 인계/재시도 비용을 누락하지 않는다.
  - [batch75 독립 판정](../evidence/integrations/S2/20260916-phase-accounting/REVIEW.md) — 성공/실패/취소/unknown 투영과 base/retry/verification/handoff 영수증 배분을 검증했다. 누락 또는 미확정 값은 비용 0으로 추정하지 않으며 별도 실측 cohort·개선은 S5-04/05에 남는다.
- [ ] 동결 평가셋과 별도 holdout, 수동 기본 조합 기준선을 만든다.
- [ ] 네 모드 각각 spec의 품질 하한과 개선 목적을 입증한다.
- [x] 개선 미확인 정책을 승격하지 않고 이전 정책으로 복구할 수 있다.
- [ ] `integration-evaluation.test.ts` 및 승인 예산 내 실측을 완료한다.

### 출시 인수 시나리오

- [ ] 같은 목표를 네 모드로 실행해 선택 이유·비용·검증 결과를 설명할 수 있다.
- [x] 병렬 작업 중 Stop으로 대상 identity의 종료/정리를 확인한다.
- [x] 중간 크래시·재시작에서 중복 실행/쓰기 자동 재개가 없다.
- [x] 범위 밖 모델/계정/작업·예산 증액은 조용히 실행되지 않는다.
- [ ] 단계 `npm test` 및 필요한 실측·독립 리뷰·기존 릴리스 게이트를 완료한다.

이번 변경의 원본은 [batch65 preimages](../evidence/integrations/planning/20260915-progress-reconcile-65/preimages.json)에 보존한다.
