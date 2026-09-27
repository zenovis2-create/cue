# Cue 남은 통합 작업

**최신 batch68 (2026-09-15):** 원본 44개 중 18개 완료, **26개 미완료**다. [S5-07](../evidence/integrations/S5/20260915-promotion-original-contract-audit/review.md) — 독립 3파일26/26으로 미자격 승격 거부와 정확한 직전 정책 복원을 확인했다. 양성 자격은 합성이며 실제 성능 개선은 S5-05에 남긴다. [A03](../evidence/integrations/S4/20260915-driver-targeted-stop/lifetime-correction/actual-review.md) — 실제 Windows 두 작업에서 대상 identity 종료, 다른 작업의 동일 identity·heartbeat 유지, 각 작업의 개별 Stop과 정리를 확인했다. 공급자 종료·청구는 unknown이다. [S3-02](../evidence/integrations/S3/20260915-orchestration-ui/actual-attempt5/actual-review.md) — 실제 Electron 9장과 Core/IPC 원장으로 선택·진행·비용 미확인·UI Stop 결과를 확인했다. 상태 열 7px 붕괴를 수정해 같은 창에서 232px와 가로 넘침 없음으로 검증했다. 합성 실행의 정리·소유권 미확인은 유지한다. 실제 공급자·계정·청구·모델 성능 자격과 합성 호스트의 상태 전이 검증은 구분한다.

[최종 파일 게시 드라이버 독립 검토](../evidence/integrations/S3/20260915-existing-file-publication/driver/final-review.md)는 2파일20/20을 통과했다. 신뢰 호스트가 명시적으로 지원하는 staged existing-file 계약을 실행 전에 등록하고, 실제 쓰기 결과가 committed일 때만 완료 기록과 lease 해제를 진행한다. 취소·기한·권한 콜백 재진입·경합·unknown을 다시 확인하며 재생 시 쓰기를 반복하지 않는다. 실제 기본 어댑터의 직접 쓰기, 여러 파일의 원자적 게시, 재시작 후 검증된 실행 재개는 남아 있어 S3-03은 미완료다. 덮어쓴 리뷰 경로의 원본 바이트는 복구하지 못했으며 [충돌 기록](../evidence/integrations/S3/20260915-existing-file-publication/driver/review-path-collision.md)과 별도 최종 리뷰를 보존한다.

[저장된 nonfinal 청구 귀속 거부](../evidence/integrations/S5/20260915-stored-nonfinal-attribution/review.md)는 실제 SQLite의 estimated/nonfinal-actual 행과 정확한 receipt·digest 결합을 검사해 3파일30/30을 통과했다. [선택 범위 upstream 자료](../evidence/integrations/S0/20260915-upstream-bom-completion/REVIEW.md)는 Archify 고정 archive 5파일과 제한된 원칙 재사용 범위를 확인했으며 검증 7/7을 통과했다. Cue-native 제외 범위의 N/A는 외부 미확인 부품에 적용하지 않는다. 전역 R01/R02/S0-03은 미완료이고 adoptionAuthorized:false를 유지한다.

A03은 [실제 Stop 검토](../evidence/integrations/S4/20260915-driver-targeted-stop/lifetime-correction/actual-review.md)에서 대상 종료와 동시 작업 생존을 확인했다. 초기 2회와 completion-fence 교정의 실패는 보존한다. [실제 화면 검토](../evidence/integrations/S3/20260915-orchestration-ui/actual-attempt5/actual-review.md)는 현재 CSS의 실제 레이아웃 수정과 9개 화면을 확인했다. 네 번의 앞선 실패는 초기화·Windows 기록·스크롤·제품 grid 결함과 함께 보존한다. UI Stop 후 blocked/cancelled이며 cleanup unknown·소유권 미해제·금전 비용 미측정을 정확히 표시한다. 예상된 Core 종료 거부와 합성 fixture의 DB/임시 경로 정리는 구분한다. 최종 실행의 백업·프로세스 종료·소유 경로 삭제는 통과했으나 초기 실패 actual1/2의 임시 경로는 [빈 경로 삭제 거부 기록](../evidence/integrations/planning/20260915-progress-reconcile-68/empty-ui-temp-cleanup.json)에 따라 보존했다.

[현재 정적 구조 보고서](../evidence/integrations/S7/20260912-current-source/generations/e5db748cd1a7737c016fda5d94aab26fb51c9cc2cff53fa791f6e7e29cb0bb91/cue-current-source.html)는 176 JS/TS 파일·403 import 연결이다. [이전 batch67 판정](../evidence/integrations/planning/20260915-progress-reconcile-67/ROOT-REVIEW.md)과 실패 실험은 보존한다. 로컬 Qwen OFF·출처 불명 Codex SHA 보류·GOAL usageLimited를 유지한다. 실제 청구 생산자·도구 자격·평가 baseline/holdout 실측·네 모드 개선 및 전체 출시는 미완료다.

2026-09-15 기준. 이 문서는 [통합 체크리스트](INTEGRATION_CHECKLIST.md)의 미완료 항목을 정리한 실행 안내다. 체크리스트가 완료 판정의 기준이며, 아래 목록을 작성한 것만으로 구현이나 실측이 완료되지 않는다.

광범위한 미완료 항목은 26개다. 각 항목에는 이미 검증된 하위 기능도 포함되므로 전체 미구현 개수나 예상 작업량으로 해석하지 않는다.

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
- 출처 불명 Codex SHA는 사용자 결정대로 보류한다. 새 출처·자격·가격 또는 실제 호출 성공을 추정하지 않는다.
- GOAL 도구의 기존 목표는 usageLimited 상태이며 전체 완료로 바꾸지 않았다.

## 현재 미완료 항목 목록

### 재사용 공통 게이트 — 기능별 반복

- [ ] repo/package identity·commit/hash·공개 API·내부 workspace 결합을 확인한다.
- [ ] license/제3자 고지·Windows/runtime·설치/실행 부작용·유지보수 경로를 확인한다.
- [ ] 정상/실패/취소/재시작/중복/경계를 검사한다. 순수 함수의 해당 없음은 이유를 기록한다.
- [ ] 채택 부품을 고정 버전/출처 고지·얇은 어댑터·필요한 patch 목록으로 편입한다.
- [ ] upstream 테스트와 별도로 Cue 계약·회귀·필요한 실제 경계 검증을 통과한다.
- [ ] 업데이트 시 재검증·지문 무효화·fallback 규칙을 확인한다.

### S0 — 기준선·선행 조건

- [ ] Codex, Claude Code, 로컬 endpoint부터 identity·auth 참조·프로토콜을 확인한다.
- [ ] 외부 코드 commit/hash·라이선스·제3자 자산 조건을 기록한다.

### S1 — 공통 레지스트리·런타임 (PI-02)

- [ ] R-01~R-03 연결 실험으로 정상/실패/취소/재시작을 검증하고 부품을 선택한다.
- [ ] 기존 Codex의 동작을 공통 어댑터로 보존한다.
- [ ] 두 번째 에이전트와 로컬 모델 전용 경로를 실물 검증한다.
- [ ] 원격 취소 요청과 실제 종료, 하위 작업 ID/소유권을 구분한다.
- [ ] `integration-runtime-contract.test.ts`와 필요한 P13/M 게이트를 통과한다.

### S2 — 모드·선택·비용 (TA-02)

- [ ] API/구독/로컬 비용과 actual/estimated/unknown/stale를 구분한다.
- [ ] 호출·재시도·검증·인계 비용을 포함하고 병렬 예산 예약/정산을 검증한다.

### S3 — 작업 지휘·관측 (PI-03, PI-04)

- [ ] 읽기 병렬화와 쓰기 lease/별도 worktree·통합 검증을 구현한다.
- [x] UI에서 선택 이유·진행·차단·비용/불확실성·Stop 결과를 확인한다.
- [ ] `integration-orchestration.test.ts`에서 중복 실행 0·최종본 덮어쓰기 0을 확인한다.

### S4 — 복구·검증·완료 (PI-01)

- [ ] 현재 source의 일반 agent/mode/target 전체에 대한 자격과 실제 workflow checker/최종 인수를 통과한다. [v1 Electron gate](../evidence/integrations/S4/20260911-fresh-electron-gate/live-review.md)는 자격 성공 뒤 응답42바이트/시간 초과, checker0/인수0/정리 미확인으로 실패했고 별도 Qwen2회도 소진했다. [역사 canary](../evidence/integrations/S4/20260911-generated-json-live-canary/resume-result-review.md)의 응답35바이트 후 차단과 기존2회 소진 기록도 보존한다. 이전 자격은 소스 변경 후 재사용 불가.
- [ ] 크래시 후 held 복구와 외부 부작용 대조, 쓰기 자동 재개 금지를 검증한다.
- [x] `integration-verification.test.ts`와 정지/부모 사망/봉인 게이트를 통과한다.

### S5 — 실제 효율·가성비 개선

- [x] 평가 UI 실제 Electron 화면 검증: [batch66 실제 화면 독립 검토](../evidence/integrations/S5/20260915-evaluation-ui-v2/correction/actual-review.md)로 완료했다. 현재 renderer/preload/IPC/Core, 화면 6장, 오류·늦은 응답 처리, 정상 종료·백업·정리를 확인했다. 합성 unknown 기록이며 실측 성과·정책 승격 증거가 아니다. [과거 attempt1 실패](../evidence/integrations/S5/20260912-evaluation-ui/actual-attempt1/actual-audit.md)·[attempt2 실패](../evidence/integrations/S5/20260912-evaluation-ui/actual-attempt2/actual-audit.md)는 보존하며, 변경된 fixture·비동기 IPC 응답 지연·정리 검사를 별도 검증한 새 단일 실제 실행이다.
- [ ] 실패·취소·unknown을 포함하고 인계/재시도 비용을 누락하지 않는다.
- [ ] 동결 평가셋과 별도 holdout, 수동 기본 조합 기준선을 만든다.
- [ ] 네 모드 각각 spec의 품질 하한과 개선 목적을 입증한다.
- [x] 개선 미확인 정책을 승격하지 않고 이전 정책으로 복구할 수 있다.
- [ ] `integration-evaluation.test.ts` 및 승인 예산 내 실측을 완료한다.

### 출시 인수 시나리오

- [ ] 같은 목표를 네 모드로 실행해 선택 이유·비용·검증 결과를 설명할 수 있다.
- [x] 병렬 작업 중 Stop으로 대상 identity의 종료/정리를 확인한다.
- [ ] 중간 크래시·재시작에서 중복 실행/쓰기 자동 재개가 없다.
- [x] 범위 밖 모델/계정/작업·예산 증액은 조용히 실행되지 않는다.
- [ ] 단계 `npm test` 및 필요한 실측·독립 리뷰·기존 릴리스 게이트를 완료한다.

이번 변경의 원본은 [batch65 preimages](../evidence/integrations/planning/20260915-progress-reconcile-65/preimages.json)에 보존한다.
