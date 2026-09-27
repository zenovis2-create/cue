# Cue 통합 진행 기록

**최신 batch68 (2026-09-15):** 원본 44개 중 18개 완료, **26개 미완료**다. [S5-07](../evidence/integrations/S5/20260915-promotion-original-contract-audit/review.md) — 독립 3파일26/26으로 미자격 승격 거부와 정확한 직전 정책 복원을 확인했다. 양성 자격은 합성이며 실제 성능 개선은 S5-05에 남긴다. [A03](../evidence/integrations/S4/20260915-driver-targeted-stop/lifetime-correction/actual-review.md) — 실제 Windows 두 작업에서 대상 identity 종료, 다른 작업의 동일 identity·heartbeat 유지, 각 작업의 개별 Stop과 정리를 확인했다. 공급자 종료·청구는 unknown이다. [S3-02](../evidence/integrations/S3/20260915-orchestration-ui/actual-attempt5/actual-review.md) — 실제 Electron 9장과 Core/IPC 원장으로 선택·진행·비용 미확인·UI Stop 결과를 확인했다. 상태 열 7px 붕괴를 수정해 같은 창에서 232px와 가로 넘침 없음으로 검증했다. 합성 실행의 정리·소유권 미확인은 유지한다. 실제 공급자·계정·청구·모델 성능 자격과 합성 호스트의 상태 전이 검증은 구분한다.

[최종 파일 게시 드라이버 독립 검토](../evidence/integrations/S3/20260915-existing-file-publication/driver/final-review.md)는 2파일20/20을 통과했다. 신뢰 호스트가 명시적으로 지원하는 staged existing-file 계약을 실행 전에 등록하고, 실제 쓰기 결과가 committed일 때만 완료 기록과 lease 해제를 진행한다. 취소·기한·권한 콜백 재진입·경합·unknown을 다시 확인하며 재생 시 쓰기를 반복하지 않는다. 실제 기본 어댑터의 직접 쓰기, 여러 파일의 원자적 게시, 재시작 후 검증된 실행 재개는 남아 있어 S3-03은 미완료다. 덮어쓴 리뷰 경로의 원본 바이트는 복구하지 못했으며 [충돌 기록](../evidence/integrations/S3/20260915-existing-file-publication/driver/review-path-collision.md)과 별도 최종 리뷰를 보존한다.

[저장된 nonfinal 청구 귀속 거부](../evidence/integrations/S5/20260915-stored-nonfinal-attribution/review.md)는 실제 SQLite의 estimated/nonfinal-actual 행과 정확한 receipt·digest 결합을 검사해 3파일30/30을 통과했다. [선택 범위 upstream 자료](../evidence/integrations/S0/20260915-upstream-bom-completion/REVIEW.md)는 Archify 고정 archive 5파일과 제한된 원칙 재사용 범위를 확인했으며 검증 7/7을 통과했다. Cue-native 제외 범위의 N/A는 외부 미확인 부품에 적용하지 않는다. 전역 R01/R02/S0-03은 미완료이고 adoptionAuthorized:false를 유지한다.

A03은 [실제 Stop 검토](../evidence/integrations/S4/20260915-driver-targeted-stop/lifetime-correction/actual-review.md)에서 대상 종료와 동시 작업 생존을 확인했다. 초기 2회와 completion-fence 교정의 실패는 보존한다. [실제 화면 검토](../evidence/integrations/S3/20260915-orchestration-ui/actual-attempt5/actual-review.md)는 현재 CSS의 실제 레이아웃 수정과 9개 화면을 확인했다. 네 번의 앞선 실패는 초기화·Windows 기록·스크롤·제품 grid 결함과 함께 보존한다. UI Stop 후 blocked/cancelled이며 cleanup unknown·소유권 미해제·금전 비용 미측정을 정확히 표시한다. 예상된 Core 종료 거부와 합성 fixture의 DB/임시 경로 정리는 구분한다. 최종 실행의 백업·프로세스 종료·소유 경로 삭제는 통과했으나 초기 실패 actual1/2의 임시 경로는 [빈 경로 삭제 거부 기록](../evidence/integrations/planning/20260915-progress-reconcile-68/empty-ui-temp-cleanup.json)에 따라 보존했다.

[현재 정적 구조 보고서](../evidence/integrations/S7/20260912-current-source/generations/e5db748cd1a7737c016fda5d94aab26fb51c9cc2cff53fa791f6e7e29cb0bb91/cue-current-source.html)는 176 JS/TS 파일·403 import 연결이다. [이전 batch67 판정](../evidence/integrations/planning/20260915-progress-reconcile-67/ROOT-REVIEW.md)과 실패 실험은 보존한다. 로컬 Qwen OFF·출처 불명 Codex SHA 보류·GOAL usageLimited를 유지한다. 실제 청구 생산자·도구 자격·평가 baseline/holdout 실측·네 모드 개선 및 전체 출시는 미완료다.

- **이전 batch64 기록 (당시 33개 미완료):** 원래 조건에 따라 S0-02/S2-01/S2-04/S4-02/S4-04/S5-02/S5-06/A02/A07을 닫아 상위 미완료는 **33개**다. [복구·완료 증거 검토](../evidence/integrations/S4/20260915-recovery-branch-completeness/review.md)의 독립5파일95/95·build0와 [원래 완료 조건 감사](../evidence/integrations/planning/20260915-original-contract-audit/review.md)의 별도10파일100/100을 통과했다. 새 기능 불일치·쿼터 대체 fixture는 실패/후보/비용/재생 기록을 확인한다. [출시 표시 검토](../evidence/integrations/release/20260915-readiness-truth-correction/review.md)는 문서만으로 자격·효율 입증을 선언하던 보고서 결함을 보정해 S0~S4/S5/S6~S7을 독립 표시한다. [도구 등록 감사](../evidence/integrations/planning/20260915-reuse-original-contract-audit/review.md)로 요청 9종의 비활성 제품·역할·미지원 조건 등록을 확인했다. 실제 도구 자격·실측 개선·전체 출시는 미완료다. 특히 인계 비용의 권위 있는 수집(S2-03/S5-03), 계정 승인 identity의 실행 연결(A06), 최종 파일의 경합 방지(S3-03), 검증된 정책 승격/복원(S5-07)은 구체적인 구현 공백으로 남긴다. 로컬 모델은 계속 보류한다.

- **이전 batch63 기록 (당시 42개 미완료):** [전체 실행 목록](integration/REMAINING_EXECUTION_MAP.md)에 원래 44개 항목의 근거·남은 동작·완료 조건을 연결했다. [독립 검토](../evidence/integrations/S2/20260915-exploration-consent-review/review.md) 최종 독립10파일151/151·build0·migration042 새 DB/재시작 및 보호 장치 손실 거부 검증 후 초기 기본 선택/별도 탐색 예산(S2-05)과 부분 결과의 허위 완료 거부(A05)를 완료로 표시해 당시 상위 미완료는 **42개**였다. 유료 탐색은 별도의 기본 미선택 체크박스로 동의해야 승인된다. Core는 엄격히 검증한 동의와 일반 승인을 같은 트랜잭션에 저장하고, 드라이버는 실행·정책·계획·후보·허용 작업 목록에 결합된 동의만 사용한다. 병렬 작업과 같은 후보의 재시도에서도 허용 작업에만 탐색 예산을 적용하며, 전체 예산에 포함해 중복 예약하지 않는다. 활성화 뒤 동의 기록이 사라지면 시작과 후속 실행 검증에서 차단한다. 실제 가격·통계·쿼터/과금 출처, 공급자 자격, 배포 설정 편집 화면과 전체 출시 검증은 별도 미완료 항목이다. 로컬 모델은 보류한다.
- **이전 소스 보고서:** [정적 검토](../evidence/integrations/S7/20260915-exploration-source-refresh/review.md) — 생성 exit0·ready=true, 172파일·392개 선언된 연결, 스냅샷 `d5bc1063963fb4977d4fa407356dfb808687e0449ed527add7ab2b8a4e31d9ce`. 과거 보고서는 이력으로 보존한다.

- **초기 기본 후보의 호스트 연결 (2026-09-15):** 금전 예산을 사용하는 호스트는 초기 기본 후보·보수적 추정값·출처·시각을 준비 설정으로 제공할 수 있다. Cue가 실행/정책 식별자를 내부에서 붙이고 기존 정책·예산 준비와 같은 트랜잭션에 저장한다. 저장 설정이 누락·변경·변조되면 재준비나 실행을 거부하며, 로컬 실행 경로는 이 설정을 저장 전에 거부한다. 승인 문구에는 기본 후보와 보수적 비용/시간 상한을 표시하고 무결성 해시는 내부 요약·원장에 유지한다. [독립 검토](../evidence/integrations/S2/20260915-initial-default-host/review.md) 독립 결합6파일94/94·build0, 최종 문구 수정 후 Core5/5 재검증(중복 집계하지 않음). 주입된 호스트를 사용한 드라이버/Core 검증이다. 실제 공급자 통계·가격 수집, 배포 호스트의 설정 공급, 사용자가 설정을 편집하는 UI/IPC, 탐색 승인·실행 요청 연결과 실물 자격은 남아 있다. 로컬 모델은 계속 보류한다.
- **이전 정적 소스 보고서 (2026-09-15):** [갱신 검토](../evidence/integrations/S7/20260915-initial-default-host-source-refresh/review.md) — 생성 exit0·ready=true, 172개 JS/TS 파일·392개 선언된 연결, 스냅샷 `fb070af2b5e236e07ad8423181320f68f147e2ac9b41c1d5efd423293c81ff93`. 이전 보고서는 이력이며 실행/성능 자격으로 해석하지 않는다.

- **최신 정적 소스 보고서:** [갱신 검토](../evidence/integrations/S7/20260914-staged-selection-source-refresh/review.md) — 생성 명령 exit0·ready=true, 172개 JS/TS 파일·391개 선언된 연결, 스냅샷 `9c68e252a8c61901d46d0f66acf5ac1cdf46cb6d0c9c6cde3ec73cd1c33a858e`. 실행·성능·실제 공급자 자격을 뜻하지 않는다.

- **S2 단계별 초기 선택 구현 (2026-09-14):** 이전 전면 구현을 복원한 뒤 [실행 기반](../evidence/integrations/S2/20260914-initial-selection-staged/baseline/review.md) 22/22를 먼저 검증하고, 실행별 설정 저장소와 [실제 엔진 연결](../evidence/integrations/S2/20260914-initial-selection-staged/engine/review.md)을 순서대로 구현했다. 초기 기본 선택은 독립5파일39/39·build0·컴파일 migration040 시작 검사를 통과했다. [탐색 예산 저장소](../evidence/integrations/S2/20260914-exploration-budget-store/review.md)는 정책 버전 결합 누락과 SQL 검사 오류를 보정한 최종3파일29/29·build0으로 통과했다. [탐색 실행 엔진](../evidence/integrations/S2/20260914-exploration-engine/review.md)도 최종 독립14파일169/169·build0·컴파일041 새 DB/재시작 검증을 통과했다. 전체/탐색 예산의 원자적 예약·초과 지출·재생과 DB 보호 장치 손실 차단을 연결했다. maker 3회 한도 뒤 root의 별도 보호 장치 검사 수정 1회를 기록했고, 실패한 명령 기록도 보존했다. 통계/가격 수집·UI/IPC·실제 공급자 자격은 아직 없고 로컬 모델은 보류한다.

- **S4 복구 분류 근거 고정 (2026-09-14):** [독립 검토](../evidence/integrations/S4/20260914-recovery-observation-integrity/review.md)에서 4파일80/80, maker 최종 build0과 정확한 소스·preimage·로그 hash를 확인했다. 재시도 가능 여부 등 네 값이 저장 관측에서 빠져 후속 콜백 값으로 결정되던 결함을 수정했다. 전체 관측 고정·저장값 재검증·신선한 관측과의 일치·후보당 한 번 관측을 적용하며, 근거 없는 과거 기록은 새 복구/비중단 재생에 사용할 수 없다. 첫 회78/78, 보완 후80/80이며 중복 합산하지 않는다. 실제 공급자·native·Electron 자격은 아니다. [현재 정적 소스](../evidence/integrations/S7/20260914-initial-selection-source-refresh/review.md)는 수정 후170파일385간선을 다시 캡처한다.

- **S2 초기 선택·탐색 예산 시도:** [독립 복원 검토](../evidence/integrations/S2/20260914-initial-selection/review.md)는 세 번째 회차까지 새 fixture의 계획 검증을 통과하지 못해 기능을 보존하지 않았음을 확인했다. 두 기존 소스는 원본 바이트로 복원했고 신규3경로는 제거했으며 실패 후보·원시 로그는 보존했다. 복원 후5파일49/49·build0. 초기 선택/탐색 예산과 광범위한 미완료44항목은 그대로 남는다. 로컬 모델은 사용자 요청으로 계속 보류한다.

시작: 2026-09-11. 기준 spec: [r3](INTEGRATION_SPEC.md), [체크리스트](INTEGRATION_CHECKLIST.md).

## 최신 상태 — 2026-09-14 독립 검토 반영

사용자 요청: 로컬 모델은 잠시 꺼져 있으므로 관련 작업을 보류한다. 서버 연결·재시작 없이 다른 미완료 항목을 진행하며 저장된 평가 비교 조회의 IPC/DOM/Core 단위를 완료했다.

### 권위 있는 현재 handoff

- **S0:** [확정 identity 보고](../evidence/integrations/S0/20260912-confirmed-identities/report.md)는 기존 7개에 사용자가 선택한 NLM(`jacob-bd/notebooklm-mcp-cli`, canonical redirect `jacob-bd/gemini-notebook-mcp-cli`)과 Hermes(`NousResearch/hermes-agent`)를 더해 9개 후보를 `inactive / resolved-unqualified / user-selected`로 정리했다. 선택 identity만 해소했으며 설치·runtime 등록·인증·qualification·entitlement/price/capability·dispatch authority는 입증하지 않는다.
- **S1:** 기존 output-gate의 network `ETIMEDOUT`과 역사적 WFP option access denial은 계속 미자격이다. [Created-identity 제한 검토](../evidence/integrations/S1/20260913-readonly-created-identity/review.md)는 exact PID/creation-time emission-before-continuation을17/17 PASS했지만 `GetProcessTimes` failure의 full `LaunchCore` cleanup은 source inspection뿐이다. [Regression/build](../evidence/integrations/S1/20260913-readonly-created-identity/build-review.md)은 별도16 + build0으로 distinct33 source cases와48,399-byte `F5E03DE2...` parity를 기록했다. 이 variant의 [one-shot actual smoke](../evidence/integrations/S1/20260913-readonly-wfp-diagnostic-smoke/actual-review.md)는 실제 실행됐으나 exit1/`passed:false` **FAIL/CLOSED**다. PID50324가 생성 후 사라졌고 WFP frame은 `unknown` empty, exit frame0이며 ACL/root/sentinel 불변·profile0이다. Generic lease refusal은 현재 WFP status 원인, whole-job death, identity/cleanup, denial, registration 또는 qualification을 증명하지 않는다. One-shot은 소진됐고 failure root는 retained다.
- **S2:** [선택 설명 follow-up actual QA](../evidence/integrations/S2/20260912-selection-ui-followup/actual-attempt1/root-review.md)는 실제 compiled engine→Core→preload/IPC→renderer와 PNG4개를 PASS했다. 로컬 고정 조합과 금전 정책 비교를 구분했고 두 합성 start는 거부돼 provider/session/native/approval은0이다. Stop은 표시만 검증했으며 동작은 미검증이고 61→50 후보 truncation은 DOM 증거이지 50행 전체의 동시 viewport 가시성 증거가 아니다. 이전 실패는 보존한다. 실제 provider price/quota/billing, local GPU, trusted production ingestion과 broad selection/admission/budget authority는 open이다.
- **S3:** [SQLite startup 독립 검토](../evidence/integrations/S3/20260913-ledger-startup/review.md)는 fresh/initialized 동시 `openLedger`, rollback/handle release와 exact claim contention을 5파일42/42+build0으로 PASS했다. Schema phase001–015/017–039는 IMMEDIATE로 직렬화하고 migration016의 별도 EXCLUSIVE·FK/pragma 복원 계약은 변경하지 않았다. Migration031 **FINAL BLOCKED** 역사와 migration033 bounded PASS, migration035 wait/checkpoint PASS도 유지한다. 실제 adapter delivery·live continuation·durable live control, 광범위한 재시작 중복 실행 방지와 실제 provider/native/Electron은 open이다.

- **S3 후속 — 제한적 읽기 병렬 실행 (2026-09-14):** [독립 검토](../evidence/integrations/S3/20260914-parallel-read-wave/review.md) 4파일68/68, 최종 build0. 호스트 설정 maxParallelReadTasks 기본1/최대8을 승인 요약에 고정하고 일반 비쓰기 준비 단계만 묶어 실행한다. 기존 봉투/범위 권한·claim·예약을 유지하며 작업별 핸들로 Stop/실패/대기 응답과 후속 단계 순서를 관리한다.2개 동시 실행·쓰기 분리·예약 합산·실패 전파·시작 중 신호 취소와 늦은 객체 취소를 SQLite/주입 런타임으로 검증했다. 최초 maker 롤백의 원인은 반환 전 AdapterExecution.cancel 호출을 요구한 잘못된 테스트 기준이었으며 엔진 결함으로 확정한 해석을 [수정 기록](../evidence/integrations/S3/20260914-parallel-read-wave/ROOT-CORRECTION.md)에서 바로잡았다. 후보를 보존/복원한 root 검증과 로컬 fixture 설정 누락 실패, [별도 설정 수정](../evidence/integrations/S3/20260914-parallel-read-wave/fixture-fix/maker-fix.md)의 최종 통과를 모두 보존했다. 원본3/복원 후보3/최종3 지문을 확인했다. 실제 공급자·OS·Electron·활성 묶음 재시작·처리량 및 별도 병렬 deadline 만료는 미검증이며 전체S3는 open이다. 로컬 모델 보류는 유지한다.

- **S3 후속 — 병렬 묶음 시간 초과 (2026-09-14):** [독립 검토](../evidence/integrations/S3/20260914-parallel-wave-timeout/review.md) 4파일 70/70, 최종 빌드 통과. 병렬 `taskTimeoutMs` 만료가 증거 미검증으로 기록되던 문제를 수정했다. 두 작업 취소·검증 미실행, 정리 미확인 시 정확한 미해결 ID/예약 유지·종료 거부, 정리 확인 시에도 전체 명령 시간 초과/인수 미검증 유지를 확인했다. 기존 fixture는 신뢰한 실행 영수증에 따라 개별 작업을 completed로 기록할 수 있으므로 전체 명령 성공과 구분한다. Maker 두 차례의 테스트 예상값 오류(각 69/70)는 보존했고, root가 settled() 반환값 한 줄만 수정한 후 별도 검수자가 통과를 확인했다. 실제 공급자/절대 기한/재시작은 미검증이며 로컬 모델 보류와 전체 S3 미완료를 유지한다.

- **S3 후속 — 병렬 대기 응답 전달 (2026-09-14):** [독립 검토](../evidence/integrations/S3/20260914-parallel-wait-delivery/review.md) 4파일 73/73, 빌드 통과. 승인 검사 중 Stop이 발생해도 호스트 응답 전달이 시작되던 문제를 재현하고, 전달 직전 준비/중지/종료/병렬 취소 제어 조건을 추가했다. 두 실행별 identity·세션 참조·응답 내용과 재전송 방지, 시간 초과 후 보존된 핸들로 전달하지 않음, 전송 후 늦은 확인을 사실대로 기록함을 검증했다. 수정 전 재현과 진단 실행, 첫 전체 검사 72/73 및 최종 73/73 기록을 보존했다. 같은 원장에서 드라이버를 다시 만든 테스트이며 실제 프로세스 재시작/공급자 연결 복원을 뜻하지 않는다. 순차 자동 실패 미해결 경로·전체 S3는 미완료이며 로컬 모델 보류를 유지한다.

- **S3 후속 — 순차 오류 뒤 응답 전달 (2026-09-14):** [독립 검토](../evidence/integrations/S3/20260914-serial-wait-delivery/review.md) 4파일 75/75, 빌드 통과. 수정 전 순차 시간 초과 후 호스트 전달이 시작되는 문제를 재현했다. claim 이후 정확한 루트 작업의 running 상태를 검사하도록 보완해 시간 초과/영수증 처리 예외에서 새 전달·허위 관측·재전송을 차단하고, 미해결 작업과 예약 10단위 및 종료 거부를 유지한다. 수정 전 실패 로그, 구현 첫 검사 통과와 독립 첫 검사 통과를 보존했다. 기존 복구 흐름은 회귀와 소스 검토로 확인했으나 복구 중 응답 전달을 별도 실증하지 않았다. 실제 공급자·프로세스 재시작·전체 S3는 미검증/미완료이며 로컬 모델 보류를 유지한다.

- **S3 후속 — 재시도 복구 후 응답 전달 (2026-09-14):** [독립 검토](../evidence/integrations/S3/20260914-recovery-wait-delivery/review.md)는 기능 범위 PASS(4파일 76/76·빌드 통과), 작업 절차 NONCOMPLIANT를 구분한다. 제품 코드는 그대로 두고 공개 recover의 blocked→running 전환과 새 실행으로의 정확한 응답 전달·재전송 방지·실패 identity 요청 거부 테스트를 추가했다. 초기 후보 이후 5회 수정으로 선언한 2회 한도를 초과해 소스를 동결했으며 추가 실행 없이 실패/수정 기록을 보존했다. 검수자의 잘못된 루트 build 명령 실패와 올바른 daemon build 통과도 별도로 남겼다. 재시도만 검증했고 전환/재계획·실제 공급자/프로세스 재시작 연결 복원은 미검증이다. 전체 S3와 로컬 모델 보류를 유지한다.

- **남은 문제 묶음 — 복구·프로세스 재시작·소스 보고서 (2026-09-14):** [복구 행렬](../evidence/integrations/S3/20260914-recovery-wait-matrix/review.md)과 [Node 재시작](../evidence/integrations/S3/20260914-wait-process-restart/review.md)의 독립 합동 검사 5파일 79/79·빌드 통과. 테스트만 확장해 재시도/전환/재계획의 정확한 응답 전달, 전송 뒤 확인 전 프로세스 종료와 새로운 PID의 SQLite 재개방에서 재전송 0을 확인했다. Matrix는 2회 수정 한도를 지켰지만 첫 로그 종료값과 정확한 바이트 원본 백업이 누락돼 한계를 보존했다. Restart maker의 두 실패 후 별도 root 1회 수정은 기존 프로토콜 상수/재요청 DTO 계약에 테스트를 맞췄고 제품 검사는 완화하지 않았다. [소스 갱신](../evidence/integrations/S7/20260914-current-source-refresh/review.md)은 정적 170파일/385관계·5산출물·이전 포인터 외 62기록 보존을 통과했다. [전체 미완료 작업](INTEGRATION_REMAINING.md)에는 44개 광범위 항목과 다음 구현/실측 요구를 정리했다. 전체 S0–S7 완료나 공급자 자격을 선언하지 않으며 로컬 모델 보류를 유지한다.
- **S4:** [중단-run recovery 독립 검토](../evidence/integrations/S4/20260912-journal-recovery/review.md)는 durable held·writer-lease 유지·protected fresh journal을21/21+review3/3으로, actual current-ledger `ownDaemonWorktree` ordering을1/1로 PASS했다. Mocked fence가 committed held를 본 뒤 실패하면 process/profile/reconcile side effects와 owner는0이고 held/lease가 유지된다. Stale-ledger branch는 source inspection만 있다. [Recovery-handoff 독립 검토](../evidence/integrations/S4/20260912-recovery-handoff/review.md)는 공유 persisted generated-JSON resolver와 exact-attempt terminal reader를 실제 12/12로 PASS했다. Protected host의 pre/final-transaction integrity 재검사는 source-inspected held-only 연결과 maker17/17 근거이며, 외부 효과 완전성 authority가 없어 case를 진행시키지 않는다. 당시 `invalid_requirements:array` 실패와 기준선 부재는 역사로 보존한다. [Generated-host contract 독립 검토](../evidence/integrations/S4/20260912-generated-host-contract/review.md)는 per-configuration immutable checker policy와 원래 `runs shared-ledger`를 synthetic owned-executor 환경에서 2파일 18/18로 PASS했다. [실제 fixed-JSON v2 감사](../evidence/integrations/S4/20260912-local-json-gate-v2/actual-review.md)는 한 번의 frozen `DEFAULT_HOST_PLAN` 실행에서 qualification과 producer/checker workflow, cleanup, strict reopen acceptance, policy/pin과 identity를 PASS했다. 원본 auditor의 잘못된 column으로 gate `passed:false`였던 기록은 보존하며 [offline 교정 검토](../evidence/integrations/S4/20260912-local-json-gate-v2/offline-correction/review.md)가 8/8과 read-only replay `accepted=true`를 확인했다. 두 producer leg는 소진했고 HTTP cardinality는 unknown이다. [UI/IPC reason 검토](../evidence/integrations/S4/20260912-recovery-handoff/ui-review.md)는 다섯 allowlisted code의 고정 한국어 표시와 raw reason/ID/path/action 비노출을 19/19로 PASS했다. 겹치는 교정 후13/13은 합산하지 않는다. Restore/CAS·자동 resume·positive native-journal handoff·다른 agent/mode/target·provider billing/stop과 broad S4는 open이다. [Fresh change exclusion](../evidence/integrations/S4/20260913-driver-change-exclusion/review.md)은 real moved를 retry/recovery 전 `change_observation_unknown`으로 막고 modified를 downstream evidence gate까지 통과시켜2파일41 PASS했다. [Held admission](../evidence/integrations/S4/20260913-held-recovery-admission/review.md)은 exact sealed disposition을 decision/replay/replan/replacement claim 직전에 재검사해 open/corrupt/stale held를 mutation 전에 막는4파일24를 PASS했다. 두 단위 합계6파일65 distinct이며 live reconciliation·eligibility 생성·positive retry/native 실행은 입증하지 않는다. [Legacy held-retry guard](../evidence/integrations/S4/20260913-held-retry-admission/review.md)는 decision-free retry와 recovery prior ID를 final admission에서 모두 검사해 held/corrupt를 mutation 전에 차단하고 valid lineage를 허용함을3파일19 PASS했다. 이19는 기존65와 겹쳐 합산하지 않으며 budget/runtime launch는 미실행이다. [Recovery claim-limits test-only 검토](../evidence/integrations/S4/20260913-recovery-claim-limits/review.md)는 valid decision/revision claim의 deadline·누적 attempt cap·final callback clock advance 거부와 정상 in-limit claim을3파일21 PASS했고 typecheck0이다. 기존 contract equality는 source inspection이며 monetary budget/full driver/live workflow는 open이다. [Replan budget backend 검토](../evidence/integrations/S4/20260913-replan-budget/review.md)는 engine/store/policy/stage/budget/SQLite에서 cumulative budget 초과 rollback, in-budget revised dispatch와 replay no-reset/no-relaunch, approval/requirements guard를4파일24 PASS하고 typecheck0을 기록했다. 이전 claim-limits와 함께 exact backend checklist invariant를 닫지만 synthetic budget/injected runtime이며 live billing/provider·broad S4는 open이다. [`automatic-approved` 검토](../evidence/integrations/S4/20260913-automatic-recovery/review.md)는 immutable mode/default manual, trusted prerequisites, shared receipt-bound decision, auto retry/switch/quota, stop, explicit-plan deferred replan과 callback/deadline fences를 real SQLite/injected runtime4파일61 PASS하고 build0을 기록했다. Default generated host에는 trusted callbacks가 없어 default automatic recovery·live provider/native/billing qualification은 open이다.

- **S4 후속 — 실패 진단:** [Generated-host 진단 독립 검토](../evidence/integrations/S4/20260913-generated-recovery-observations/review.md)는 3파일32/32 PASS다. 실제 adapter에 mocked child를 연결하고 real SQLite에서 최초 실패·취소/deadline·오류 비밀값 배제·terminal schema·재개방을 확인했다. Maker build0 및 adapter typecheck0. 최초 stale build와 fixture close-order 실패는 보존한다. Provider 원인·복구 권한·outputless handoff·UI·live 검증은 포함하지 않는다.

- **S4 후속 — 출력 없는 실패:** [독립 handoff 검토](../evidence/integrations/S4/20260913-outputless-failure-handoff/review.md)는 3파일25/25 PASS이고 root 최종 build0이다. Exact failed/clean 영수증과 기존 정리 bytes를 연결해 failed 상태, checker 미실행, acceptance 미검증 및 재개방 후 전체 terminal integrity를 확인했다. Running 상태의 succeeded receipt와 hostile cleanup lineage/tamper는 거부한다. 최초 test import build 실패는 보존하며 preimage는 당시 hash만 있고 전체 byte copy는 없음을 기록했다. Trusted recovery observation·기본 자동 복구·실제 provider/native 검증은 남아 있다.

- **S4 후속 — 복구 관측 연결:** [독립 검토](../evidence/integrations/S4/20260913-generated-recovery-authority/review.md) 1파일19/19와 최종 build0. 기존 원장 bytes를 재사용하는 host recovery observer를 연결해 명시 승인된 automatic-approved fixture의 실제 driver/store가 unknown 관측과 sealed stop을 저장하고 추가 실행하지 않음을 검증했다. Exact lineage·재개방·변조/외래/extra-secret/미래 timestamp 거부를 확인했다. Maker의 retry clock와 잘못된 source_ref 조회 두 실패는 보존한다. 기본 실행은 manual이며 transient/quota/auth 원인, 외부 효과, 후보 자격과 실제 자동 재시도·전환은 남아 있다.

- **S4 후속 — HTTP 실패 관측:** [독립 검토](../evidence/integrations/S4/20260913-local-transport-failures/review.md) 3파일26/26 및 compiled classifier hostile6/6(proxy trap 0), maker build0. Mock fetch의 실제 local transport→isolated adapter가 발급된 HTTP 코드만 보존하고 terminal activity를 재개방해 읽었다. 위조 오류·HTTP200 missing-body·비밀 응답 저장을 거부하며 취소/시간 제한/최초 원인과 정상 adapter 완료를 유지했다. 초기 synthetic transport fixture 선택 오류는 수정 기록에 보존한다. 실제 HTTP 서버나 모델 호출은 없었으며 HTTP 상태는 provider 원인·재시도 권한으로 승격하지 않는다.
- **S5:** [Measured-facts direct-store repair](../evidence/integrations/S5/20260912-measured-facts-authoritative-repair/review.md)는 authoritative snapshot 내부 capture, complete monetary inventory, stored-cutoff historical replay와 tuple conflict를 7개 반례·집중15/15 및 containment1/1로 PASS했다. [명시적 trusted-host Core wiring](../evidence/integrations/S5/20260912-measured-facts-core-wiring/review.md)은 foreign/malformed/conflicting preflight callback0과 immutable replay를 2파일3/3으로 PASS했다. `trialReady:false`이며 real measurement/trial·promotion·UI는 없다. 기존 [accounting outcome wiring](../evidence/integrations/S5/20260912-accounting-outcome-wiring/review-correction1.md)의 missing/estimated `final=false`, revised-unverified class totals null, local count-only 계약은 유지한다. Broad S5 완료는 아니다.

- **S5 후속 — 저장된 비교 조회:** [독립 검토](../evidence/integrations/S5/20260913-comparison-read-ui/review.md)는 실제 SQLite/Core의 저장 snapshot을 registered IPC로 준비 전 조회하고 다른 작업공간에서는 거부함을 포함해2파일9/9 PASS했다. 문구 수정 후 UI8/8은 중복이므로 합산하지 않는다. Maker build0/문법0, full preimages·final hash 확인. 화면은 저장 기록·측정·누락/부족 사유와 통계 검정 미수행·승격 불가를 표시하고 지연 응답을 차단한다. 외래 workspace proof의 immutable envelope 수정 실패와 persisted config 재사용 가설 실패는 보존했다. ID를 아는 기록의 조회만 구현했으며 목록·생성·실제 Electron 시각 검증과 broad S5는 별도다. 로컬 모델 작업은 사용자 요청으로 보류 중이다.

- **S5 후속 — 비교 목록:** [독립 검토](../evidence/integrations/S5/20260913-comparison-list/review.md) 2파일10/10 및 root build0. Core 보호 closure로 현재 작업공간·무결성을 확인한 요약만 반환하며 최대64개 검사/20개 표시, 페이지 계속 조회, 수동 새로고침·선택→상세 재검증을 구현했다. Maker 두 실패는 보존하고 [test-only 보정](../evidence/integrations/S5/20260913-comparison-list/fixture-correction.md)이65개 corrupt 행 이후 IPC와 foreign-workspace 검사를 올바른 다음 cursor로 이어10/10을 통과했다. UI 지연 assertion과 잘못된 첫 페이지 기대값의 실패를 제품 성공으로 바꾸지 않았다. 실제 Electron 시각·비교 생성·승격은 미완료이며 로컬 모델 보류는 유지한다.

- **S5 후속 — 비교용 기록 저장:** [독립 검토](../evidence/integrations/S5/20260913-evaluation-projection-ui/review.md) 3파일16/16, root 최종 build0. 기존 관측을 명시적 버튼으로 immutable projection에 저장하도록 Core→IPC→DOM을 연결했다. 현재 작업공간·등록·관측 결합, 안정적인 host ID, 한 행 재생·재열기·변조/foreign 거부, 승인·정책·run 행 불변과 늦은 응답·오류 초기화를 확인했다. Maker의 fixture 실패와 cap2 종료를 보존했고 [root test-only 보정](../evidence/integrations/S5/20260913-evaluation-projection-ui/fixture-correction.md)은 두 번째 run 렌더 완료를 기다려 JSDOM 종료 오류를 해결했다. `trial:null`인 파생 기록이므로 새 측정·승격 근거가 아니다. 비교 생성 화면·실측·실제 Electron 검증은 남아 있으며 로컬 모델 보류는 유지한다.

- **S5 후속 — 명시적 비교 생성:** [독립 검토](../evidence/integrations/S5/20260913-comparison-create-ui/review.md) 2파일12/12, root 최종 build0. 저장 기록 ID 직접 입력→엄격한 IPC→보호된 Core→기존 immutable 비교 저장소를 연결했다. 각 군 최대64개, 수동 기준선/후보 모드·정책 결합·작업공간·무결성을 검증하며 재생·충돌·재열기·foreign/변조 거부를 실제 SQLite에서 확인했다. Maker의 잘못된 fixture 테이블명2건과 root의 새 기록을 누락한 목록 기대값 실패는 [보정 기록](../evidence/integrations/S5/20260913-comparison-create-ui/root-correction.md)에 보존했다. 독립 검수에서 찾은 새 작업 전환 후 저장 상태 문구 잔류도 수정했다. 고정 기준의 설명용 결과이고 실제 측정·승격 근거가 아니다. 기록 선택 목록·실측·Electron 시각 검증은 남아 있으며 로컬 모델 보류는 유지한다.

- **S5 후속 — 저장 기록 조회·선택 (2026-09-14):** [독립 검토](../evidence/integrations/S5/20260914-comparison-record-picker/review.md) 2파일13/13, maker build0. 저장된 비교용 기록을 수동 조회/다음 페이지로 탐색하고 기준선·후보 입력란에 추가하는 Core→IPC→DOM 경로를 연결했다. 최대64개 검사/20개 반환, 재열기·foreign/손상 건너뛰기·빈 페이지 계속 조회, 기준선 종류·후보 모드·중복/한도와 직접 입력 보존을 확인했다. 최초 fixture의 중복 등록 슬롯·페이지 표시 대기 실패는 [maker 기록](../evidence/integrations/S5/20260914-comparison-record-picker/maker.md)에 보존했고 테스트 데이터/대기만 보정했다. 선택은 저장이나 실행을 자동으로 발생시키지 않으며 실제 비교 생성 경로에서 다시 검증한다. 사용자 지정 비교 기준·실측·정책 승격·실제 Electron 검증은 남아 있고 로컬 모델 보류를 유지한다.

- **S5 후속 — 사용자 비교 기준 (2026-09-14):** [독립 검토](../evidence/integrations/S5/20260914-comparison-criteria/review.md) 3파일17/17, root 최종 build0. 기존 기본값을 유지하면서 아홉 비교 기준을 입력·검증·저장하고 생성/재조회 시 저장 당시 기준을 표시하도록 연결했다. 고성능은 사용자가 명시한 비용 상한이 필요하며 측정값·정책 권한을 생성하지 않는다. 최초4개 UI fixture 실패와 criteria를 ID로 검사한 연결 결함, 모의 Core만 통과한 성공 경로의 검증 부족을 보존했다. Maker cap2 후 추가된 미실행 SQLite 테스트는 [root 완료 검사](../evidence/integrations/S5/20260914-comparison-criteria/root-gate.md)에서 수정 없이 통과했고 별도 Sol이17/17을 재현했다. 실제 측정·통계 자격·승격·Electron 검증은 남아 있으며 로컬 모델 보류를 유지한다.

- **S5 후속 — 측정 사실 근거 요약 (2026-09-14):** [독립 검토](../evidence/integrations/S5/20260914-measured-fact-evidence/review.md) 3파일15/15, root build0. 명시적 호스트가 검증한 저장 사실을 현재 workspace 안에서 다시 검증해 생산자·도구/모델 revision·측정 유무·불확실성을 읽는 Core 경로를 연결했다. Maker의 계획 fixture2회 실패와 root의 foreign 회계 fixture 오류/잘못된 transaction 기대값은 [보정 기록](../evidence/integrations/S5/20260914-measured-fact-evidence/root-correction.md)에 보존했다. Root가 도입한 잘못된 기대값만 원래 값으로 되돌린 후 독립 검수의 남은 두 번째 회차에서15/15을 통과했다. [이전 BLOCKED 검토](../evidence/integrations/S5/20260914-measured-fact-evidence/review-before-root.md)도 보존했다. SQLite/Core 경로는 실제지만 terminal authority·lineage는 주입한 테스트 자료이므로 런타임 자격이나 실측 정확성의 증거가 아니다. 기본 측정 호스트는 비활성이고 trial/승격·UI/IPC·실물 검증은 남아 있으며 로컬 모델 보류를 유지한다.

- **S5 후속 — 종료 검증 결과의 실행 결합 (2026-09-14):** [독립 검토](../evidence/integrations/S5/20260914-measured-terminal-binding/review.md) 3파일16/16, maker build0. 호스트 결과의 verified 상태만 보던 measured-fact 검사를 보강해 결과 attemptId도 현재 저장 시도와 일치해야 한다. 잘못된 ID/상태·누락/추가 필드·prototype·getter·Proxy·Promise를 capture/read/replay/근거 조회에서 거부하고, 정상 응답 복원 후 값과 digest를 유지한다. 최초 재열기 테스트가 기존 Core 소유권을 닫지 않아 실패한 이력은 [maker 기록](../evidence/integrations/S5/20260914-measured-terminal-binding/maker.md)에 보존했고 fixture 수명만 보정했다. 실제 SQLite/Core 검증은 주입한 terminal authority·lineage를 사용하며 기본 호스트와 trial/승격 상태를 변경하지 않는다. 로컬 모델 보류는 유지한다.

- **S5 후속 — 측정 자료 고정 (2026-09-14):** [독립 검토](../evidence/integrations/S5/20260914-measured-capture-snapshot/review.md) 3파일19/19, root build0. 검증 중 근거 콜백이 호스트 원본을 바꿔 저장값과 검증값이 달라질 수 있던 경로를 소유 복사본으로 차단했다. 원본 시간3→999에도 저장·재조회3을 유지하고, 원본 변경과 반환 사실을 분리한다. Maker의 타입 빌드2회 실패·미검증 인계와 root의 타입 보정 실패/성공은 [완료 검사](../evidence/integrations/S5/20260914-measured-capture-snapshot/root-gate.md)에 보존했다. Root가 전체 문자열 생성 전 누적 JSON byte 한도를 추가했고 별도 Sol이19/19을 재현했다. 테스트는 주입한 terminal authority·lineage를 사용하며 실제 측정 정확성·런타임 자격·기본 호스트/승격을 활성화하지 않는다. 로컬 모델 보류는 유지한다.

- **S5 후속 — 측정 근거 조회 화면 (2026-09-14):** [독립 검토](../evidence/integrations/S5/20260914-measured-evidence-ui/review.md) 3파일28/28과 root build0. 명시적 사실 ID 조회가 기존 보호 Core 읽기를 호출하며 생산자·도구/모델·품질/시간/회계 자료 유무만 제한해서 표시한다. 승인 시 결과/진행 조회를 지우고 새 요청을 막으며 새 작업에서 상태를 초기화한다. 회계 유형/유무 일치와 최대1024개 실행의 완전한 전달을 검증했다. Maker 최초 반환 ID 불일치 누락 및 독립 검수의 회계 문자열·승인 잠금·64개 제한 blocker는 [root 수정 기록](../evidence/integrations/S5/20260914-measured-evidence-ui/ROOT-CORRECTION.md)에 보존하고 수정했다. 원본4/인계5/최종5 파일 근거를 확인했다. Mock IPC·DOM + 별도 synthetic Core 범위로 실제 Core→IPC 정상 경로·Electron·실측 자격을 주장하지 않는다. 기본 호스트 비활성·trial/승격 불가 및 로컬 모델 보류를 유지한다.

- **S5 후속 — 측정 근거 Core→IPC 통합 검증 (2026-09-14):** [독립 검토](../evidence/integrations/S5/20260914-measured-core-ipc/review.md) 3파일28/28(Core8·측정UI8·평가UI12), root build0. 기존 Core 테스트를 실제 IPC 호출로 확장해 정상 저장 사실의 준비 전 조회·반복/재시작·제한 DTO·쓰기/재수집0과 보호 경계 및 변조 거부를 확인했다. 제품 변경 없이 이전의 별도 Mock IPC/Core 검증 공백을 해소했다. Maker 재시작 fixture 반환형 실패와 오류 문구 예상값 실패는 보존하고 [root 테스트 수정](../evidence/integrations/S5/20260914-measured-core-ipc/ROOT-CORRECTION.md) 후 독립 재검수를 통과했다. 이전 maker 기록의 Core5/UI15 분류는 잘못됐으며 실제 Core8/UI12였다. 총24/28은 유지하고 이번28과 합산하지 않는다. 원본1·인계1·현재 테스트/의존성6 지문을 확인했다. 합성 계보·주입 종료 권한이므로 실제 런타임/측정/화면 검증은 남아 있고 로컬 모델 보류를 유지한다.

- **S5 후속 — 측정 사실 목록·선택 (2026-09-14):** [독립 검토](../evidence/integrations/S5/20260914-measured-fact-picker/review.md) 3파일35/35, 최종 build0. 보호된 목록 API/IPC가 최대64개 후보를 재검증해20개까지 요약하며 외래·손상 기록을 제외한 빈 페이지도 이어서 읽는다. 화면은10개씩 수동 조회하고 선택한 ID를 기존 상세 경로에서 다시 검증한다. 최초 DOM 대기 실패와 마감 시 발견한 IPC 숫자 검사 누락은 [IPC 수정 기록](../evidence/integrations/S5/20260914-measured-fact-picker/ROOT-CORRECTION.md)에 보존했다. 독립 검수에서 찾은 연속 선택/목록 오류 후 늦은 상세 응답 문제는 [UI 수정 기록](../evidence/integrations/S5/20260914-measured-fact-picker/UI-CORRECTION.md)에 보존하고 지연 응답 테스트로 수리했다. 원본8/인계8/UI수정전8/최종8 파일 지문을 확인했다. 실제 Core→IPC와 DOM 구성요소 검증이며 합성 계보·주입 종료 권한은 실측/런타임/실제 Electron 자격을 입증하지 않는다. 로컬 모델 보류와 기본 호스트 비활성·trial/승격 불가를 유지한다.

- **S5 후속 — 실행 보고서 측정 근거 (2026-09-14):** [독립 검토](../evidence/integrations/S5/20260914-measured-run-report/review.md) 5파일37/37, maker 최종 build0. 기존 실행 보고서 내보내기가 실행별 저장 사실을 재검증해 제한된 생산자/도구/모델·자료 유무·시간 요약을 추가한다. 원본 성과 보고서 digest와 별도 읽기 관계를 보존하고64개 검사/20개 요약/각20개 실행 정보의 한도와 누락·검증 실패를 밝힌다. 초기36개 통과 뒤 검수에서 지적한 임의 요약 삽입 경로·실행 정보 크기·실제 Core 내보내기 근거를 보강해 최종37개를 통과했다. [계획과 명령](../evidence/integrations/S5/20260914-measured-run-report/PLAN.md), 두 pass 로그를 보존했다. 기존 파일 사본4·신규2·최종 지문6을 확인했으며 기존 outcome 테스트1개는 변경되지 않았다. 합성 SQLite/Core fixture는 실제 모델 측정 정확성·런타임·Electron 자격을 입증하지 않는다. 로컬 모델 보류와 기본 호스트 비활성·trial/승격 불가는 유지한다.
- **S7:** [제한된 JS/TS source snapshot](../evidence/integrations/S7/20260913-recovery-source-refresh/review.md) generation `5454b1fe...`의165파일·374 edges·artifact5개·basis127은 당시 revision의 역사 증거다. 이후 `store.ts` 변경으로 현재 source 표시는 미갱신이며 새 capture는 이 단위에 없다. C#/PowerShell·runtime/native/visual proof도 아니다.

2026-09-13 [전체 suite 독립 감사](../evidence/integrations/20260913-regression/review.md)의 191파일191 PASS/1266 PASS/0 FAIL/5 SKIP는 verifier production source 변경 전 역사 gate다. 현재 full suite와 정적 JS/TS source 표시는 모두 미갱신이다. `p10c-manifest` unknown pin은 통과가 아니다. GOAL 상태는 `usageLimited`이며 전체 구현은 미완료다.

아래 상세 기록의 과거 `LATEST`·`CURRENT`·`다음 단위` 표시는 보존된 시점별 handoff다. 현재 상태와 다음 작업은 위 권위 블록이 대체한다.

### 상세 진행 기록

[재사용 공통 게이트 독립 감사](../evidence/integrations/planning/20260912-reuse-gates-audit.md)에 따라 먼저 4개 문장을 `supported-now`로 반영했다: 계약 선행 정의, 최대 3개 후보와 직접 구현의 동일 범위 비교, 비용의 가정/실측 구분, 2회 이내 가설 수정과 disposition/전환 근거다. 이어 [fixture 영수증 구현](../evidence/integrations/S0/20260912-reuse-fixture-receipts/implementation.md)과 [독립 검토](../evidence/integrations/S0/20260912-reuse-fixture-receipts/review.md)를 대조해 fixture 영수증 문장을 좁게 완료 처리했다. R-01/R-03은 역사적 loopback bytes와 현재 source/inline fixture hash를 무네트워크로 재검증했으며 loopback/network를 재실행하지 않았다. R-02/R-04/R-05/R-06은 각각 별도 canonical input/result와 `noDrift` 검증을 갖는다. [R-01~R-06 종합 독립 검토](../evidence/integrations/S0/20260912-reuse-comprehensive-review.md)는 필수 게이트의 현재 상태·제한·교체 경로를 확인해 독립 검토 문장을 좁게 완료했다. 이는 구현 완료·절감 효과·외부 부품 채택·제품 편입을 뜻하지 않는다. Identity/source 결합, license/runtime 영향, 전체 lifecycle 경계, 제품 편입, upstream/Cue 실제 경계 검증, update invalidation/fallback은 계속 open이다.

[S0 비활성 후보 inventory](../evidence/integrations/S0/20260912-candidate-registry/implementation.md)의 초기 7개 PASS와 [사용자 선택 후속 보고](../evidence/integrations/S0/20260912-confirmed-identities/report.md)를 함께 적용했다. NLM과 Hermes의 제품 identity가 해소되어 9개 모두 `inactive / resolved-unqualified / user-selected`이며 unresolved 2개 표시는 대체됐다. 이 문서 확인은 로컬 설치·runtime source·credential·qualification을 확인하거나 후보를 활성화하지 않는다.

[S0 모델 별칭 registry maker 기록](../evidence/integrations/S0/20260912-model-aliases/maker.md)과 correction 1 뒤 [최종 독립 검토](../evidence/integrations/S0/20260912-model-aliases/review.md)를 대조해 모델 별칭 문장을 완료 처리했다. 원문 12개 중 8개는 `resolved-inactive`, `terra`·`luna`·`haiku`·`muse 1.3` 4개는 `inactive-unresolved`다. 로컬 Qwen은 저장된 서버의 opaque ID만 결합하며 marketing/weight identity는 unknown이다. 모든 qualification/enabled는 false이고 entitlement/price/capability는 unknown이며 selection/admission/price/rank/entitlement/dispatch authority grant는 0이다. 이는 계정 자격·실제 availability·가격·capability·dispatch readiness를 입증하지 않는다.

[S3 handoff/activity correction 2 최종 독립 검토](../evidence/integrations/S3/20260912-handoff-activity/review.md) (`c3206db80de4925a3b7389c57d82627fcf07309134dc22dc5a8ec2b36255a740`)는 correction cap 2/2 소진 뒤 **FINAL BLOCKED**다. Canonical-looking payload와 관계 열을 맞추되 거짓 `payload_sha256`(`4444…4444`)과 거짓 artifact hash(`ffff…ffff`, `byteLength:999`)를 넣은 raw SQL handoff/artifact가 삽입됐고 terminal update도 `completed`, `cleanup_verified=1`로 성공했다. 실제 payload SHA-256은 `a26973191752b61695afb14b928a9125eeb674300f195b8bd3e3dac974558522`다. 공개 validator는 이후 `handoff_integrity`로 거부하지만 durable DB에는 false completed 상태가 남고 row-existence UI도 verified handoff로 투영할 수 있다. Handoff/activity 문장과 S3 Unit 2, S4, S5 및 이 terminal authority에 의존하는 작업은 계속 open이며 S3 checkbox 변화는 없다.

[순수 비용/용량 관측 컴포넌트](../evidence/integrations/S2/20260912-cost-capacity-observation/review.md)는 좁은 범위에서 독립 PASS다. actual/estimated/unknown과 관측 시각에서 파생한 stale/future, price/quota/GPU/billing의 observation-only 상태를 고정하고 hostile getter/proxy를 관측 없이 거부한다. 집중9 PASS, 선택/예산/admission 회귀27 PASS, `tsc --noEmit`과 build가 통과했다. 실제 provider 가격·quota·billing finality와 local GPU identity/capacity/load는 여전히 unknown이고 선택·admission·예산 경로에 연결되지 않았다. API/구독/로컬 비용 provenance, 호출·재시도·검증·인계 비용 및 병렬 예약/정산, 가격·쿼터·GPU·billing 불확실성, cold-start·탐색 예산 항목은 계속 open이다.

[R-04~R-06 reuse disposition](../evidence/integrations/S2/20260912-reuse-disposition/implementation.md)을 기존 실험과 현재 authority call chain에 대조했고 독립 read-only 검토는 PASS/CLEAR다. R-04는 inert RoleSpec formatter의 bounded native adoption이며 TeamAI transformer dependency는 이 범위에서 reject했다. R-05는 OpenAI Chat/Ollama fixture용 isolated native normalization component만 accepted이고 production 연결은 defer했다. R-06은 현재 bounded contract의 strict native guards만 선택했고 Ajv/Zod는 schema 규모가 필요할 때까지 defer했다. 외부/fixture transform은 관측 후보만 만들며 bound Cue policy, 현재 host admission, 같은 transaction의 Cue reservation/claim을 대신하지 않는다. `attempt_selection`은 historical explanation only다. 재사용14 PASS와 타입 검사0이 통과했지만 pre-edit focused daemon은 기존 pre-025 fixture의 `orchestration_launch_intent` 누락으로 35/36 PASS, exit1이었고 final pass는 같은 실패와 concurrent SQLite lock으로 34/36 PASS, exit1이었다. 실행 한도에 따라 재시도하거나 clean regression으로 기록하지 않는다. provider 호환성·제품 usage 연결·현재 가격/용량·live billing과 나머지 S2 미체크 항목은 그대로 남긴다.

[durable evaluation comparison snapshot/Core](../evidence/integrations/S5/20260912-evaluation-comparisons/review.md)는 최초 Core bounds-before-read와 저장 `request_digest` 무결성 blocker를 교정한 pass 1/2에서 최종 **PASS**다. migration030 불변 snapshot, 저장 projection/enrollment만의 재구성, 정확한 재생, payload·request digest 변조/재열기/외부 transaction 거부를 확인했다. 관련6개 파일28 PASS/타입 검사0/build0/Core 문법0 및 migration030 원본·배포 parity가 통과했다. 결과는 arm별 projection/trial/missing과 outcome 분모 및 비변환·비교 사유를 기록하지만, 현재 모든 projection이 `trial:null`이어서 비교는 `insufficient`다. `promotionEligible`은 항상 false이고 승인·실행·정책 쓰기는0이다. 따라서 체크리스트의 넓은 S5 일곱 항목은 모두 미체크로 유지한다. 다음 단위는 실제 평가 실행 주장이 아니라 도구/모델 revision, 품질·시간, 가격 출처와 비용 내역을 host가 검증해 수집하는 measured-facts ingestion 공백이다.

[수동 평가 기준선 authority](../evidence/integrations/S5/20260912-evaluation-baseline/review.md)는 correction pass 2/2에서 최종 **PASS**다. migration029의 명시적 host-verified 사용자 authority, 고정 candidate/policy, 승인·실행 전 atomic 선언/dataset/등록, 현재 workspace와 host verifier가 없을 때 Core 기본 거부를 확인했다. 공개 enrollment API는 완전히 canonical한 위조 선언 행도 `manual-baseline` authority로 받지 않는다. 관련4개 파일16 PASS/타입 검사0/build0/Core 문법0 및 migration029 원본·배포 parity가 통과했다. 검토의 최초 extra-authority blocker와 correction pass 1의 canonical-forgery blocker는 같은 문서에 보존되어 있다. 이 구성요소는 승인·실행·정책 변경·승격·비교 가능성을 부여하지 않는다. complete paired cohort와 실제 trial이 없으므로 체크리스트의 넓은 `동결 평가셋과 별도 holdout, 수동 기본 조합 기준선`은 미체크로 유지한다. 다음 단위는 승격을 비활성화한 durable comparison snapshot이다.

[관측 평가의 durable trial projection](../evidence/integrations/S5/20260912-evaluation-trials/review.md)을 Sol이 독립 검토했다. migration028 원본·배포 해시 일치, 관련3개 파일19 PASS/타입 검사0/build0을 확인했다. projection은 저장된 평가군 identity와 관측 outcome을 그대로 사용하고, 정확한 재생을 보장하며 변조·재열기 손상·외부 transaction을 닫힌 방식으로 거부한다. 호출자 측정값이나 승격 권한은 받지 않는다. 현 outcome 계약은 신뢰 가능한 revision·품질·시간·가격 출처·네 비용 요소를 제공하지 않으므로 모든 결과는 안정적으로 `trial:null`이고 비교 불가다. 실제 측정·비교·승격과 통합 평가 실행은 여전히 미완료다.

[평가 UI/IPC 소스 컴포넌트](../evidence/integrations/S5/20260912-evaluation-ui/review.md)는 hostile projection 보정 후 독립7개 파일31 PASS/타입 검사0/IPC·preload·renderer 문법 검사0으로 통과했다. source review 해시는 `C78F8A43...CE9147A`, [projection 보정](../evidence/integrations/S5/20260912-evaluation-ui/projection-correction.md)은 `32DBCE40...879B08`이다. 이 통과는 실제 Electron 화면과 분리된 소스 컴포넌트 범위다.

실제 Electron 평가 UI는 2/2 한도를 소진해 **FINAL FAIL**이다. [attempt1](../evidence/integrations/S5/20260912-evaluation-ui/actual-attempt1/actual-audit.md)은 선택 manifest의 존재하지 않는 canonical 경로에서 UI 전 실패했다(`5B4D4410...6F678`). [attempt2](../evidence/integrations/S5/20260912-evaluation-ui/actual-attempt2/actual-audit.md)는 실제 renderer prepare까지 갔으나 준비 경로에 run-policy 행이 있다고 가정한 시나리오와 `finally`에서 접근할 수 없는 cleanup guard wrapper 결함으로 실패했다(`4F9EEE42...DF9B2`). attempt2의 SQLite 백업 무결성·해시 검증, 자식 종료, 정확한 소유 root 삭제는 성공했다. 모델·native helper·provider·승인·실행·Stop·평가 작업은 없었고 재실행하지 않는다. 다음 구현 단위는 실제 준비 의미에서 정책 결합을 만드는 durable observed-trial/comparison projection이며, 이 결과로 S5나 프로젝트 전체 완료를 주장하지 않는다.

[평가 관측 이력과 Core 연결](../evidence/integrations/S5/20260912-evaluation-observations/review.md)을 GPT-5.6 Sol이 구현하고 별도 Sol이 독립 검토했다. 관련23 PASS/타입·Core 문법 검사0/build0, migration027 원본·배포 해시 일치를 확인했다. 요청 재생의 예상 revision 일치와 저장 관측의 구조 검증을 보완했고, 실제 Core API의 작업공간 차단·거부 시 쓰기0까지 검증했다. 관측은 원장을 읽은 뒤 별도로 저장한 역사 기록이며, 목록은 현재 등록 대상과 지정 저장 순번까지의 관측을 구분한다. 미관측·실패도 유지한다. IPC/사용자 화면·자동 수집·성능 실측은 아직 없다. 초기 검토의 오래된 배포본 테스트 실패도 별도 이력으로 보존했다.

사용자 요청에 따라 root는 범위·검증 기준·체크리스트를 지휘하고, 구현과 독립 검토는 각각 최소 맥락의 GPT-5.6 Sol에게 맡긴다. [승인 전 평가군 등록](../evidence/integrations/S5/20260912-evaluation-enrollment/review.md)은 관련18 PASS/타입 검사0/build0으로 완료했다. 검토에서 발견한 정책 모드 불일치와 무제한 원문 읽기를 수정했으며 초기 실패 기록을 보존했다. 실제 실행 입력과 평가 입력의 일치는 미검증이고 수동 기준선 등록·앱 연결·평가 관측 수집은 아직 미완료다.

전체 통합은 미완료다. 이번 조회에서 GOAL 도구 상태는 `usageLimited`였으며 새 목표 생성이나 완료 처리는 하지 않았다. 아래 완료 항목은 각 검증 범위에 한정하며, 이전 기록의 GOAL `active` 표기는 당시 상태다.

과거 실행 선택 UI는 [독립16 PASS](../evidence/integrations/S4/20260912-recovery-run-picker-ui/review.md)와 [실제 Electron attempt1 독립 감사](../evidence/integrations/S4/20260912-recovery-run-picker/actual-attempt1/actual-audit.md)를 통과했다. 설치 generation을 실제 확인한 host의 목록3회·신원 목록1회, 다른 작업공간/자식 실행 제외, 과거 대상 유지·현재 복귀·늦은 응답 폐기·Stop 표시를 검증했다. 화면3개를 직접 확인했고 원장 조회 중 변경0, 백업 무결성·소유 프로세스 종료·임시 폴더 부재를 확인했다. 합성 원장 메타데이터와 Stop 표시 fixture 범위이며 실제 OS 관찰·모델 실행·재시작 복구 전체는 미완료다. 이 성공 검증은 반복하지 않는다.

선택 이유 UI [attempt2](../evidence/integrations/S2/20260912-selection-explanation-ui/attempt2-review.md)도 전체 실패로 보존한다. 실제 로컬/TEST 비용 정책 결정2건의 저장→Core→IPC→화면 및 펼침 상태 검사는 통과했고 PNG2장을 직접 확인했다. 이후 별도 display fixture가 정렬된 첫 단계(check/미시작)를 기록 단계로 잘못 재사용해 추가 문구 검사에서 실패했다. 제품 오류로 단정하지 않으며, 전체 실제 QA 체크는 하지 않았다. 두 번의 한도는 소진했고 백업·프로세스·임시 폴더 정리는 완료했다. 과거 실행 선택 UI의 별도 통과가 이 실패를 대체하지 않는다.

[S5 실행 결과 수집](../evidence/integrations/S5/20260912-outcome-collection/review.md)은 독립22 PASS/타입 검사0/build0으로 체크했다. 실패 이력·취소 요청·청구와 정리 불확실성을 보존하고, 조회 크기 제한과 민감 식별자 마스킹을 검증했다. 기존 인수 검증기의 파일 경로 의존성 때문에 삭제된 작업 경로는 조회 불가일 수 있다. 평가 trial 생성·품질/시간 실측·정책 승격은 아직 없다.

[명시적 보고서 연결](../evidence/integrations/S5/20260912-outcome-report/review.md)도 독립29 PASS와 정책 ID 후속4 PASS를 통과했다. 원본과 성과 자료의 별도 읽기 시점·해시를 유지하며 상태 조회나 Stop 동작은 변경하지 않는다. 실제 Electron [attempt2 독립 감사](../evidence/integrations/S5/20260912-outcome-report/actual-attempt2/actual-audit.md)도 통과했다. 미확인 결과·품질/시간 null, 스크립트/Node/preload 비활성, 백업·원장 불변·소유 프로세스와 폴더 정리를 확인했고 PNG3개 중 서로 다른 화면2개를 직접 검토했다. [attempt1 시간 초과 실패](../evidence/integrations/S5/20260912-outcome-report/actual-attempt1/actual-audit.md)는 보존한다. 검증 스크립트의 대기 방식만 교정했고 이전 실패의 정확한 원인을 단정하지 않는다.2회 한도는 소진했으며 추가 실행하지 않는다. 실제 모델 성능이나 전체 S5 완료의 증거는 아니다.

[도구별 등록 공백](../evidence/integrations/S0/20260912-capability-gaps/report.md)도 정리했으며, 조사 문서에 있는 도구를 실제 지원 완료로 표시하지 않는다.

### 이전 진행 기록 — 위 최신 상태로 대체됨

선택 이유 화면 QA attempt1은 [실패 감사](../evidence/integrations/S2/20260912-selection-explanation-ui/actual-attempt1/actual-audit.md)로 보존했다. 테스트가 준비한 task가 승인 대기 상태여서 `run_not_running`으로 거부됐고, 시도·선택·예약 기록은0개였다. UI 검증에는 도달하지 못했으며 프로세스·백업·임시 폴더 정리는 정상이다. 합성 fixture의 상태 준비를 교정해 별도 오프라인 확인 중이고, 남은 Electron attempt2는 아직 실행하지 않았다.

[과거 실행 목록 백엔드](../evidence/integrations/S4/20260912-recovery-run-picker/review.md)는 독립13 PASS/타입 검사0, build0으로 체크했다. 작업공간 범위·부모 실행·조회 한도와 미완전한 계보를 구분한다. 선택 이유 UI는 독립18 PASS/타입 검사0을 통과했으며, 실제 원장→Core→화면 QA attempt1을 실행 중이다. 모델·helper는 호출하지 않고 시작을 거부하는 합성 runtime만 사용한다.

[복구 조회 UI 실제 Electron QA](../evidence/integrations/S4/20260912-native-recovery-ui/actual-attempt1/actual-audit.md)도 통과해 체크했다. 화면3개를 직접 검토했고, 합성 응답의 상태·시각·늦은 A응답 폐기·오류 및 Stop 표시 유지, 준비된 run2개 외 실행/세션/승인0, 백업 무결성·정확한 임시 폴더 부재를 확인했다. 실제 Stop 또는 native helper 호출의 증거는 아니다. 성공한 QA는 반복하지 않으며, 선택 이유의 화면 연결을 다음 단위로 진행한다.

[선택 설명 조회 결과](../evidence/integrations/S2/20260912-selection-explanation/review.md)는 독립49 PASS/타입 검사0과 배포 연결 후속 감사까지 통과했다. build0 후 실제 fixture 실행 원장을 compiled projection으로 읽는4 PASS를 확인했다. 화면 표시는 아직 후속이다. 복구 조회 UI는 독립12 PASS/타입 검사0을 통과했고, 실제 Electron QA의 프로필 격리·최종 결과 기록을 실행 전에 점검 중이다.

Claude 출력 처리 실험은 [독립 범위 검토](../evidence/integrations/S1/20260912-claude-protocol/fit-review.md)에 따라 테스트 fixture로 분리했다. 합성 형식7개와 기존 실험9개 검사는 통과했지만 실제 CLI 이벤트 형식·인증·실행 자격은 미검증이다. 운영 어댑터 파일과 잔여 배포 파일을 보존본을 남긴 뒤 제거했고, 실제 지원 체크는 하지 않았다.

[선택 판단 영속화](../evidence/integrations/S2/20260912-attempt-selection/review.md)는 독립49 PASS/타입 검사0, build0 및 배포025 SQL 일치로 체크했다. 정책·실제 선택 출력·시도 계보를 같은 예약 transaction에 저장하고 재생 시 관측·선택·예약·실행을 반복하지 않는다. 업그레이드 전 미기록 목록은 한 번만 고정하며 신규 누락은 오류다. 선택 설명의 제한된 조회 결과와 UI 연결은 후속 진행 중이다.

[보호된 복구 조회 host/Core](../evidence/integrations/S4/20260912-native-recovery-host/review.md)는 독립22 PASS/타입 검사0, build0을 통과했다. 실제 설치 generation의 검증을 포함하지만 OS 조회는 대역을 사용한 연결 검증이다. 두 테스트 환경 오류(보호 경로 중첩, 전체 해시 작업에 비해 짧은 테스트 timeout)는 보존하고 교정했다. UI 연결을 시작했으며, 선택 판단 저장은 제작 측49 PASS 이후 독립 검토 중이다.

[읽기 전용 복구 helper의 실제 독립 감사](../evidence/integrations/S4/20260912-native-recovery-observer/actual-attempt1/actual-audit.md)까지 통과해 해당 기반 항목을 체크했다. 실제 OS 조회2회로 테스트3 PID/FileTime 일치와 자식2개 정상 종료 후 부재를 확인했다. DB 불변·백업 무결성·임시 폴더 부재도 독립 확인했으며 모델 호출은 없었다. 현재는 보호된 host/Core 조회 연결과 선택 판단의 원자적 영속화·재생을 구현 중이다. 실제 AppContainer 복구나 실패했던 Qwen workflow의 최종 인수 완료를 뜻하지 않는다.

[읽기 전용 native 복구 관찰 모듈](../evidence/integrations/S4/20260912-native-recovery-observer/review.md)은 독립18 PASS/타입 검사0, build0 및 배포 helper 해시 일치를 통과했다. 저장된 세 PID의 생성 시각·생존 여부와 경로를 조회하며 원장 변경·종료·재실행·인수 권한은 없다. 실제 Windows helper 검증은 별도 소유 테스트 프로세스로 준비 중이다. 앱 연결과 재시작 복구 전체는 아직 미완료이며, 아래의 구현 전 상태는 역사 기록이다.

[운영용 신원 연결의 실제 Windows QA](../evidence/integrations/S1/20260911-native-identity-commit/actual-attempt1/actual-review.md)도 통과했다. 고정 generator1회와 결정적 검사기1회이며 Qwen 요청은 없었다. 모델 응답 callback에서 독립 SQLite 연결로 선행 commit을 확인하고 실행 중3 PID/FileTime을 외부 조회값과 대조했다. 검사기는 저장된 신원/원시 frame/결과 및 정리를 검증했으며 실행 중 FileTime 별도 조회는 하지 않았다. 총6 PID와 정확한 경로의 부재, 백업2행/무결성, 선택된 source/compiled 해시 일치를 확인했다. 이 native proof의 누적2 실행 잠금은 유지하며 반복하지 않는다. source/build 동결은 해제했다. 읽기 전용 재시작 관찰은 [재사용 조사](../evidence/integrations/S4/20260911-native-recovery-reuse.md) 단계다.

2026-09-12 후속: [운영용 신원 commit 연결](../evidence/integrations/S1/20260911-native-identity-commit/review.md)은 독립34 PASS/타입 검사0, 최종build0을 통과했다. 두 실행기 모두 외부 transaction을 프로세스 생성 전에 거부하며, 명시된 host 기준 경로·세션·신원을 대조해 저장한 뒤에만 요청을 허가한다. 취소 대기와 정리 조회의 시간 제한은 실제 result/completion을 발명하지 않는다. 실제 Windows 무모델 검증은 준비 중이고 현재 source/build는 동결했다. 원래 실제 Qwen workflow의 실패와 두 gate의 소진 상태는 그대로다.

[024 실행 신원 저장소](../evidence/integrations/S1/20260911-native-identity-store/review.md)는 독립6 PASS/타입 검사0, build0 및 [배포 스키마 확인](../evidence/integrations/S1/20260911-native-identity-store/root-compiled-registration.json)을 통과했다. 실제 run/session 연결, 불변 저장·재생·commit 이후 참조, 재개방/변조 거부를 확인했다. Windows 경로는 드라이브가 명시된 형식만 지원하며 UNC는 미지원이다. 저장된 구조가 OS 소유권이나 정리 완료를 증명하지 않는다. 다음 구현은 native 신원 frame을 모아 모델 요청/검사 허가 전에 commit하는 연결이며, 읽기 전용 복구 관찰은 그 후속 단위다.

[등록 후보 목록](../evidence/integrations/S1/20260911-candidate-inventory-ui/review.md)은 독립46 PASS/타입 검사0 및 [실제 Electron QA](../evidence/integrations/S1/20260911-candidate-inventory-ui/actual-review.md)를 통과했다. 실제 core/catalog와 격리 SQLite를 통해 목록·불가 상태·오래된 관측/늦은 응답·긴 ID 표시를 확인했다. 네 정책이 서로 다르면 조합 비교를 미확인으로 표시한다. 인증 참조/endpoint를 노출하지 않고 작업/시도/세션/모델 호출0을 확인했다. 첫 교정 전 QA는 역사 기록으로 보존했다. 다음은 [실행 신원 저장소](integration/NATIVE_IDENTITY_IMPLEMENTATION.md) 구현이며 native 연결·읽기 전용 복구는 후속 단위다.

**최신 실제 실행은 실패 상태로 보존한다.** [새 Electron gate 독립 감사](../evidence/integrations/S4/20260911-fresh-electron-gate/live-review.md): 실제 자격 수집은 성공·정상 정리됐고 workflow는 기대 JSON42바이트를 저장했지만, 정리 관측/최종 실행 영수증/검사기/인수 기록 없이 시간 초과했다. 이 gate의 Qwen2회도 모두 소진했으며 재시도하지 않는다. 알려진31 PID 부재와 자격 경로24개 부재를 확인했으나 workflow의 native 식별자가 영속화되지 않아 전체 정리는 미확인이다. 원본과 일관 SQLite 복사본을 보존했다.

[프로필 바인딩](../evidence/integrations/S4/20260911-electron-profile-binding/review.md)은 별도 독립32 PASS 및 실제 무모델 Electron 검증을 통과했다. workflow 후속 오프라인 재현은 정리 저장소가 점을 포함한 실제 후보 ID를 거부하는 오류를 확인했다. 후보 ID에 한정한 수정은 build0 및 [독립10 PASS](../evidence/integrations/S4/20260911-cleanup-candidate-id/review.md)다. 합성 실행기와 실제 정리 저장소의 연결 검증으로, 실패한 실제 workflow를 성공으로 바꾸지 않는다. 다음 구현은 [읽기 전용 후보 목록](integration/CANDIDATE_INVENTORY_PLAN.md)이다. 아래 미실행/준비 중 설명은 이전 시점 기록이다.

[후속 전체 회귀](../evidence/integrations/20260911-late-regression/review.md)는 build0, 131파일·931 PASS/5 조건부 SKIP/0 FAIL로 종료했다. source/script/test356개와 compiled257개가 전후 동일하고 새 프로필 잔여물이 없음을 확인했다. 기존 출처 불명 p10c-manifest는 별도 제외했으며, 이전746 PASS/2 FAIL/5 SKIP 기록은 보존한다. 이 결과는 **Electron 프로필 격리 후속 변경 전 snapshot**이다. 프로필 바인딩 변경은 별도의 집중 검증을 거친 뒤 새 실제 모델 gate에 사용한다.

[로컬 회고 저장소·core](../evidence/integrations/S6/20260911-retrospective/review.md)는 독립7 PASS/타입 검사0를 통과했다. migration023으로 안전한 원장 컬럼의 고정 요약과 출처 투영 해시를 보존한다. [UI 독립 검토](../evidence/integrations/S6/20260911-retrospective-ui/review.md) 관련36 PASS 및 [실제 Electron QA](../evidence/integrations/S6/20260911-retrospective-ui/actual-review.md)도 통과했다. 생성·동일 ID 재조회·새 초안·원장 재열기를 확인했으며 시도/세션/모델 호출0이다. 회고가 검증 완료를 뜻하지 않는다. [전용 자격 CLI](../evidence/integrations/S4/20260911-qualification-entry/review.md)는 초기 독립13 PASS이고 `qualify:local-json`로 등록했다. 실제 런타임 metadata 보강은 후속 검토 중이며 실제 명령은 아직 실행하지 않았다.

[실제 기본 시작 부분 검증](../evidence/integrations/S4/default-startup/partial-review.md): 최초 QA 관찰 코드의 초기화 시점 실패를 교정한 다음 실제 package entry·창·preload·IPC와 무설정 비활성을 관측했다. 숨긴 창 캡처 실패로 전체 시작 검증은 미통과다. 원본 실패와 정리 기록을 보존했고, 실제 표시 상태에서의 별도 compositor 검증을 준비했다. [새 Electron 모델 검증 계획](integration/FRESH_ELECTRON_JSON_GATE.md)은 아직 준비 단계다.

후속 [기본 시작 비시각 결과의 독립 검토](../evidence/integrations/S4/default-startup/review.md)는 실제 시작·IPC·정상 종료와 SQLite 무실행 상태·14개 소스 해시 일치를 확인했다. 창의 표시 상태가 false여서 캡처는 실패했고 전체 `passed:false`를 유지한다. 표시되지 않은 원인은 확정하지 않았다. [검색 고정 평가](../evidence/integrations/S6/20260911-knowledge-holdout/results.json)는 recall@3 개선과 함께 오탐 증가도 관측해 품질 gate가 false이며, 독립 방법론 검토 중이다. 작은 작성 평가셋이고 실제 사용자 검색 품질로 일반화하지 않는다.

최신 시작 경로 후속: package.json의 진입점을 app/start.mjs로 연결했다. [기본 시작 구성요소](../evidence/integrations/S4/20260911-default-startup/review.md), [명시적 자격 수집 API](../evidence/integrations/S4/20260911-explicit-qualification/review.md), [JSON 입력 UI](../evidence/integrations/S4/20260911-json-template-ui/qa-review.md), [설정 core](../evidence/integrations/S4/20260911-local-json-setup-core/review.md)는 한정된 독립 검증을 통과했다. 실제 프로젝트 시작과 현재 설치의 새 자격·workflow 성공은 아직 검증하지 않았다.

설정 UI 실행 경합 교정은 [독립 관련22 PASS](../evidence/integrations/S4/20260911-local-json-setup-ui/review.md)와 [실제 Electron 재검증](../evidence/integrations/S4/20260911-local-json-setup-ui/race-fixed-review.md)을 통과했다. 첫 execute IPC 실패에도 Stop이 보이고, 미확인·미해결·다른 실행의 해제 응답에는 잠금을 유지한다. 해당 실행의 명시적 소유권 해제만 새 준비를 허용한다. [이전 실패](../evidence/integrations/S4/20260911-local-json-setup-ui/race-qa-review.md)와 [core 소유권 관련12 PASS](../evidence/integrations/S4/20260911-execution-ownership-core/review.md)는 보존한다. 모델 호출은0이며 실제 새 자격/workflow 검증으로 확대하지 않는다. 아래 이전 시점 기록의 대기 항목은 이 후속 기록과 각 독립 증거를 함께 읽는다.

### 후속 실제 canary 및 비금전 로컬 기반 상태

최신 후속 연결: [호출수 드라이버](../evidence/integrations/S3/20260911-local-driver/review.md) 독립33+추가 기한1 PASS, [호출수 UI](../evidence/integrations/S3/20260911-local-count-ui/qa-status.md)14 PASS/실제 Electron, [설정 bootstrap](../evidence/integrations/S4/20260911-default-generated-bootstrap/review.md)20 PASS, [명시적 JSON 입력 및 bootstrap 후속 교정](../evidence/integrations/S4/20260911-json-template-core/review.md) 관련17 PASS/타입 검사0를 확인했다. 이 검사 수에는 공통 회귀의 중복이 있으므로 합산한 고유 검사 수를 주장하지 않는다. JSON 전용 IPC/화면과 guarded-entry는 독립 검토 중이며, 기본 앱 시작점은 아직 변경하지 않았다.

[설치 지문 helper](../evidence/integrations/S4/20260911-installation-identity/review.md)14 PASS는 선행 캡처에 사용할 구성요소 검증이다. 실제 앱의 import 순서나 새 자격을 발행한 것이 아니다. [역사적 소스 비교](../evidence/integrations/S7/20260911-source-comparison/independent-review.md)는 보존된104/109파일 snapshot의 추가5·내용 변경12·관계 추가12를 대조하고 실제 Electron에서 확인했다. 이후 변경된 현재 소스를 동일 snapshot으로 표시하지 않는다.

이 절이 아래 이전 시점의 미실행·교정 중 기록보다 최신이다. [실제 자격 증거 감사](../evidence/integrations/S4/20260911-generated-json-live-canary/qualification-evidence-resume-review.md)는 당시 checker/model 모두 live M1·M2·M3 PASS를 확인했다. 이후 [실제 workflow 실패 감사](../evidence/integrations/S4/20260911-generated-json-live-canary/resume-result-review.md)는 producer 응답35바이트가 저장됐지만 guardian 잔존으로 blocked/cleanup_verified=0, checker 시도0·acceptance_final0임을 확인했다. 131ms 뒤 verified-clean 관측은 기존 DB에 있었으나 과거 차단 상태를 소급 변경하지 않았다. 자격1회+workflow1회로 **누적 Qwen2회 상한은 소진**됐고, workflow 예산의 잔여 숫자는 추가 호출 승인이 아니다.

원본 파일은 [보존 manifest](../evidence/integrations/S4/20260911-generated-json-live-canary/live-evidence/manifest.json), [초기 결과](../evidence/integrations/S4/20260911-generated-json-live-canary/live-evidence/initial/result.json), [resume 결과](../evidence/integrations/S4/20260911-generated-json-live-canary/live-evidence/resume/result.json), [일관 SQLite 복사본](../evidence/integrations/S4/20260911-generated-json-live-canary/live-evidence/ledger-consistent.sqlite)에 보존했다. 후속 제품 소스가 변경됐으므로 이 자격은 현재 설치의 자격이 아닌 역사 증거다. 현재 source에 대한 fresh 측정과 별도 호출 권한 없이 재실행하지 않는다.

- [Guardian 대기 교정](../evidence/integrations/S4/20260911-generated-guardian-poll/review.md): residual만 최대10초 재관측하고 unknown/abort를 성공 처리하지 않음, 독립15 PASS. 실제 canary 재실행 없이 합성 잔존 seam으로 검증했다.
- [019 durable resource](../evidence/integrations/S6/20260911-resource-store/review.md): 독립12 PASS/build0 및 compiled migration019/020 자동 적용 확인. [core 연결](../evidence/integrations/S6/20260911-resource-core/review.md)은 자원4+기존13 PASS, 같은 DB의 승인 전 pin·업데이트/제거/원본 삭제/재시작 후 고정 bytes를 확인했다. [BOM 검사](../evidence/integrations/S6/20260911-knowledge-bom/review.md)는 원본 해시·인용 위치를 보존한다. Resource UI는 독립 검토 대기여서 완료 체크하지 않는다.
- [020 설정V1](../evidence/integrations/S2/20260911-local-host-settings/review.md): 독립6 PASS. [설정V2](../evidence/integrations/S2/20260911-local-host-settings-v2/review.md): 독립8 PASS, 명시 version으로 새 local 정책만 해석하고 기존V1 canonical bytes/금전 참조를 보존한다. 설정은 실행 자격이 아니다.
- [021 invocation count](../evidence/integrations/S2/20260911-local-invocation-budget/review.md): 독립7 PASS와4개 UPSERT 거부 probe. 금액/환불/공급자 수신 사실이 아닌 불변 실행 의도 횟수다.
- [022 local policy](../evidence/integrations/S2/20260911-local-selection-policy/review.md): 독립8 PASS 및 최종 공유 build0/compiled 등록 확인. 고정 후보2개·호스트 boolean 확인·CAS/불변 지문, legacy 실행 후 최초 바인딩과 금전 정책 중복을 거부한다. 네 모드가 동일 pair를 사용하며 ranking/효율 개선을 주장하지 않는다.
- [소스 행렬](../evidence/integrations/S7/20260911-source-matrix/review.md): 별도109파일/224관계 snapshot, 8그룹 집계와 원본 목록 보존, 독립24 PASS·실제 Electron PASS. 이전104파일 목록은 그대로 보존했다. 코드 구조의 정적 요약이며 실행 의미·안전·전체 AR02/03 완료로 확대하지 않는다.

후속 [로컬 엔진·정책 identity 연결](../evidence/integrations/S3/20260911-local-engine/review.md)은 기존 금전 정책 전용 조회를 수정한 뒤 독립101 PASS와 공유 build0를 확인했다. [횟수 관측](../evidence/integrations/S3/20260911-local-observation/review.md)은 독립20 PASS/타입 검사0, [로컬 JSON 호스트](../evidence/integrations/S4/20260911-generated-json-local-host/review.md)는 독립25 PASS다. 합성 executor 검증이며 실제 workflow 성공으로 확대하지 않는다. [리소스 UI 코드 검토](../evidence/integrations/S6/20260911-resource-ui/review.md)와 [실제 Electron QA](../evidence/integrations/S6/20260911-resource-ui/qa-review.md)도 통과했으며, 네이티브 폴더 선택창 조작은 미검증이고 900px 미만은 기존 최소 폭 제약이 있다. 이후 수정 중인 호출수 승인 화면과 bootstrap은 별도 검토 대상이다.

기본 앱 활성화·현재 subject 재자격·성공한 실제 workflow 인수와 S0–S7 전체는 미완료다. 아래 전체 회귀746 PASS/2 FAIL/5 SKIP 원본 이력도 그대로 유지한다.

### 이전 시점 기록 — 실제 자격 수집 전

사용자의 작업 진행 승인은 유지된다. 부모가 확인한 GOAL 도구 상태는 **usageLimited**이며, 아래 과거 기록의 active는 해당 시점 이력이다. S0–S7 전체 완료를 선언하지 않는다. Live canary의 첫 invocation은 module linking 단계에서 실패했으며 DB/profile/모델 호출은 시작되지 않았다. 별도 수정·재측정 기록은 아래와 같으며, live collector 자격 발행과 실제 생성 워크플로 인수 통과는 아직 없다.

- [현재 넓은 회귀와 보정 검토](../evidence/integrations/20260911-current-regression/review.md): build0, 101파일·746 PASS/2 FAIL/5 SKIP, 원본 실패 기록 보존. 명시 제외는 기존 p10c-manifest 한 suite다. 원인은 신규 진단 spawn의 정확한 허용 목록과 report preload 메서드를 누락한 proof 기대값이었다. 두 기대값만 보정한 뒤 독립 집중19 PASS/조건부3 SKIP를 확인했다. 이를 전체 suite 재통과로 바꾸지 않는다. 전후243파일 목록은 일치했으며 기존 cue.worker moniker6개의 출처는 확인하지 못해 정리 완료로 표시하지 않았다.
- [S7 실제 소스 목록 추출](../evidence/integrations/S7/20260911-source-structure/review.md): 독립104파일·212관계와 입력 bytes/list 지문을 대조했다. 이는 이후 app/generated-json-host.mjs의 CJS interop 수정 **이전 snapshot**이며 현재 소스와 동일하다고 하지 않는다. [브라우저/시각 검토](../evidence/integrations/S7/20260911-source-structure/electron-review.md)는 표시·격리·외부 요청0을 통과했지만 전체 높이13,287px의 평면 표/목록은 읽기 좋은 아키텍처 다이어그램으로 부족하다고 판정했다. AR-02/03은 미완료다. 동결 중 재추출하지 않았다.
- [나머지 CLI 신원 조사](../evidence/integrations/S0/20260911-remaining-cli-identity/report.md): Hermes/OpenClaw/Orca의 wrapper·entrypoint·선언 역할을 구분했다. CLI 실행/인증·모델 호출은0이며 실제 버전/런타임·stream·정리·권한 자격은 미확인으로 남는다.
- [Live canary 준비/실패 기록](../evidence/integrations/S4/20260911-generated-json-live-canary/preparation.md): 첫 시작은 host의 CJS named import에서 실패해 모델 요청0이었다. 별도 maker 교정은 default import와 실제 Node module-link 회귀 검사, build0/host11 PASS를 기록했다. 이어 고정 native 경로 가정 실패도 모델 호출 전에 발견해 수정·재측정했으며, 이는 성공한 collector/workflow 증거가 아니다. 수정 전 subject 지문은 재사용하지 않는다. 실측 재시도와 최종 독립 검토는 root가 관리한다.

- [Core readiness](../evidence/integrations/S4/20260911-core-host-readiness/review.md): 독립8 PASS/타입 검사0. unavailable 사유를 불변 데이터로 유지하며 준비 쓰기/legacy 우회를 거부한다. 자동 재자격이나 hot activation은 없다.
- [생성 JSON 호스트 조립](../evidence/integrations/S4/20260911-generated-json-host/review.md): 같은 DB에서 producer/checker·capture·정리·인수를 조립하고, 승인 전에 입력 깊이/예상 출력 크기를 거부한다. 합성 실행 경로의 독립 검토 PASS이며 실제 Qwen·새 경계 자격 증거는 아니다. 현재 billing unknown과 보류 예약을 유지한다.
- [Subject v2](../evidence/integrations/S1/20260911-model-subject-v2/review.md): 필수 collector/진단 파일과 시험·compiled 파일 누락/변경 거부, 독립4 PASS/타입 검사0. 과거273파일 실측 manifest를 현재 것으로 승격하지 않았다.
- [고정 진단](../evidence/integrations/S1/20260911-fixed-qualification/review.md): 독립 Windows5 PASS. 소유 신원·Job 사건·파일 불변·localhost 양성 대조와 정리를 관측했다. TCP timeout을 firewall drop으로 바꾸지 않으며 production 동작/전체 subject와 별도로 결합해야 한다.
- [Collector](../evidence/integrations/S1/20260911-model-qualification/review.md): 독립 native fixture6 PASS/타입 검사0. fixture transport/subject는 eligible=false다. 초기 scan 이전에 로드된 의존성이 빌드로 바뀌는 문제를 API가 자체 차단한다고 주장하지 않는다. 따라서 live 측정/발행은 소스 동결 후 새 compiled 프로세스에서만 진행해야 한다.
- [앱 보고서 코드](../evidence/integrations/S7/20260911-report-app/review.md): 파일 재읽기 경합을 이미 검증한 bytes의 data URL로 수정한 뒤 독립7 PASS/build0. [실제 Electron 흐름](../evidence/integrations/S7/20260911-report-app/electron-review.md)은 버튼→실제 preload/IPC/core/별도 창, 외부 요청0, 다른 창 sender 거부, Node/JS/preload 없음과 PNG를 확인했다. 실제 SQLite에 합성 실패/대기 상태를 넣은 fixture이며 실제 모델 작업 성공이 아니다. 직접 subframe 발신 실험과 upstream deliver는 이 QA 범위 밖이다.

다음은 source freeze를 유지한 fresh-process 실제 collector 측정/발행과 제한된 JSON 변환의 실제 준비→승인→제작→독립 검사→정리→인수다. 일반 코딩 도구 자격, 모든 후보 통합, 네 모드 개선 실증과 S6/S7 잔여 범위도 남아 있다.

## 실행 단위 20260911-baseline

- 기준 커밋: `8e2afa6366e3af62f7115b2c67be799130f8dfdf`.
- 기존 사용자 변경(README, 출시 문서, 통합 계획)을 보존한다.
- `npm test` 기준선: 361 passed, 5 skipped, 2 failed, exit 1. 증거: `evidence/integrations/S0/20260911-baseline/npm-test.log`, `result.json`. Windows의 `grep` 부재와 Codex 고정 해시 불일치는 후속 시도 뒤 미해결로 보류했다. 상세 원인과 사용자 결정은 아래 기록을 따른다. 해시 검사를 완화하지 않았다.
- 소스 검사와 실제 실행 측정은 별개다. 과거 P12/P13 로그를 현재 조합의 실행 자격으로 승격하지 않는다.

## S0 P13 대조 — 소스 조사 결과

| 항목 | 구현/증거 상태 | 현재 자격 판단 |
|---|---|---|
| measurementSubject 지문·변경 무효화 | `measurement-subject.ts`, 관련 테스트 존재 | 지문 생성만으로 자격 없음 |
| P1 정지 / P3 부모 사망 | run-scoped probe 및 fixture sensitivity 구현 | 현재 실물 도구 전체 벡터 미확보 |
| P2 B1~B4 | 기존 v0.1 집행/시험 일부 존재, P13 통합 측정 경로 미완성 | 미측정 |
| P2 B5 | 잔여물 observer와 normal/stop/crash fixture 존재 | fixture 통과를 실물 자격으로 사용 금지 |
| P4 위반 봉인 / P5 출력 파싱 | 기존 집행/파싱 코드와 별도로 P13 평가 연결 필요 | 미측정 |
| M1~M3 모델 전용 | P13 측정/자격 평가 연결 미완성 | 미측정 |
| 자격 admission | 초기 감사 후 평가 함수와 공통 실행 계약 기반 구현·테스트 완료. 앱/dispatch 연결 없음 | 실제 증거 저장소와 실행 경로 연결 전 신규 후보 비활성 |

참조: `daemon/src/measurement-subject.ts`, `daemon/src/probes/`, `daemon/test/p13-*.test.ts`, [P13 spec](P13_SPEC.md). 독립 소스 감사: `p13_audit` (읽기 전용). fresh baseline 결과는 별도 기록한다.

## 로컬 발견과 제한

`local-tools.json`에는 PATH에서 발견한 실행 경로만 저장한다. Codex/Claude/Ollama/Orca/Hermes/OpenClaw/agy가 발견되었지만 identity·auth·모델·권한 검증 완료를 의미하지 않는다. Paseo/herdr는 PATH에서 발견하지 못했다. 기본 로컬 모델 포트 11434/1234에는 listener가 없었다. 다른 포트/서버의 부재까지 주장하지 않는다.

인증 내용이나 토큰은 읽거나 출력하지 않았다. 사용자 제공 llama.cpp endpoint에서 아래의 짧은 로컬 추론만 실행했다. 계정 연결·모델 다운로드는 하지 않았다. 런타임 활성화는 실제 지원 계약과 자격 증거가 확보된 후보에만 허용한다.

## Qwen 실제 연결 — 2026-09-11

- 사용자 제공 endpoint: `http://127.0.0.1:8085/v1`, 모델 ID: `qwen38-27b-unc`.
- `/models`에서 동일 ID와 서버 보고 `n_ctx: 147456`(144K)을 확인했다. 실제 최대 길이 추론을 검증한 것은 아니다.
- `scripts/reuse/model-transport.mjs`로 `Reply with exactly OK. /no_think`를 보내 SSE 텍스트 `OK`와 정상 terminal을 받았다. 약 1.9초에는 모델 목록 조회도 포함된다.
- 사용량 `unknown`, 실제 provider 정지 여부 `unknown`을 유지했다. 연결 성공은 M1~M3 또는 실행 자격 통과가 아니다.
- 증거: `evidence/integrations/S1/20260911-qwen-live/result.json` (transport SHA-256 포함).

## 재사용 실험 검증

- R-01~R-06 후보/직접 구현 대안과 제한은 `docs/reuse-decisions/`에 기록했다. 외부 패키지의 제품 편입을 확정한 것은 아니다.
- 모델 transport 및 사용량 정규화: 독립 검토 26/26 PASS. 증거: `evidence/integrations/S2/20260911-usage/reuse/R-05/review.md`.
- Claude 실행 명세 및 역할 계약: 독립 검토 15/15 PASS. 증거: `evidence/integrations/S0/20260911-baseline/reuse-review.md`.
- 위 코드는 격리 실험이며 앱 실행 경로 편입, 전체 라이프사이클 및 실제 도구 자격은 별도 미완료다.

## 작업 순서

1. 기준선 및 R-01~R-06 후보 비교 기록.
2. source-bound capability admission과 공통 runtime seam 보완.
3. 분리된 모델 transport fixture 실험(실제 모델 추론과 구분).
4. 관련 계약 검사·회귀·독립 검토 후 해당 세부 항목만 체크.

S1 실물 후보 및 S2 이후 제품 기능은 아직 완료되지 않았다. 전체 목표를 이 기록의 중간 산출물로 완료 처리하지 않는다.

## 검증 제한 및 후속 복구

기존 Codex 핀 복구는 보류다. 공식 npm 0.153.0 패키지 무결성 검증은 통과했으나 실행 파일 hash가 프로젝트 기대값과 다르며, 공식 GitHub 동일 버전 digest도 npm과 같았다. 원본 핀 artifact의 출처/백업이 필요하다. `pinned-toolchain.json`에 두 가설과 결과를 기록했고 핀 변경이나 바이너리 실행은 하지 않았다. 따라서 manifest 회귀는 통과 처리할 수 없다.

전체 `git diff --check`는 기존 사용자 README의 Markdown 줄바꿈용 trailing spaces를 보고한다. 이 작업에서 README를 변경하지 않는다. 신규/수정 구현의 검사는 별도로 기록한다.

실행 자격 평가 기반: `daemon/src/capability-admission.ts`와 8개 Vitest 테스트 구현, build 및 독립 검토 PASS. 증거: `evidence/integrations/S1/20260911-admission/review.md`. 호스트 증거 저장소 및 실행 직전 연결, 실물 P/B/M 측정은 남아 있어 새 도구를 활성화하지 않았다.

P2 이식성 수정은 두 가설 뒤 보류했다. Node 스캔에서 기존 `$1` 치환 문법 오탐이 드러났고, AST 예외 가설은 설치 TypeScript 7의 compiler API 부재로 실패했다. 통과하지 못한 p2 변경은 되돌리며 기존 실패를 유지한다. `grep-fix.json`의 실패 근거를 보존한다. 별도 후속 작업에서 r3와 충돌하는 과거 금액 금지 assertion의 목적부터 재정의해야 한다.

최종 재사용 집중 검사: `node --test scripts/reuse/model-transport.test.mjs scripts/reuse/usage-normalization.test.mjs scripts/reuse/role-contract.test.mjs scripts/reuse/claude-launch-spec.test.mjs` — 41 passed, exit 0. 실제 Qwen 호출은 반복하지 않았다.

사용자 결정: 2026-09-11 원본 Codex 핀의 출처를 알 수 없으며 해당 문제를 보류하고 계속 진행하도록 지시했다. 추가 원본 추적/복구는 중단한다. 기존 manifest 실패는 알려진 미해결 기준선으로 유지하며 자동 통과·핀 교체·신규 실행 자격 부여의 근거로 사용하지 않는다. 나머지 S1 구현을 계속한다.

공통 실행 기반: `daemon/src/integration-runtime.ts`, `daemon/test/integration-runtime-contract.test.ts`의 9개 계약 테스트와 build PASS. 독립 검토 `evidence/integrations/S1/20260911-admission/runtime-review.md`. 호스트 권한·현재 지문 판정 이후에만 시작하고, 모델/구현 역할별 자격과 중복 실행 ID를 검사한다. 취소 ACK는 완료가 아니며 호스트 정리 관측이 있어야 settled가 된다. launch 대기 중 중단/timeout, 영속 복구, 이벤트·사용량 전달, 실제 Codex 및 로컬 어댑터 연결은 후속 작업이다.


관련 기존 지문 회귀 포함 검사: daemon에서 `npx --no-install vitest run test/capability-admission.test.ts test/integration-runtime-contract.test.ts test/p13-measurement-subject.test.ts --reporter=dot` — 3 files / 24 tests passed, exit 0.

기존 release 회귀: daemon에서 `npx --no-install vitest run test/release.test.ts --reporter=dot` — 14 passed, exit 0. 격리된 외부 경로 쓰기 차단, daemon 재시작 및 기존 dispatch/보고 경로의 fixture 기반 실행 검사도 포함한다. 유료 원격 모델 실측이나 신규 후보 자격 검증은 아니다.

## S2 선택 정책 기반

`daemon/src/selection/policy.ts`와 `daemon/test/integration-selection.test.ts`: 네 모드, 고정 정규화 기준, 품질 하한, 호스트 제공 자격/인증/데이터/호환/쿼터/메모리 필터, 비용·기한 상한, 수동 고정, ID 기반 동점 처리를 구현했다. 추정치는 재시도·검증·인계를 포함한 완료 전체 범위여야 하며 출처·시각·통화가 필요하다. unknown/stale 및 보수적 상한 부재를 엄격한 한도에서 통과시키지 않는다.

검증: daemon에서 `npm run build` exit 0, `npx --no-install vitest run test/integration-selection.test.ts` 10 passed/exit 0. 독립 검토: `transport_review`, `evidence/integrations/S2/20260911-selection/review.md`. 검토에서 발견한 기한 필터 누락을 수정했다. 입력 자격은 호스트의 전제이며 실물 자격을 증명하지 않는다. 출력은 실행 허가가 아니고 실행 직전 재판정·원자적 예산 예약이 별도로 필요하다. UI/설정 저장/동적 수집/실제 성능 비교/실행 경로 연결은 미완료다.

## 다음 구현 단위

1. S1 실행 시작 중 timeout/cancel과 부분 시작 실패의 정리·복구 기록, 이벤트/사용량 전달 계약.
2. 현재 Codex 및 로컬 모델의 호스트 어댑터 연결과 실제 측정 저장소, P/B/M 실측. Qwen 연결 PASS를 자격으로 대입하지 않는다.
3. S2 원장 기반 원자적 예약/정산과 정책 저장, 실행 직전 재판정, 모드 UI 연결.
4. 이후 S3 작업 DAG·인계·감시와 S4 재계획·요구사항별 완료 검증. S5~S7은 기존 순서 유지.

현재 산출물은 S0 조사와 S1/S2 기반 구현 체크포인트다. 앱에서 모든 도구/모델을 자동 지휘하는 전체 기능이나 S단계 전체를 완료로 표시하지 않는다.

## GOAL 전체 구현 실행 — 2026-09-11

사용자 요청으로 GOAL을 active 등록했다. 전체 S0~S7 완료 전 complete로 표시하지 않는다. 작업 계약은 `docs/integration/LOOP.md`: scorecard 90/100, critical contracts 7/7; 실제 retry/replan/격리 규칙은 문서에 있으며 점수 자체는 런타임 완료 근거가 아니다.

- 시작 lifecycle: 17개 집중 검사와 admission 포함 독립 25개 PASS. `evidence/integrations/S1/20260911-runtime-lifecycle/review.md`. 시작 timeout/abort/late completion 소유권, unknown cleanup 복구 핸들, 입력 옵션 snapshot을 보강했다.
- 로컬 모델 transport를 daemon `adapters/local-model.ts`로 옮겼다. 15개 검사·독립 검토 PASS: `evidence/integrations/S1/20260911-local-model/review.md`. 취소 뒤 버퍼링된 완료를 전달하는 검토 결함을 수정했다.
- 실제 canary `node scripts/reuse/qwen-daemon-canary.mjs`: 16 output-token 상한에서는 length/incomplete가 관측됐다(`live-2026-09-11T06-08-51-505Z.json`). 진단 후 128 상한 1회 재시도로 OK, input19/output31/total50과 정상 terminal을 받았다(`live-2026-09-11T06-09-02-611Z.json`). 두 증거 모두 S1/20260911-local-model 아래 보존. 서버 실제 정지/가격/M1~M3는 여전히 unknown/미측정이다.
- SQLite 예산 예약/정산: migration008와 9개 검사·독립 검토 후 추가 REPLACE 불변성 검사를 진행한다. 실제 다중 연결 경쟁을 검사했고 API 실행 연결은 남아 있다.
- 정책 저장소: migration009, 10개 검사·독립 검토 PASS. `evidence/integrations/S2/20260911-policy-store/review.md`. REPLACE/UPSERT 불변성 우회를 수정했다. 실제 openLedger로 integration_budget, selection_policy_snapshot, selection_run_policy 세 테이블 생성 확인(exit0).
- r3의 금액 예산 구현에 맞춰 과거 금액 소스 단어 금지 assertion을 제거하고 R7을 토큰/금액 한도 독립 집행으로 교체했다. 이전 grep 이식성 재시도의 반복이 아니라 승인된 제품 정책 전환이다. P2+release 33 PASS/build0, 독립 검토 `evidence/integrations/S2/20260911-policy-migration/review.md`. 따라서 기존 grep 실패는 해결됐으며 원본 Codex pin 실패는 별도 보류다.
- S3 plan 계약: 10개 검사·독립 검토 PASS, `evidence/integrations/S3/20260911-plan/review.md`. 원문 requirement IDs, 독립 verifier 의존성, 범위/후보 집합 및 결정적 readiness를 검사한다. 실제 DB claim/감시/최종 acceptance는 다음 실행 저장소에서 연결한다.

현재 진행: SQLite 실행 저장소(migration010), 도구/모델/MCP/하위 오케스트레이터 catalog. 다음 연결은 정책·선택·예약·자격·claim·실제 adapter를 하나의 실행 경로로 잇는 작업이다. 부분 모듈 통과를 전체 자동 지휘 완료로 승격하지 않는다.

### GOAL 체크포인트 — 영속 실행 경로

- Catalog 8 PASS/독립 검토: `evidence/integrations/S1/20260911-catalog/review.md`.
- 자격 증거 저장소 migration011/store 7 PASS, admission 포함 독립15 PASS: `evidence/integrations/S1/20260911-capability-store/review.md`. 과거 pass 참조로 최신 fail/unknown/동시 충돌을 우회하는 검토 결함을 수정했다. 저장소는 실제 probe 실행의 대체물이 아니다.
- 예산 migration008의 REPLACE 우회 수정까지 9 PASS/독립 검토 갱신: `evidence/integrations/S2/20260911-budget/review.md`.
- 영속 orchestration migration010: 10 PASS/독립 검토. claim fresh일 때만 launchRequired=true, 재요청/완료/복구는 재실행하지 않는다. 기존 workspace_write_lease를 공유하고 미검증 소유권에 대한 DELETE/UPDATE/REPLACE/INSERT OR IGNORE를 차단한다.
- 기존 recovery.ts 및 AppDaemon 초기화 연결: 미검증 writer lease/쓰기 진행 표시를 보존하고 모델 전용 실행도 크래시 차단한다. 신규3/기존 관련 포함 독립6 PASS: `evidence/integrations/S3/20260911-recovery-integration/review.md`.
- engine 연결: 실제 SQLite 정책 snapshot→후보 선택→claim/예약 한 transaction→runtime→호스트 증거 정산을 잇는다. 8 PASS/독립 검토: `evidence/integrations/S3/20260911-engine/review.md`. 동시 replay가 pending launch의 정리 완료를 오판하는 결함과 요청 시각에 의존하던 신선도 검사를 수정했다. 호스트 시계가 신선도를 판정한다.
- 정책 참조 표기: engine `selectionRevisionRef(snapshot)`는 `policyId:revision`이며 digest도 일치해야 한다. runtime의 runId는 attemptId다. 실물 어댑터는 각 attempt에 새 봉투와 SessionOwner를 연결해야 하며 workflow 부모 봉투를 그대로 전달하면 안 된다.

넓은 회귀: `npx --no-install vitest run --exclude test/p10c-manifest.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` — 60 files, 460 passed / 5 skipped, exit0, 571.12초. 로그/명령: `evidence/integrations/20260911-goal-regression/`. 사용자 보류 manifest만 제외했으며 그 검사를 통과한 것은 아니다. 이 실행의 파일 수집 이후 작성된 capability-store와 engine은 위의 별도 집중·독립 검사로 검증했다. source/doc 범위 `git diff --check` exit0; 사용자 README는 수정하지 않는다.

GOAL 상태는 active다. 다음 작업은 실제 per-attempt 봉투/계정/어댑터와 engine 연결, 실제 P/B/M 자격 관측, 선택 이유·상태·비용·Stop의 앱 UI 연결이다. 실행 중 자동 재시도/재계획과 요구사항별 독립 최종 완료(S4), 성과 평가(S5), 지식/플러그인(S6), 근거 시각화(S7)는 아직 남아 있다. 불확실한 시작·종료는 실행/예산 소유권을 보존한 채 blocked로 유지하며 기본 설정이나 fixture로 우회하지 않는다.

### GOAL 체크포인트 — 단계 권한과 구체 실행 어댑터

- `integration-executors.ts`: Codex 기존 host 실행과 로컬 OpenAI 호환 SSE를 공통 계약에 연결했다. 실제 loopback HTTP, 취소, 잘린 결과, 콜백 실패/시간 제한, 시도 계보 7 PASS 및 독립 검토: `evidence/integrations/S1/20260911-executors/review.md`. 이 검사는 실물 CLI 자격이나 최종 공급자 정산을 증명하지 않는다.
- `stage-envelope.ts` / migration012: 승인된 부모보다 좁은 봉투를 새 attempt의 실제 task/run에 연결하고 저장된 연결을 재시작 후 재검증한다. 가짜 session/PID를 생성하지 않는다. 10 PASS 및 독립 검토: `evidence/integrations/S3/20260911-stage-envelope/review.md`.
- 엔진 `prepareExecution`은 claim/예산 예약과 동일 transaction의 동기 훅이다. 실패 시 모두 롤백하며 runtime은 후보 해석에 attemptId와 role을 전달한다. 관련 엔진9/runtime17 독립 PASS. migration012를 openLedger와 빌드 자산 복사에 추가했다.
- 연결 후 집중 회귀: build exit0, stage10 + engine9 + runtime17 + executor7 + recovery3 = 46 PASS (2026-09-11 15:47 KST). 이전 넓은 회귀 결과와 구분한다.
- 관측 DTO/renderer 독립 검토 PASS: SQLite/DOM 7개 및 새 core 연결 1개, 기존 P9 core 13개 회귀 통과. 미실행 검증 단계/미정리 시도/대응하지 않는 예약이 남으면 최종 비용은 미확인이다. 인수 증거 없는 orchestration 완료 카드 제목은 `실행 완료 · 인수 미확인`이며 legacy 카드는 기존 표시를 유지한다. 검토: `evidence/integrations/S3/20260911-observation/review.md`.
- 실제 숨김 Electron44.2.0 화면 QA exit0: `scripts/reuse/observation-electron-proof.mjs`, `evidence/integrations/S3/20260911-observation/electron-*`. 실제 SQLite에서 만든 fixture를 새로 로드한 renderer에 표시해 정책/단계/미확인 비용·인수/중단 버튼/legacy 숨김을 확인하고 PNG를 검토했다. 실제 IPC 실행/중단 완료 증거는 아니다. 최초 proof 실행기의 ESM readiness deadlock은 수정1회 후 해결했다.
- core projection 테스트 첫 fixture는 workspace/state 중첩을 거부당했다. 두 경로를 형제 디렉터리로 수정 후 1 PASS, 독립 재검사 PASS. 제품의 경로 격리를 완화하지 않았다.

기본 앱 실행은 아직 기존 Codex 경로다. 새 엔진을 실제 앱 dispatch로 연결하는 호스트 구성, 실물 P/B/M 증거 발행, S4 이후 전체 작업은 계속 남아 있으며 GOAL을 완료로 변경하지 않는다.

### GOAL 체크포인트 — 승인 계획과 앱 드라이버 연결

- 승인 전 계획 UI: `integration-approval-plan.test.ts` 3개 및 관측 7개 독립 PASS, 실제 숨김 Electron 폼 제출/legacy/준비 실패 초기화/관측 회귀 PASS. 증거 `evidence/integrations/S3/20260911-approval-plan/`. fixture 응답으로 UI 전달을 검사했으며 실제 IPC/도구 실행을 증명하지 않는다.
- main-process 호스트 구성 `runtime.orchestration`이 있을 때만 새 드라이버를 사용하는 core 분기를 구현했다. 준비 transaction이 성공한 뒤에만 메모리에 run을 공개한다. 승인 전에 정책/계획/예산을 저장하고, 단계별 기존 writer lease를 사용하므로 부모 lease를 중복 취득하지 않는다. 기본 구성은 기존 경로 그대로다.
- 새 드라이버는 실제 store/budget/runtime/binder/engine을 조립한다. 한 번에 한 단계, 동일 start Promise 재사용, 정리 미확인 시 다음 단계 차단, 모든 단계 실행 후에도 독립 요구사항 증거가 없으면 `acceptance_unverified`로 차단한다. Stop/close는 불확실 소유권과 예약을 보존하며 미정리 close는 DB를 닫지 않는다.
- 독립 검토 중 서로 다른 workflow의 같은 plan digest가 scope를 공유할 수 있는 결함과 outer transaction 롤백 후 캐시가 종료를 방해하는 결함을 발견했다. 실행별 binder와 실행/시도 없는 롤백 준비의 폐기로 수정했다. 최신 driver8+실제 core 진입1 = 9 PASS, build0 및 최종 타입 검사0, 독립 PASS: `evidence/integrations/S3/20260911-driver/review.md`.
- core 진입 검사는 자격 PASS fixture를 주입하지 않는다. 실제 runtime의 증거 누락 거부, 기존 Codex로 우회 0, 예약 보존, Stop과 미정리 종료 거부를 검증했다. 사용자 모델/도구의 실물 자격 통과와는 구분한다.
- 앱 실행/종료 변경에 대한 넓은 회귀: `evidence/integrations/20260911-app-driver-regression/`, 69 files 중 68 pass/1 fail, 512 tests pass/5 skip/1 fail, exit1, 586.47초. manifest 제외 사유는 이전과 같다. 실패는 기존 P5 업그레이드 fixture가 task/run ID 열만 만들고 실제 기본 envelope 테이블을 생략한 경우였다. 전체 실행을 PASS로 바꾸지 않는다.
- P5 보정: 실제001 스키마에서 P5 추가3테이블을 제거하고, 업그레이드 전 부재·후 생성·재개방·기존 데이터 보존을 확인한다. 잘못된 DB는 계속 거부하되 openLedger가 실패한 연결을 닫아 Windows 파일 잠금을 남기지 않는다. 관련17 PASS/독립 검토: 같은 회귀 폴더 `review.md`. 새 S4 단위는 별도 집중 검증이며 위 전체 회귀 범위로 소급 주장하지 않는다.

### GOAL 체크포인트 — 승인된 요구사항과 로컬 모델 식별

- `verification/requirements.ts` / migration013: 계획의 요구 ID 집합과 정확히 일치하는 원문·유형·필수 여부·검사기 revision/설정 digest/대상을 승인 전에 고정한다. 사용한 checker 선언도 digest에 포함한다. 승인/시도 이후 신규 등록과 UPDATE/DELETE/REPLACE를 거부한다. checker 삭제 후에도 당시 계약 조회는 가능하지만 현재 실행 가능성을 뜻하지 않는다. 9 PASS/독립 검토 `evidence/integrations/S4/20260911-requirements/review.md`.
- migration013을 실제 ledger/배포 자산에 연결하고 driver.prepare에서 optional requirements를 검증·동일 transaction에 저장한다. 사용자 승인 전에 전체 계약과 지문을 화면으로 전달하며, 등록되지 않은 기준은 명시적으로 표시한다. driver/core/승인/관측22 PASS/독립 검토 `S4/20260911-requirements-integration/review.md`, 실제 숨김 Electron fixture 폼/화면 `S4/20260911-approval-criteria/electron-*`. 아직 합격 판정이나 checker 실행이 아니다.
- Qwen 식별: 실제 포트 소유 PID/시작 시각, GGUF 13,223,069,536 bytes와 executable 디스크 SHA256을 스트리밍 측정했다. `S1/20260911-qwen-identity/identity.json` 원본을 보존한다. 인자 파서의 따옴표 내 가짜 옵션 문제를 독립 검토에서 발견해 Windows native argv 파서로 수정하고15개 오프라인 검사를 통과했다. 새 파서의 실제 모델 경로/PID 대조 기록은 별도 `parser-correction.json`이다. redirect는 거부하고 해시 timeout은 블록 사이 협력적 검사라는 한계를 표시한다. 독립 검토 `review.md`. 작은 executable의 해시는 로드된 DLL/전체 provider 신원이나 M1~M3/P 자격을 보증하지 않는다.

다음 구현은 등록된 실제 checker의 증거 수집·현재 산출물/독립 계보 재확인·원자적 인수 확정이다. 별도로 모델 전용 Windows 클라이언트 경계를 구현하여 현재 전체 권한 host의 직접 HTTP transport를 자격 통과로 오해하지 않도록 한다. 이미 실행 중인 llama 서버는 클라이언트 격리 경계 밖의 공급자로 명시하며, 서버까지 격리됐다고 주장하지 않는다. 전체 S0~S7 GOAL은 active다.

### GOAL 체크포인트 — 인수 검증 단위와 격리 실패

- `verification/acceptance.ts` / migration014 단위: 승인 기준에 맞는 호스트 원본 관측, 모든 제작자와 구별되는 검증 주체, 현재 산출물과 실행 계보를 확인한다. 불투명한 내부 평가만 확정할 수 있고 writer lease 아래 영수증 저장과 부모 완료를 같은 transaction으로 처리한다. 자기신고·unknown·취소·변경된 산출물은 완료를 만들지 않는다. 독립 12 PASS/build0: `evidence/integrations/S4/20260911-acceptance/review.md`. 최종 비용 미확인은 예약을 유지하며 인수 결과와 별도로 표시한다. 앱 연결과 실제 검사기는 아직 별도 작업이다.
- 모델 전용 Windows 클라이언트는 실측에서 자체 AppContainer 프로필 및 TEMP 쓰기를 허용했다. 작업 폴더 거부만으로 M2 통과를 주장하지 않는다. 자식 실행 UNKNOWN과 네트워크 ETIMEDOUT도 M1/M3 통과 증거가 아니다.
- suspended CreateProcess 이후 ACL 재고정이라는 별도 가설도 두 차례 실패했다. 현재 실행기는 쓰기 권한 잔존을 읽기 검증하면 ResumeThread 전에 종료한다. 최신 검사 1 PASS/3 FAIL이며 이전 ping/정리 성공을 최신 실행 성공으로 인용하지 않는다. 기록: `evidence/integrations/S1/20260911-model-boundary/post-create-seal.md`. 공유 경로 ACL이나 서버 설정은 바꾸지 않았고 자격 발행은 차단 상태다.
- 다음 작업은 인수 검증의 driver Stop/close 연결과 콜백 없는 이력 조회·완료 화면이다. 격리 실패는 독립 검토 후 다른 경계 설계를 검토하며 같은 ACL 시점 수정을 반복하지 않는다. 전체 GOAL은 active다.
- 후속 격리 진단: native API로 새 DACL을 구성하자 원하는 RX mask와 실제 ACL bytes가 일치했다. 이 측정에 근거한 실행기 변경 후 독립 검사는 3 PASS/1 FAIL로 개선됐다. 작업/profile/실제 TEMP/외부 쓰기는 EPERM, protocol·timeout·관측된 부모 사망 정리는 통과했다. 자식 UNKNOWN/네트워크 ETIMEDOUT은 그대로 실패이며 M1/M3·전체 자격은 미완료다. 최신 소스 지문과 독립 결과: `S1/20260911-model-boundary/review-native.md`. 이전 시점 가설 실패 기록은 보존한다.

### GOAL 체크포인트 — 인수 완료의 앱·이력·화면 연결

- migration014를 ledger와 배포 자산에 연결했다. 조건부 driver는 모든 단계가 정리된 후 호스트 검사기를 호출하고 내부 평가를 원자적으로 확정한다. Stop/close/시간 초과는 수집을 취소하며 늦은 콜백이 부모를 완료하지 못한다. 인수 완료와 공급자 비용 확정은 분리되어 미확인 예약은 유지된다.
- 콜백 없는 `readAcceptanceHistory`는 최종 영수증 또는 최근 평가의 hash·원본 증거·기준·단계 계보를 확인한다. 검사 pass만 있고 영수증이 없으면 미확인이다. 화면에는 요구별 pass/fail/unknown과 과거 기록임을 표시하고 원시 경로/증거는 내보내지 않는다.
- 독립 검토 중 driver가 UI보다 약한 영수증 조회를 사용하던 불일치를 수정했다. 두 경로 모두 이력 무결성 검사를 사용하며 손상된 증거는 인수 미확인이다. 독립 연결6파일39 PASS/build0, 최종 수정 후 driver14 PASS/build0. 단일 최종40개 실행이나 전체 회귀 통과로 합산하지 않는다. 증거: `S4/20260911-acceptance-integration/review.md`.
- 실제 숨김 Electron5상태와 PNG2장 검토 통과: 인수 영수증, 실패, 미확인, 영수증 없는 pass, legacy. 최종 reader 안정화 후 화면 소스 지문도 일치했다. `S4/20260911-acceptance-ui/electron-review.md`. 합성 DTO 화면 검사이며 실제 공급자/검사기 실행을 증명하지 않는다.
- 기본 실물 호스트·실제 checker, 복구/재계획, S5~S7 및 전체 후보 자격은 남아 있다. 별도 진행 중인 launcher 강제 종료 guardian과 기존 자식/네트워크 미확인 항목은 완료 처리하지 않는다. 전체 GOAL은 active다.
- 후속 guardian 단위는 독립 검증을 마쳤다. launcher의 profile/root/client 생성 전에 별도 guardian을 준비하고 PID+시작 시각과 Job을 묶는다. launcher 강제 종료 후 Job 정리와 활성 프로세스 부재를 확인한 뒤 자체 경로만 지운다. 실제 강제 종료1 PASS(3.73초), child/경로/guardian 잔존 없음. `S1/20260911-model-boundary/review-hardkill.md`. 기존 자식 UNKNOWN/네트워크 ETIMEDOUT과 모델 자격은 여전히 미완료다.
- 실제 경계 관측 추가: suspended child의 AppContainer SID/빈 capabilities, Job flags0x2008·active limit1·정확한 구성원, 생성 시각, loopback 예외 없음까지 조회한다. 불일치/API 실패는 resume 전에 차단한다. 실제 probe PID와 profile EPERM을 대조하고 강제 종료 회귀까지 독립2 PASS(6.81초). `S1/20260911-model-boundary/review-observation.md`. 설정 선언만을 읽은 결과가 아니지만 M1/M3·공급자 자격은 여전히 unknown이며 실제 모델 broker 연결도 남아 있다.
- 자식 실행 실패 원인의 양성 증거를 추가했다. 자체 Job completion port에서 실제 active-process-limit 초과 이벤트를 받아 단일 통제 실행 시도와 대조한다. 이벤트 없음은 unknown이며 가짜 자식 PID를 만들지 않는다. 독립 원인 관측/강제 종료2 PASS(9.50초): `S1/20260911-model-boundary/review-process-limit.md`. 별도 WFP 읽기 사전 검사는 engine open/close 성공, 수집 상태 조회 ACCESS_DENIED(5)였다. 원본 `wfp-preflight.json`에 보존했으며 권한 상승·전역 설정 변경은 하지 않았다. 이는 별도 subscription 권한까지 거부됐다는 뜻은 아니다. 네트워크 실제 drop과 전체 자격은 미확인이다.

### GOAL 체크포인트 — 사용자 모드 선택과 저장

- migration015와 `selection/preferences.ts`: 기본 efficiency/revision0 조회는 DB를 변경하지 않는다. 네 모드 저장은 CAS로 다른 창/연결의 변경을 덮어쓰지 않으며 재개방 후 유지된다. 설정 저장은 후보 자격·정책·예산·실행 권한을 만들지 않는다.
- core/한정된 IPC/preload/화면을 연결했다. 이번 실행의 선택과 저장 기본값을 구분하고 실행 준비 시 모드를 고정한다. driver는 호스트가 반환한 실제 정책 모드와 요청 모드가 다르면 승인 바인딩 전에 거부한다. 이후 기본값 변경은 이미 준비된 승인 계획을 바꾸지 않는다. 실제 orchestration 호스트가 없으면 설정은 사용할 수 없다고 표시한다.
- 독립 연결7파일40 PASS/build0: `S2/20260911-selection-preference/review.md`. 저장4/core4/UI3/driver15/승인5/관측7/P11surface2를 포함한다. 동시 작성 중이던 retry migration helper의 임시 TS 오류는 해당 작성자가 고쳤고 최종 build가 통과했다. 이 검토는 미완료 retry 기능을 포함하지 않는다.
- 실제 숨김 Electron에서는 네 모드 전달·저장 revision·고정 승인 계획·충돌 갱신·미지원 상태를 확인했다. 최초 캡처에서 이전 compositor frame을 발견해 proof만 1회 보정하고 최종 PNG를 직접 검토했다. `S2/20260911-selection-preference/electron-*`. UI fixture 결과이며 실제 모델 선택 효율·기본 앱의 실물 실행을 입증하지 않는다.
- 다음 작업은 실패 이력을 보존하는 제한된 재시도의 DB/엔진/드라이버/인수 연결과 실제 로컬 모델 broker다. 네트워크 drop 실증·실제 checker·기본 실물 호스트 및 S5~S7은 남아 있으며 전체 GOAL은 active다.

### GOAL 체크포인트 — 제한된 재시도와 실제 Qwen broker

- migration016은 이전 시도·영수증·단계 FK를 보존해 업그레이드하고 재시도 계약/연결을 불변 저장한다. 실제 호스트가 확인한 최신 clean 일시 실패만 새 ID로 재시도한다. 기존 미확정 예약도 누적 비용에 남긴다. 백엔드 독립28 PASS/build0: `S4/20260911-retry-backend/review.md`. 부모가 openLedger 자동 적용과 실제001–015 업그레이드 fixture를 연결했다.
- driver는 승인된 한도·절대 기한을 실제 실행과 인수 검사까지 적용한다. 동기 호스트 콜백이 이벤트 루프를 막아도 마지막 candidate.launch 직전 기한을 다시 확인한다. 과거 실패한 모든 구현자의 신원도 독립 검증자와 비교하며, 모든 시도 정리/청구가 확인돼야 최종 비용을 표시한다. 화면은 최신 단계 한 줄과 실패 이력을 함께 보여준다.
- 독립 연결 실행107개 중106 PASS/1 FAIL은 시도0건 fixture가 새 이력 삭제 금지 규칙에 걸린 경우다. 테스트를 처음부터 시도0건으로 생성하도록 보정한 뒤 독립 관측9 PASS/최종 build0. 운영 보호 규칙은 완화하지 않았다. 최종 검토: `S4/20260911-retry-integration/review.md`. 앞선 부모49개 실행의 timeout marker 실패도 가짜 시계로 실행 중 콜백의 취소를 명확히 검사하도록 보정했으며 운영 취소 코드는 바꾸지 않았다. 각 최초 실패 기록을 보존한다.
- 실제 숨김 Electron 재시도 승인/횟수/실패 이력/미확정 비용/legacy 표시와 PNG2장 검토 통과: `S4/20260911-retry-observation/electron-*`. 합성 UI fixture이며 실제 공급자 실행/과금 보증은 아니다.
- `model-only` broker는 argv에 프롬프트를 싣지 않고 제한된 stdin/프레임으로 요청을 전달한다. 고정 클라이언트가 요청한 뒤에만 호스트가 고정 localhost Qwen transport를 호출하고, 클라이언트가 확인한 응답을 받아야 성공이다. native 접두사 위조·크기/ID/불완전 응답·취소·timeout과 실제 배포 자산 경로를 검사했다. 독립 broker/native7 PASS 및 기존 transport/executor/runtime39 PASS/build0: `S1/20260911-model-broker/review.md`.
- 실제 compiled adapter/default transport로 Qwen을 한 번 호출해 OK, input22/output37/total59, stop terminal, 4.281초를 관측했다. 전용 child/guardian/PID/경로 부재도 감사했다. 최초 canary 설정은 경로 끝 slash 불일치로 공급자 호출 전에 거부됐고, runner 경로만 정규화해 실제 호출했다. 두 기록을 보존한다. `real-qwen-canary-normalized-root.json`과 독립 증거 감사는 같은 broker 폴더에 있다. 전체 모델 자격·공급자 과금 종료·기본 앱 dispatch 완료는 아니다.
- 자동016 적용 후 넓은 회귀는 `20260911-retry-regression/`에 보존했다: 81 files 중77 pass/4 fail, 593 tests pass/5 fail/5 skip, exit1, 596.51초. 실패는 기존 native 오류 코드 검사1건, 새 broker의 직접 child_process 사용에 대한 실행 경계 검사3건, 변경된 preload 공개 메서드 목록을 반영하지 않은 Electron proof1건이다. 실행 경계 우회를 수정하고 proof 계약을 대조하는 중이며 최초 실패 기록은 유지한다. 출처 불명 기존 manifest만 사용자 결정대로 제외했으며 통과로 처리하지 않는다. 전체 S0–S7 GOAL은 active이고 실제 checker·기본 호스트·재계획/복원·S5–S7 작업이 남아 있다.
- 독립 P13 감사에서 M3에 WFP drop 이벤트가 필수라는 해석은 확인되지 않았다. 실제 적용된 cap0/loopback 정책과 동일 목적지의 host 전후 접속 성공·confined 접속/수신 부재를 함께 측정하는 좁은 경로 검증을 준비한다. timeout 단독을 PASS로 바꾸거나 B3 및 모든 프로토콜 차단으로 확대하지 않는다. 최종 subjectDigest, 선언된 broker egress, 실제 attempt 정리 영수증이 연결되기 전 자격 발행과 기본 호스트 활성화는 미완료다.
- Electron proof의 정확한 API 목록에 이미 구현된 설정 메서드 두 개를 추가했다. 실제 Electron을 실행하는 정리 실패 회귀1 PASS, 독립 diff/해시 검토 PASS: `20260911-retry-regression/p12-proof-contract-review.md`. 정리 실패를 성공으로 표시하지 않는 기존 검사는 유지했으며 넓은 회귀 결과를 소급 변경하지 않는다.
- 기본 호스트 사전 감사에서 기존 계획이 제작 단계를 모두 쓰기 권한으로 매핑하는 공백을 확인했다. M 전용 `model-producer` 역할의 coverage·실행 권한·모든 제작자 독립 검증·화면 연결을 구현 중이다. 모델 출력 산출물 종류·실제 결정적 checker·실물 자격 및 기본 호스트는 별도 미완료 항목이다.
- 후속 역할 연결은 독립8파일86 PASS/build0로 완료했다: `S4/20260911-model-producer-role/review.md`. 새 역할도 요구 coverage와 모든 과거 제작자 검증에 포함하지만 M 실행만 사용하며 쓰기 lease와 파일 변경 권한을 얻지 않는다. 기존 계획 지문을 유지했고 승인/관측 화면에 모델 출력 생성으로 표시한다. 생성 결과 저장·실제 checker·기본 host 완료로 확대하지 않는다.
- broker 실행 경계 회귀를 기존 `spawnOwned`와 원장 session을 사용하는 제한된 piped helper로 수정했다. 독립 검토에서 발견한 no-PID 시작 실패의 처리되지 않은 ENOENT도 보정했다. 독립 P4/P45/broker23 PASS/3 skip와 타입 검사0: `S1/20260911-model-broker/owned-launch-review.md`. 기존 scanner와 양성 대조를 완화하지 않았다. 과거 Qwen canary는 이전 API/소스 증거로 유지하고 새 revision의 live 증거로 재사용하지 않는다.
- 새 격리 qualification 검사는 두 실행 모두2 PASS/1 FAIL이다. 두 번째 실행에서 파일 거부 및 종료 후 파일 불변 검사는 통과했지만, ACL 계정 이름을 SID 문자열로 가정한 진단 도우미가 실패했다. 설정한 실행 한도에서 멈추고 독립 원인 검토로 전환했다. 전체 M 자격은 계속 미발행이며 최초 실패 로그를 보존한다.
- 독립 SID 표현 진단 후 원시 관측을 보존하고 해당 M2/M3 한 건만 실행했다. 결과1 FAIL/2 skip, exit1이다. 새 원시 기록에서 host PowerShell의 Get-Acl 모듈 자동 로드 실패가 확인됐고, 이 실행은 child 준비 신호를 전달하지 못해 유효한 격리 실험이 아니었다. 기존 실패를 SID 표현만의 문제로 확정하지 않는다. `S1/20260911-model-boundary/controlled-qualification-a31a075e-2659-4c6b-9dcb-aebe2014ea07.json` 및 `.jsonl`을 보존하고 추가 경계 실행 없이 host 도우미 원인 진단으로 전환했다.
- 별도 host-only .NET API 호환성 확인 후 도우미를 모듈 없이 읽도록 교체했다. 대상1 PASS/2 skip, exit0 및 독립 원시 증거 검토 PASS: `S1/20260911-model-boundary/review-controlled-qualification.md`. 파일16개 작업 거부·host 종료 후 원본/ACL 대조·같은 TCP listener의 host 전후 성공과 child 접속/수신 부재를 확인했다. 전체 프로토콜/B3/공급자 격리나 자격 발행은 아니다. 기존 errno-only assertion은 실제 원인/행동 관측 검사로 정리하는 중이다.
- native 검사 정리는 build0/4파일9 PASS와 독립 검토로 완료했다: `S1/20260911-model-boundary/review-consolidated-gate.md`. 기존 파일 errno 검사와 raw 진단은 유지하고 자식/네트워크 판정은 전용 원인·통제 관측 검사로 검증한다. 과거 실패를 지우거나 UNKNOWN/ETIMEDOUT 허용 목록을 추가하지 않았다.
- 생성 결과 계약 migration017을 openLedger와 배포 복사에 연결하고, 승인된 입력/검사기 설정/제작 단계/대상을 실제 시도별 원본에 결합했다. 인수와 이력은 해당 계약의 generated-output 종류·현재 성공 시도·원본 hash/size/ref를 확인한다. 독립 검토에서 종류를 filesystem으로 바꾸는 우회를 찾아 보정한 후 집중38 PASS. 아직 최종 독립 연결 검토 중이며 체크하지 않는다.
- 고정 JSON 포맷 검사기 코어는 기본7개와 독립 추가1009개 구조/경계·1000개 변조 검사, 타입 검사를 통과했다: `S4/20260911-json-format-checker/review.md`. 정규 JSON을 정확히2칸 들여쓰기로 변환하는 한정 계약이다. 배포 자산 복사를 추가했으며 실제 격리 checker 실행·인수 collector·기본 앱 연결은 별도다.
- 생성 원본 저장/인수 최종 독립 검토는 build0/6파일65 PASS다: `S4/20260911-generated-output/review.md`. 승인된 generated target을 filesystem으로 바꾸는 우회도 거부한다. 기본 준비 단계와 실제 응답 저장 호출·checker 실행·기본 host는 아직 별도다.
- 실제 broker 정상/취소 후 원장 session·native identity·PID와 private 경로 부재를 독립 관측하는 wrapper를 구현했다. 증거 저장 실패는 미확인으로 유지하고 provider 정지/과금 종료를 주장하지 않는다. 비동기 대기 중 context가 바뀌어 observation과 receipt 지문이 달라지는 결함을 보정한 뒤 독립 cleanup/runtime20 PASS: `S1/20260911-isolated-model-cleanup/review.md`. 실제 native와 고정 transport를 사용했으며 Qwen은 추가 호출하지 않았다.
- 위 소스가 안정된 뒤 넓은 회귀를 `20260911-generated-output-regression/`에 시작했다. 현재 실행 중이며 명시 제외는 출처 불명 기존 manifest뿐이다. 이전 회귀5실패를 소급 통과로 바꾸지 않는다. 전체 GOAL은 active다.
- 회귀 실행 중 소스는 고정하고 S0 설치 후보를 읽기 조사했다.11개 명령 중17개 PATH 경로를 발견했고 paseo/herdr/pi는 해당 PATH에서 발견되지 않았다. Codex/Agy/Grok/OpenClaw/Orca의 중복 경로, wrapper와 실제 실행 파일을 구분할 필요가 있다. 파일 해시·PE 메타데이터 대조는 독립 검토했으며 도구 실행/인증 접근/자격 발행은 하지 않았다: `S0/20260911-command-discovery/review.md`.
- 넓은 회귀는85파일633 PASS/5 skip, exit0,601.46초로 완료됐다: `20260911-generated-output-regression/result.json` 및 `vitest.log`. 제외된 기존 manifest는 통과가 아니다. 이 결과는 앱 생성 계약 준비·고정 checker 실행의 다음 변경 전 소스에 해당한다.
- 설치된 Claude의 정확한 실행 경로에서 --version/--help만10초 제한으로 관측했다. 둘 다exit0,54/178ms, 실행 전후 해시 동일이며 stdout/stderr 해시를 독립 대조했다. 보고 버전2.1.267과 출력/도구/설정 제어 플래그 선언을 확보했다: `S0/20260911-claude-introspection/review.md`. 인증·모델 호출·과금·실제 격리 보증은 확인하지 않았다.
- 생성 계약 앱 준비/승인은 독립49개와 모드3개 검사/build0로 완료했다. 실제 Electron fixture에서도 긴 ID/해시의 가로 넘침 없음, 원문 비노출, 이전 승인 제거, 모드 유지를 확인했다. 증거는 S4/20260911-generated-output-preparation/review.md 및 S4/20260911-generated-output-approval-ui/electron-review.md. 실제 응답 수집·기본 호스트는 별도다.
- 복수 자산 지문 helper는 독립 검토의 무한 파일 증가 지적을 최초 크기+1바이트 상한으로 보정했다. 독립11 PASS/타입 검사0, 실제 파일 증가 probe는2회 읽기 후 artifact_set_changed로 거부했다: S1/20260911-measurement-artifacts/review.md. 의존성 발견이나 측정-실행 사이 교체 방지·자격 발행으로 확대하지 않는다.
- 실제 격리 JSON checker 독립 검토는 입력 valueOf snapshot 결함 보정 후 PASS다. compiled4 PASS, P4/P45/native21 PASS/3 skip, 타입 검사0: S4/20260911-isolated-json-checker/review.md. Qwen 추가 호출은 없으며 checker 자격 발행·실제 인수 수집 연결은 아직 미완료다.
- 다음 연결 작업은 실제 생성 응답 capture bridge와 migration018 정리 관측 저장이다. 두 maker 집중 검사는 각각14 PASS/build0,5 PASS/build0이며 독립 검토 중이라 체크하지 않는다. 원장 초기화/배포에018을 등록했다. 실행 파일 묶음의 승인 지문과 실제 staged bytes 결합은 별도 구현 중이다(S1/20260911-model-subject-design/review.md). S5 동결 평가군/holdout 및 기술 통계 비교 기반도 구현 중이며 실제 개선·정책 승격 증거로 간주하지 않는다.
- Capture bridge 독립17 PASS/build0 및 정리 관측 저장 독립22 PASS/타입 검사0를 확인해 각각의 좁은 항목을 체크했다. 전체 모델 실행 연결은 아직 미완료다. 하위 작업 사용량 제한으로 중단된 소스를 재확인했으며 control bundle/checker 실제9 PASS/build0를 얻었다. checker 고유 종류는 root 집중35 PASS/타입 검사0, 독립 검토 중이다.
- 사용자가 이어서 진행을 요청한 뒤 하위 작업을 같은 모델 설정으로 재개했다. checker 종류는 독립27+8 PASS/타입 검사0로 완료했고 spec과 checklist에 반영했다. 제어 bundle은 maker28 PASS/1 skip/build0이며 독립 검토 중이다. S5 비교의 혼합 통화 합산 문제를 독립 검토에서 발견해 보정 중이고, 실제 생성 결과 인수 collector와 S6 읽기 전용 리소스 snapshot은 구현 중이다.
- 최신 독립 증거를 확인해 제어 bundle, 생성 인수 collector, S5 기술 통계 기반, S6 읽기 전용 패키지 기반을 좁은 완료 항목으로 반영했다. Core 동일 DB 호스트 factory와 JSON 부모 승인 봉투도 독립29 PASS/build0다(S4/20260911-core-host-composition/review.md). 기본 main 실행은 아직 활성화하지 않았고 새 전체 subject·현재 자격 발행·실제 Qwen 인수 연결이 남아 있다.
- 남은 작업 truth audit의 A 표와 각 source-bound 독립 검토를 대조해 기존 미체크 14문장만 문서상 완료로 reconciliation했다. 각 문장에 직접 증거 링크와 잔여 제한을 유지했으며 제품·테스트·evidence source 변경은 0이다. 실제 connector/native/live/Electron/restart/full stage 완료로 확대하지 않았다.
- S6 검색 품질은 [fixed authored v2 구현 기록](../evidence/integrations/S6/20260912-knowledge-quality/implementation.md)과 [독립 검토](../evidence/integrations/S6/20260912-knowledge-quality/review.md)를 대조해 좁게 완료 처리했다. 독립 baseline/final TP/FP/FN은 `11/15/4`→`15/13/0`, macro/EN/KO recall@3는 `0.8182/0.8/0.8333`→`1/1/1`, FP-query 전체/negative는 `9/2`→`9/2`로 비증가했고 provenance/hash/원본 UTF-8 byte 검사가 통과했다. 기존 [v1 검토](../evidence/integrations/S6/20260911-knowledge-holdout/review.md)의 `qualityGate=false`는 변경하지 않으며, 실제 사용자 검색·remote source 진위·semantic secret 탐지는 입증하지 않는다.
- 당시 LOOP에서 다음 S6 단위로 적은 resource safety/quarantine 검증은 현재 좁은 범위에서 완료됐다. 이 완료는 authored 검색 품질 판정을 넓히지 않는다. 진행 중인 S5 baseline은 독립 작업 흐름으로 계속 유지하며 S6 결과로 완료·대체·정책 승격하지 않는다.
- S6 resource safety/quarantine은 [구현 기록](../evidence/integrations/S6/20260912-resource-safety/implementation.md)과 [최종 독립 검토](../evidence/integrations/S6/20260912-resource-safety/review.md)를 대조해 좁게 완료 처리했다. 최초 검토의 fake-home·verification/permission·실제 registration counter 누락 BLOCKED는 기록에 보존되고 correction 뒤 독립 7 PASS, 관련 회귀 18 PASS, `tsc`/build exit 0 및 scoped whitespace 검사가 통과했다. filename/category 기반 auth/environment/raw-conversation 제외와 권한 비확대, 테스트가 소유한 임시 SQLite 원장을 두 번 재열어 확인한 version/run pin, 실제 사용자 홈 대신 치환한 가짜 home과 사용자 파일 보존, hook/MCP 주입 0, 선언형 read-only metadata 및 실행형 candidate quarantine, process-scoped policy/permission/network 0 범위다. 이는 production 앱 재시작이나 실제 사용자 홈 검증이 아니다. 이 범위의 S6 내부 체크리스트는 완료됐지만 실제 remote provenance, semantic secret 탐지, OS 전체 egress 차단, 실행형 plugin 지원은 여전히 미증명이다.
