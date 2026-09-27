# Cue 자동 오케스트레이터 통합 spec

**진행 중인 batch65 (2026-09-15):** [계정 참조 실행 연결 독립 검토](../evidence/integrations/S2/20260915-account-binding-correction/review.md)는 build0·10파일155/155·컴파일된 migration043 새 DB/재시작/부분 스키마 거부를 확인했다. 승인 당시 계정 참조·모델·엔드포인트·계획을 실행 직전까지 대조하며 시작 실패 뒤 정리에도 동일한 컨텍스트를 전달한다. 같은 결합 검증은 [인계 비용 누락 표시](../evidence/integrations/S5/20260915-authoritative-handoff-cost/review.md)도 재현했다. 기존 비용 총계·역사 기록은 유지하고 새 측정 기록에는 인계 비용 미확인 사유를 필수로 남긴다. 실제 계정 주체/권한과 어댑터의 자격 증명 사용(A06), 권위 있는 인계 비용 배분(S2-03/S5-03)은 남아 있다. 상위 미완료는 현재33개이며 정책 배포/복원과 파일 변경 경계 검증은 진행 중이다.

개정일: 2026-09-11 (r3, 재사용 우선·Cue 계약 소유 방식 반영)

상태: **구현 진행 중 — S0 조사·S1/S2 기반부터 검증하며 편입**. 실제 완료 범위는 체크리스트와 진행 기록을 따른다.

연결: [도입 목록](INTEGRATION_BACKLOG.md) · [체크리스트](INTEGRATION_CHECKLIST.md) · [기존 v0.2 설계](CUE_V02_ORCHESTRATOR_DESIGN.md) · [P13](P13_SPEC.md)

2026-09-12 구현 세부 계약: [읽기 전용 실행 복구](integration/NATIVE_RECOVERY_OBSERVER.md), [보호된 host/Core 연결](../evidence/integrations/S4/20260912-native-recovery-observer/host-integration-discovery.md), [선택 판단 영속화](../evidence/integrations/20260912-selection-persistence-plan.md). 관측은 실행 재개·정리·인수 권한이 아니며, 저장된 선택 이유는 당시 판단의 설명이다. 과거 기록에 없는 이유를 새로 만들어 넣거나 현재 후보 자격으로 재사용하지 않는다. 완료 여부는 각 독립 검증 후 체크리스트에 반영한다.

2026-09-15 완료 조건 재대조: [도구 등록 감사](../evidence/integrations/planning/20260915-reuse-original-contract-audit/review.md)는 요청 9종을 비활성으로 식별한 S0-02를 완료로 인정하며 실행 자격과 구분한다. [원래 조건 감사](../evidence/integrations/planning/20260915-original-contract-audit/review.md)는 구현·기록 계약과 실제 성능/도구 자격을 분리한다. [실패 복구·증거 계약](../evidence/integrations/S4/20260915-recovery-branch-completeness/review.md) 및 [출시 단계 표시](../evidence/integrations/release/20260915-readiness-truth-correction/review.md)를 검증했다. `scripts/reuse/cue-release-readiness.mjs`는 체크리스트·spec·실행 지도의 고정 해시와 증거 파일 해시를 포함한 독립 HTML/JSON을 생성한다. `documented`는 체크 및 파일 존재의 기록일 뿐이며, 이 산출물만으로 runtime 자격·S5 개선·전체 출시를 승인하지 않는다. 인계 비용 수집과 계정 identity 승인 연결은 아직 부족하며 기존 fixture 통과로 대체하지 않는다.

## 1. 제품 목표와 정책 우선순위

2026-09-12 후속 구현 계약: [실행 결과 수집](../evidence/integrations/S5/20260912-outcome-collection-plan.md)은 원장의 인수 결과·실패·취소 요청·비용 불확실성을 먼저 수집한다. 도구/모델 revision·환경·비용 근거가 부족한 실행은 평가 trial로 자동 변환하지 않으며, 이 수집만으로 품질·효율 개선이나 정책 승격을 주장하지 않는다. [후보 등록 공백 조사](../evidence/integrations/S0/20260912-capability-gaps/report.md)의 문서상 식별과 실제 실행 지원도 구분한다.

**Cue는 사용자의 목표를 이해하고, 사용 가능한 에이전트 도구와 LLM 중 적합한 조합을 선택해 작업을 배분하며, 진행·비용·품질을 지속적으로 확인하고, 검증된 결과를 전달할 때까지 지휘하는 개인 AI 오케스트레이터다.**

사용자는 목표와 모드를 고른다. 예산·기한·허용 계정/도구·데이터 범위는 저장된 기본값을 사용할 수 있다. Cue는 그 정책 안에서 모델 선택, 순차/병렬 배치, 실패 복구와 재계획을 자율 수행한다. 개별 도구/모델 수동 고정은 고급 옵션이다.

“완벽한 수행”의 운영 정의는 요구사항 누락 0, 증거 없는 완료 선언 0, 미해결 항목 은폐 0이다. 모든 작업의 성공이나 전역 최적 조합을 보장한다고 표현하지 않는다.

2026-09-11 사용자 결정으로 아래 제품 정책을 대체한다. P13 실측 기준과 OS 격리·정지·권한 보증은 완화하지 않는다.

| 이전 정책 | 이 spec의 유효 정책 |
|---|---|
| 프리셋 추천만 하고 자동 적용 금지 | 선택한 모드·승인 정책 안에서 Cue가 자동 선택·변경 |
| 통화 비용 환산 금지, 토큰만 사용 | 출처·시각·통화·추정 여부가 있는 비용 모델과 토큰/쿼터 함께 사용 |
| 같은 모델만 재시도 | 원인별 재시도·모델/도구 전환·재계획, 총예산/시도 한도 유지 |
| 고정 기획→구현→검증 | 동적 작업 그래프, 필수 요구사항 검증은 생략 불가 |
| Orca는 준비 편의 기능만 | 하위 오케스트레이터 후보 평가 가능. 자격·소유권·정지 검증 전 위임 금지 |

기존 v0.2 §2~§6의 충돌하는 제품 정책은 이 spec이 우선한다. 실행 중인 봉투 자체는 수정하지 않는다. 재배치 시 현재 시도를 정리하고 승인된 상위 정책의 부분집합인 새 봉투를 발급한다.

## 2. 모드와 자동 선택

모드는 특정 모델명에 고정하지 않는다. 아래는 제품 정책이며 현재 모델별 성능 순위를 주장하지 않는다.

| 모드 | 목적 | 판단 기준 |
|---|---|---|
| 효율 | 요구 품질을 충족하는 시간·비용 균형 | 품질 하한 통과 후보의 예상 총시간/총비용을 정규화해 비교 |
| 고성능 | 결과 품질·정확도 우선 | 예산·기한 안에서 성공 가능성과 독립 검증 품질 우선 |
| 가성비 | 검증된 완료까지의 총비용 최소화 | 재시도·검증·인계 비용까지 포함 |
| 속도 | 검증된 완료 시간 최소화 | 지연·대기열·병렬화·검증 시간까지 포함 |

모든 모드에 필수 품질·권한·예산 조건을 동일하게 적용한다. 속도/가성비 모드는 검증을 생략하지 않는다. 고성능 모드도 단순 작업에는 가벼운 후보를 배치할 수 있다.

선택 순서:

1. 설치/연결, 인증 참조, identity, 모델 호환성, 데이터 범위/로컬 전용, 필수 기능, 실행 자격으로 필터링한다.
2. 남은 예산·기한·계정별 동시성/쿼터·GPU 메모리/부하 조건을 확인한다.
3. 작업 유형별 관측 성과와 불확실성으로 목적 함수를 계산한다. 같은 입력/정책에는 결정적인 tie-break를 적용한다.
4. 선택 이유, 제외 이유, 예상 비용/시간 범위, 근거의 신뢰도를 기록한다.
5. 통계가 없으면 검증된 보수적 기본 후보로 시작한다. 유료 탐색은 별도로 허용된 탐색 예산에서만 한다.

초기 기본 후보는 정책 형식을 바꾸지 않는 실행별 불변 설정으로 연결한다. 승인/첫 시도 전에 정확한 정책·후보·통화·품질과 비용/시간 상한이 알려진 추정치를 결합한다. 명시적인 통계 없음 관측과 null 추정치가 함께 있을 때만 이를 사용하며, 추정치가 이미 있는 경우의 같은 관측은 모순으로 거부한다. 관측이 없으면 기존 선택을 유지하고 설정된 실행에는 그 사실을 기록한다. 후보는 관측 콜백 전에 고정하고 모든 기존 필터·수동 고정·예산 검사를 유지한다. 요청 재생은 저장된 근거와 기존 예약을 검증하며 재호출하지 않는다. [초기 선택 엔진 검토](../evidence/integrations/S2/20260914-initial-selection-staged/engine/review.md) 39/39·build0·컴파일된 migration040 시작 검증.

금전 예산을 사용하는 호스트는 초기 기본 후보·보수적 추정값·출처·시각을 준비 설정으로 제공할 수 있다. Cue가 실행/정책 식별자를 내부에서 붙이고 기존 정책·예산 준비와 같은 트랜잭션에 저장한다. 저장 설정이 누락·변경·변조되면 재준비나 실행을 거부하며, 로컬 실행 경로는 이 설정을 저장 전에 거부한다. 승인 문구에는 기본 후보와 보수적 비용/시간 상한을 표시하고 무결성 해시는 내부 요약·원장에 유지한다. [호스트 연결 독립 검토](../evidence/integrations/S2/20260915-initial-default-host/review.md) 독립 결합6파일94/94·build0, 최종 문구 수정 후 Core5/5 재검증(중복 집계하지 않음). 주입된 호스트를 사용한 드라이버/Core 검증이다. 실제 공급자 통계·가격 수집, 배포 호스트의 설정 공급, 사용자가 설정을 편집하는 UI/IPC와 실물 자격은 남아 있다. 탐색 승인·실행 요청 연결은 아래 최신 검증을 따른다. 로컬 모델은 계속 보류한다.

별도 탐색 예산 저장소는 한 실행/후보와 정확한 정책 버전에 대한 사전 승인, 전체 예산 안의 하위 한도, 기존 청구 기록으로 산출한 초과 지출과 중복 없는 예약을 제공한다. [독립 검토](../evidence/integrations/S2/20260914-exploration-budget-store/review.md) 29/29·build0. 명시적인 탐색 요청은 사전 승인 해시·실행·정책·후보를 결합하고, 전체 예산과 탐색 하위 한도를 같은 트랜잭션에서 예약한다. 재생은 기존 예약과 저장 근거를 재검증하며 재실행하지 않는다. 과금 초과 지출, 불완전한 DB 테이블/보호 장치, 초기 기본값과의 충돌은 실행을 차단한다. 로컬 실행 경로는 탐색 요청을 부작용 전에 거부한다. [엔진 독립 검토](../evidence/integrations/S2/20260914-exploration-engine/review.md) 최종14파일169/169·build0·컴파일 migration041 새 DB/재시작 검증. 실제 호스트 설정·관측 수집·UI/IPC 연결은 남아 있다.

유료 탐색은 별도의 기본 미선택 체크박스로 동의해야 승인된다. Core는 엄격히 검증한 동의와 일반 승인을 같은 트랜잭션에 저장하고, 드라이버는 실행·정책·계획·후보·허용 작업 목록에 결합된 동의만 사용한다. 병렬 작업과 같은 후보의 재시도에서도 허용 작업에만 탐색 예산을 적용하며, 전체 예산에 포함해 중복 예약하지 않는다. 활성화 뒤 동의 기록이 사라지면 시작과 후속 실행 검증에서 차단한다. [탐색 승인 연결 독립 검토](../evidence/integrations/S2/20260915-exploration-consent-review/review.md) 최종 독립10파일151/151·build0·migration042 새 DB/재시작 및 보호 장치 손실 거부 검증. 실제 가격·통계·쿼터/과금 출처, 공급자 자격, 배포 설정 편집 화면과 전체 출시 검증은 별도 미완료 항목이다. 로컬 모델은 보류한다.

효율 모드의 초기 가중치 제안은 시간/비용 0.5/0.5이며, 고정 기준 작업군으로 정규화한다. 후보 집합 변경이 정규화 척도를 조용히 바꾸지 않게 한다. 가중치·추정기·tie-break·품질 하한은 버전형 정책으로 보관하고 S2에서 검증한다.

## 3. 자율성·비용·실행 경계

- 승인 객체: 목표·필수 요구사항·모드·허용 후보 집합·비용/시간/시도/동시성 한도·데이터/파일/네트워크 범위·외부 부작용 권한.
- 정책 안의 재배치는 재질문 없이 수행하고 UI/원장에 남긴다. 새 계정, 범위 확대, 한도 증액, 미승인 게시 등은 별도 결정 대상이다.
- 정책/리소스는 run에서 고정한다. 재계획은 고정 정책을 따르는 새 plan revision이다. 사용자 모드 변경은 안전한 인계 시점에 새 정책 revision으로 적용한다.
- 병렬 호출 전 예산을 원자적으로 예약한다. 완료 시 actual/estimated로 정산하며 지연 청구·진행 중 비용을 중복 또는 누락 계산하지 않는다.
- API 단가, 구독 포함 사용량/제한, 로컬 자원비용을 구분한다. 구독 잔량 미확인을 무제한으로, 로컬 모델을 무조건 무료로 표시하지 않는다.
- 가격/쿼터는 출처·조회 시각·통화·신뢰도를 기록한다. unknown/stale 가격의 보수적 상한을 확보하지 못하면 엄격한 비용 한도의 유료 후보에서 제외한다. 다른 통화는 시각이 있는 환율 또는 사용자 설정으로 정규화한다.
- 원격 제공자의 취소 요청과 실제 실행/과금 종료를 구분한다. 불명확한 예약 비용을 임의 해제하지 않는다. 엄격한 보증이 불가능한 후보는 해당 정책에서 제외한다.
- 실패/타임아웃/검증 실패를 기록한다. 재시도는 실패를 지우지 않으며 한도 소진 시 blocked로 끝낸다.
- 크래시 뒤 상태/대기열은 복원하되 쓰기는 자동 재개하지 않는다. 외부 부작용 완료 여부가 불명확하면 조회/대조 전 재실행하지 않는다.
- 모든 쓰기/복원은 Cue의 범위 검사·writer lease·격리를 거친다. 정지는 identity·실제 사망·잔여물로 판정하며 위반 후 실행 봉인과 자격증명/Electron 격리를 유지한다.

## 4. 연결 후보와 지원 판정

모델, 코딩 에이전트, MCP 도구, 하위 오케스트레이터를 별도 capability로 관리한다. 여러 역할을 가진 도구도 조합별 호환성과 권한을 측정한다.

| 후보 | 연결 계획 |
|---|---|
| Codex CLI | 기존 경로를 공통 어댑터로 감싸 기준선 확보 |
| Claude Code CLI | 정확한 실행파일/프로토콜 확인 후 두 번째 에이전트 후보 |
| 로컬 LLM endpoint | 실제 모델·메모리·기능 확인 후 모델 전용 경로 우선 |
| pi | PI-Desktop의 경계 설계를 참고한 추가 런타임 후보 |
| agy, grok build, nlm mcp cli, hermesagent, openclaw, paseo, orca, herdr | 전부 사용자 요청 후보로 등록. 사용자 선택 NLM은 `jacob-bd/notebooklm-mcp-cli`(canonical redirect `jacob-bd/gemini-notebook-mcp-cli`), Hermes는 `NousResearch/hermes-agent`다. 선택 확인은 설치·인증·실행 자격이 아니며 역할·제어 API 확인 후 순차 연결 |

사용자 제시 모델 후보: `gpt 5.6 sol`, `terra`, `luna`, `6 astra`, `claude opus 5.0`, `sonnet 5`, `haiku`, `fable 5.1`, `gemini flash 3.8`, `qwen 3.8 27b (로컬)`, `grok 4.6`, `muse 1.3`.

이는 사용자 표현 그대로의 후보 목록이며 존재·가용성·벤더·가격·지원 도구가 검증됐다는 뜻이 아니다. 별칭과 canonical ID를 분리하고 공식 정보/목록 조회/실제 연결로 확인한다. 모호한 identity는 추정 연결하지 않는다. 모델명/등급은 선택 코드에 하드코딩하지 않는다.

하위 오케스트레이터는 숨은 자식 실행·계정 사용·작업 변경을 확인해야 한다. Cue run/step과 하위 작업 ID를 매핑하고 상태/취소/소유권/산출물/비용 관측이 확인된 범위만 위임한다. 다른 오케스트레이터의 자기신고를 Cue의 종료/권한 보증으로 상속하지 않는다.

## 5. 실행 흐름과 데이터 계약

`목표·모드 → 요구사항/완료 기준 → 후보 선택 → 작업 DAG → 실행/감시 → 검증 → 필요 시 재계획 → 인수 보고`

| 계약 | 필수 내용 |
|---|---|
| ToolCapability / ModelBinding | canonical ID·별칭·버전/지문·호환성·역할·auth 참조·자격/측정 시각 |
| SelectionPolicy | mode/version·quality floor·허용 집합·비용/시간/시도/동시성/탐색 한도·privacy·수동 고정 |
| CostObservation | provider/account/model·단가 출처/시각/통화·actual/estimated/unknown·tokens/cache·예약/정산 |
| Requirement / AcceptanceEvidence | 원문 요구 ID·검사 종류·판정 기준·증거 hash·pass/fail/unknown·검토자 |
| TaskGraph / Attempt | plan revision·step/dependencies·역할/owner·requirement IDs·idempotency key·timeout·retry history |
| RunContext / Handoff | run/step/attempt·envelope hash·subject digest·정책/자료 hash·산출물 hash·도구/모델 출처 |
| RuntimeEvent | 순번/시각·run/step·상태/heartbeat/tool/usage/cancel/terminal·중복 제거 키 |
| ChangeRecord / ReportReceipt | 전후 파일 hash·복원 한계·보고서 입력/출력 hash·원장 기준점·생성기 revision |

기존 `ledger.ts`와 소유권/lease를 재사용한다. 버전형·트랜잭션 기반 마이그레이션을 검증하고 별도 실행 진실 저장소를 만들지 않는다. 이벤트 순서 역전·중복·재접속 대조 규칙을 둔다.

## 6. 구현 단계와 완료 게이트

신규 경로/테스트는 제안이다. S0~S7은 체크리스트·backlog 공통 번호다.

### S0 — 기준선·P13·후보 대조

기존 접점: `daemon/src/measurement-subject.ts`, `probes/`, `adapters/registry.ts`, `tool-home.ts`, `worker-enforcement.ts`.

현재 코드와 P13 증거/실패를 대조한다. 오래된 체크박스만으로 미구현/통과를 판정하지 않는다. 후보 identity·프로토콜·라이선스·OS·네트워크/프로세스 요구를 기록한다.

완료: 현재 revision의 `npm test` 결과, P13 PASS/FAIL/미측정 표, 도입 지문과 미확인 항목을 확보한다. 기존 사용자 변경을 보존하고 기준선 실패의 차단 범위를 명시한다.

### S1 — 공통 레지스트리·런타임 (PI-02)

기존 접점: `daemon/src/adapters/`, `dispatch.ts`, `host-codex-runtime.ts`, `host-codex-controller.ts`.
신규 제안: `daemon/src/adapters/runtime-contract.ts`, `daemon/src/catalog/`. 테스트: `integration-runtime-contract.test.ts`.

Codex를 먼저 감싸고 identity가 확인된 두 번째 에이전트와 로컬 모델 전용 경로를 연결한다. 시작/관측/취소/정리/출력/비용·지원 불가 기능을 표준화한다. 모델 전용은 M 계약, 쓰기는 해당 조합의 P13 자격을 요구한다. MCP와 하위 오케스트레이터는 별도 어댑터 종류로 확장한다.

설치 CLI의 version/help와 생성 JSON schema bundle은 protocol 선언 관측으로만 사용한다. Stable/experimental schema를 분리하고 전체 membership/hash/parse를 고정하되 wrapper fingerprint를 native executable provenance로, 선언 존재를 auth/runtime/model access·실행 qualification으로 승격하지 않는다.

고정 결정적 검사기는 카탈로그와 런타임에서 `checker` 종류로 식별하며 LLM endpoint/model binding을 갖지 않는다. 현재 제한된 실행은 기존 `model` 런타임 역할의 M1–M3 검증을 동일하게 요구한다. 종류 등록만으로 검사 자격·쓰기 권한·검증 결과를 얻지 않는다.

완료: Codex 회귀 없음. 미설치/미인증/미호환/미측정/지문 변경 후보 거부. 새 후보는 실제 역할별 실측 통과 후 활성화한다. mock 성공만으로 지원 완료 처리하지 않는다.

### S2 — 네 모드·선택기·예산·모드 UI (TA-02)

기존 접점: `daemon/src/routing.ts`, `execution-accounting.ts`, `app/core.mjs`, `app/renderer/renderer.js`.
신규 제안: `daemon/src/selection/`, `daemon/src/budget.ts`. 테스트: `integration-selection.test.ts`.

후보 필터, 정책 버전, 비용 예약/정산, 선택 이유를 구현한다. TeamAI 역할 변환을 참고하되 권한은 Cue가 부여한다. 저장 시 정책/고정 후보 유효성, 매 실행 시 자격/가용성을 재검증한다. 후보 변화는 허용 집합 안에서 처리한다.

선택 설명 UI의 후보 제한은 전체 DOM projection과 현재 viewport 가시성을 구분한다. Stop 버튼 표시만으로 종료 요청·실제 사망·정리 동작을 검증했다고 간주하지 않는다.

완료: 같은 fixture의 선택 일치. 모드별 대표 작업, 재시도 비용 역전, unknown 가격, 쿼터 소진, 로컬 메모리 부족 검사. 동시 예약 초과 0, 권한 필터 우회 0, 수동 고정 위반 0. 실제 성능/가격을 모델명으로 추정하지 않는다.

### S3 — 작업 분해·배분·인계·감시·세션 (PI-03, PI-04)

기존 접점: `daemon/src/dispatch.ts`, `ledger.ts`, `watcher.ts`, `heartbeat.ts`, `recovery.ts`, `daemon-ownership.ts`, `workspace-lease.ts`, `app/ipc.mjs`.
신규 제안: `daemon/src/orchestration/`, `daemon/src/request-queue.ts`. 테스트: `integration-orchestration.test.ts`.

요구사항을 DAG에 연결한다. 독립 읽기는 병렬화하고 쓰기는 폴더 단위 lease로 직렬화하거나 별도 worktree에서 수행 후 검증된 통합 단계를 둔다. 단계별 새 봉투·산출물 hash를 인계한다. heartbeat와 실제 출력/도구 활동/산출물을 함께 감시한다. 이벤트, 대기 요청, 스트리밍 체크포인트를 영속화한다.

일반 실행 드라이버는 호스트가 준비한 `limits.maxParallelReadTasks`로 제한적 읽기 묶음 병렬 실행을 지원한다. 기본1·정수1..8이며 불변 승인 요약에 유효 한도를 포함한다. 1보다 큰 설정은 로컬 호출수 경로·재시도 계약·자동 복구와 함께 사용할 수 없고 plan 저장 전에 거부한다. 현재 준비된 비implementation 단계만 정해진 순서로 한도만큼 선택하며 각 단계의 기존 claim·예산 예약·stage binder·런타임 admission 검사를 유지한다. 비쓰기 권한은 역할 이름만으로 부여하지 않으며 기존 봉투/범위 검사가 read/list/search를 제한한다. 작업별 핸들로 시작 중 취소·실패 시 다른 작업 취소·정리 불명 상태 보존·대기 응답 연결을 수행하고, 묶음이 끝나기 전에 후속 검증이나 쓰기 작업을 시작하지 않는다. [독립 검토](../evidence/integrations/S3/20260914-parallel-read-wave/review.md) 4파일68/68, 최종 fixture 검증 build0. 실제 SQLite·주입 런타임에서2개 동시 실행·예약 합산·쓰기 배제·후속 단계·실패/중지를 확인했다. 실제 공급자 성능·OS 격리·활성 묶음 재시작·별도 병렬 deadline 만료 실험은 검증하지 않았으며 기본 순차/로컬/복구 동작을 유지한다.

후속으로 병렬 묶음의 `taskTimeoutMs` 만료를 일반 증거 실패와 구분해 `orchestration_timeout`으로 기록한다. 두 읽기 작업을 취소하고 후속 검증을 막으며, 정리 미확인이면 정확한 미해결 작업과 예약 20단위를 유지하고 종료를 거부한다. 정리 확인 시 종료는 가능해도 전체 명령은 시간 초과·인수 미검증 상태다. [시간 초과 독립 검토](../evidence/integrations/S3/20260914-parallel-wave-timeout/review.md) 4파일 70/70 및 빌드 통과. 이는 실행 핸들이 반환된 뒤 시작되는 묶음 제한 시간의 SQLite/주입 런타임 검증이며, 재시도 절대 기한·실제 공급자·재시작 검증을 포함하지 않는다.

대기 응답은 SQLite 전달 claim을 먼저 확정한 뒤, 호스트 호출 직전에 해당 실행의 준비 상태·중지·종료·병렬 취소 제어를 다시 검사한다. 취소가 시작된 실행 핸들이 남아 있어도 새 전달을 허용하지 않는다. 차단된 claim은 미해결로 유지하고 재요청에서 재전송하지 않는다. 이미 호출한 전달의 유효한 수신 확인은 중지 뒤에도 사실대로 기록한다. [병렬 응답 전달 독립 검토](../evidence/integrations/S3/20260914-parallel-wait-delivery/review.md) 4파일 73/73 및 빌드 통과: 두 실행의 identity/세션 참조/응답 내용 분리, 같은 원장의 드라이버 재생성 후 재전송 방지, 승인 검사 중 중지·병렬 시간 초과 후 전달 차단을 검증했다. 실제 공급자 전달·프로세스 재시작 후 연결 복원과 순차 자동 실패의 미해결 소유권 경로는 별도다.

순차 실행에도 전달 claim 이후 정확한 실행의 루트 작업이 원장에서 `running`인지 확인한다. 시간 초과나 실행 영수증 처리 예외로 차단된 명령은 정리 미확인 핸들이 남아 있어도 새 호스트 전달을 시작하지 않는다. [순차 응답 전달 독립 검토](../evidence/integrations/S3/20260914-serial-wait-delivery/review.md) 4파일 75/75 및 빌드 통과: 두 경우 모두 정확한 미해결 작업·예약 10단위 유지, 새 전송/관측 기록 0, 재요청 시 재전송 방지와 종료 거부를 검증했다. 기존 전달·늦은 확인·복구 회귀는 통과했으며 복구 중 응답 전달의 별도 성공 시나리오와 실제 공급자 검증은 포함하지 않는다.

승인된 명시적 재시도 복구의 응답 전달은 [독립 검토](../evidence/integrations/S3/20260914-recovery-wait-delivery/review.md)로 확인했다. 실패한 이전 실행의 정리 확인 후 공개 recover 호출로 루트 작업을 blocked에서 running으로 복원하고, 새 실행의 identity·세션 참조·내용에 맞는 응답을 한 번 전달한다. 같은 원장에 대한 재요청/드라이버 재생성은 재전송하지 않으며 실패한 이전 identity의 새 대기 요청은 거부한다. 제품 코드 변경 없이 테스트를 추가해 4파일 76/76·빌드를 통과했다. 재시도 한 경로의 주입 런타임/SQLite 증거이며 전환·재계획·기존 대기 응답의 재지정·프로세스 재시작 연결 복원은 검증하지 않았다. 테스트 수정 횟수 한도 초과는 기능 통과와 별도로 검토 기록에 남겼다.

복구 후 응답 전달은 [재시도·전환·재계획 행렬](../evidence/integrations/S3/20260914-recovery-wait-matrix/review.md)로 확장했다. 전환의 agent-b 선택, 재계획 revision/계획 지문, 정확한 새 실행의 응답 내용·세션 참조와 재전송 방지를 확인한다. [프로세스 재시작 검토](../evidence/integrations/S3/20260914-wait-process-restart/review.md)는 주입 호스트가 1회 전달한 뒤 확인 전인 Node 프로세스를 종료하고, 다른 PID의 새 Node 프로세스가 같은 SQLite의 claim을 읽어 재전송하지 않음을 확인했다. 미해결 claim을 재연결이나 자동 재전송 권한으로 바꾸지 않는다. 독립 합동 검사 5파일 79/79, 빌드 통과. 제품 코드 변경 없이 테스트를 확장했으며 실제 공급자 세션 재접속·기존 대기 응답의 다른 실행 재지정·기기 전원 장애 내구성은 별도다.

산출물 제작 책임과 실행 권한을 구분한다. 기존 `implementation`은 쓰기 자격을 유지하고, `model-producer`는 M 자격의 모델 출력 제작만 담당한다. 두 역할 모두 요구사항 제작 계보와 독립 검증의 대상이며 planner로 제작 책임을 대체하지 않는다. 모델 출력은 파일이나 검색 출처로 위장하지 않고 별도 승인된 산출물 계약으로 연결해야 한다. 이 역할 추가만으로 파일 쓰기·최종 인수·기본 호스트 실행을 허용하지 않는다.

완료: 순환/누락 의존성 거부. 요청 중복/순서 역전/재시작에서 중복 실행 0. 늦은 체크포인트의 최종본 덮어쓰기 0. UI가 도구·모델·이유·단계·차단 사유·비용/불확실성을 표시하고 Stop의 실제 정리 결과를 반영한다.

### S4 — 복구·재계획·독립 완료 검증 (PI-01)

기존 접점: `daemon/src/host-codex-runtime.ts`, `process-termination.ts`, `reporting.ts`, `task-close.ts`, `state-machine.ts`.
신규 제안: `daemon/src/verification/`, `daemon/src/change-records.ts`. 테스트: `integration-verification.test.ts`.

일시 오류/인증/쿼터/기능 부적합/품질 실패/정책 위반별 대응을 분리한다. 교체 전 시도 종료·소유권을 정리한다. 변경 기록과 해시 기반 복원을 추가하되 범위/lease/격리를 적용한다. 나중에 수정된 파일은 덮어쓰지 않으며 검사-쓰기 경합, 삭제/이동/junction을 검사한다. 임의 셸 변경·큰 파일의 복원 한계를 표시한다.

코드 작업은 테스트/산출물, 조사/문서는 출처/주장/요구 대응, 외부 작업은 실제 원격 상태 등 유형별 증거를 검사한다. 모델의 성공 선언이나 프로세스 종료는 완료 근거가 아니다. 다른 모델이라는 사실만으로 독립 검증의 정확성을 보장하지 않는다.

생성 응답은 승인 전 입력·대상·검사기 revision/설정·크기 제한의 원래 승인 계약과 정확한 관측 실행 stage/plan revision을 함께 보존한다. 재계획은 원래 승인 대상을 바꾸지 않고 revision/recovery 계보로 exact observation을 연결하며, 인수는 선택된 관측 revision과 그 원래 승인 계약을 각각 대조한다. 재시도별 결과를 별도로 남기며 최신 응답을 자동으로 정답으로 선택하지 않는다. 문서 검사에 생성 응답을 사용하는 경우 해당 검사에 명시적으로 결합된 계약을 확인한다. Generated-JSON host는 run configuration마다 exact requirement·producer·input hash·target·parameters digest·고정 checker ID·pin-derived revision에서 만든 immutable checker descriptor 하나를 저장한다. Driver는 그 configuration의 bounded descriptor만 해석하고 duplicate/unreferenced descriptor를 거부하며, acceptance collection은 저장된 target과 pin에서 policy를 독립 재계산해 대조한다. 기존 파일/검색 출처/원격 상태 요구를 생성 문자열로 대체하지 않는다. 최초 결정적 검사기는 승인된 정규 JSON의 정확한 들여쓰기 변환과 값 보존을 다루며, 자유형 문서의 의미적 정확성이나 전체 코딩 작업 검증을 보장하지 않는다.

실제 fixed-JSON gate의 완료 주장은 frozen installation과 정확한 `DEFAULT_HOST_PLAN` producer/checker 쌍에만 결합한다. Qualification과 workflow의 native identity·cleanup, generated target/policy/pin, strict reopen acceptance를 같은 보존 원장에서 검증해야 한다. Runner의 local invocation/ledger 수는 provider HTTP cardinality 증거가 아니며, 이 성공은 다른 agent·mode·target의 자격이나 재시도 권한을 만들지 않는다.

완료: 거짓 성공 응답·빈 산출물·부분 구현·검증 실패는 completed가 되지 않는다. 모든 필수 요구 pass 후에만 완료. fail/unknown 누락 0, 무한 재시도 0, 위반 후 실행 0, 범위 밖/경합 복원 0, 크래시 후 쓰기 자동 재개 0.

Read-only verifier는 frozen launcher/source/offline 계약과 실제 AppContainer 권한 증거를 분리한다. Preflight가 launcher 전에 실패하면 source gate만 보존하고 RX/M ACL, sibling/loopback denial, restore/cleanup 또는 durable identity를 실제 성공으로 승격하지 않으며 production registration을 허용하지 않는다.
Host PowerShell 관측은 ambient 환경을 상속하지 않고 정확한 `SystemRoot`/`WINDIR`/`PATHEXT=.EXE`만 전달하며 raw status/signal/error/stdout/stderr를 guard 판정 전에 보존한다. AppContainer payload의 기존8-key 환경은 변경하지 않는다. ACL observation은 사전 abort를 검사하고, 생성 뒤 abort·5초 observation trigger·65,536 UTF-8 byte 초과·child error에서 verified tree termination으로 fail closed한다. Post-ACL launcher는 configured timeout+15초, abort, process/stdin error와 overflow를 하나의 guarded terminal path로 처리한다. cancellation·timeout·parent-death termination은 한 번만 요청하고 exact process handle이 `WAIT_OBJECT_0`일 때만 정상 terminal status를 반환하며, refusal·timeout·failure·unexpected wait는 실패한다. 이는 injected stop-status 처리 증거이며 whole-job death 증거가 아니다. Forced termination 뒤 verified worker death 전에는 runtime 제거·identity/cleanup authority를 허용하지 않고, 정상 close도 worker PID가 있으면 death 확인을 요구한다. Readonly launcher의 NUL stdio는 inheritable handle과 explicit two-handle allowlist를 사용한다. Explicit-output probe는 bounded local-drive output root를 argv로 고정하고 `env.TEMP`를 write authority로 사용하지 않는다. Strict result의 filesystem 관측은 해당 path/API에만 적용하며, network는 `EACCES`/`EPERM`만 denial PASS로 인정하고 `ETIMEDOUT`은 unknown/failure로 유지한다. WFP availability query는 engine option open/get/close의 bounded read-only 상태만 반환하며 access-denied get은 `unknown`, collection-disabled가 아니다. Pure event matcher는 caller가 공급한 bounded synthetic event/context에서 package-drop inference만 만든다. 별도 x64 diagnostic collector는 Windows 10 1607의 `FwpmNetEventSubscribe2`/`FWPM_NET_EVENT_CALLBACK2`와 `FWPM_NET_EVENT3`/`FWPM_NET_EVENT_HEADER3` ABI를 사용하고 callback 안에서 bounded observed DTO를 복사해 `captured|unknown`만 반환한다. 과거 계획의 Subscribe3/Event3 조합은 이 검토된 ABI로 교정되었다. Production launcher에는 suspended process의 job assignment 뒤·`ResumeThread` 전에 internal observation-lease provider hook이 있고, readiness refusal/throw와 resume failure는 verified exact-process death 없이는 release하지 않으며 unknown death/dispose failure는 lease와 process/job handles를 quarantine한다. Finalization failure는 pending exit0을 덮고 독립 cleanup은 한 번 실행된다. Concrete WFP lease adapter는 exact process/job handles, shared native guard, zero-time exact-process death observation, callback/event copy, ordered unsubscribe/free/close와 sticky quarantine을 구현한다. 별도 deterministic generator는 base launcher·collector·adapter 전체 byte를 한 PowerShell variant로 봉인하고 exact anchor와 단일 route 교체를 검증한다. 생성 variant는 caller provider/readiness 입력 없이 내부 provider를 만들며 기존 trusted control file-path 선택·hash seal로만 운반된다. Suspended process의 exact PID/creation-time frame은 parent/provider/resume continuation 전에 flush되며 created identity만 뜻한다. `GetProcessTimes` 실패 뒤 full `LaunchCore` cleanup은 source-inspected이고 runtime 증명이 아니다. Finalization 뒤 at-most-one bounded `CUE_READONLY_WFP=` frame을 exact nonce와 held root identity에 묶어 내보내고, TypeScript consumer는 strict key/canonical/bounds/binding을 검증한다. Original worker outcome 또는 PowerShell late cleanup이 성공하지 않으면 `captured`를 `unknown`으로 낮춘다. Diagnostic은 반환값에만 붙고 identity·cleanup·acceptance·readiness·denial·qualification DB/predicate에 쓰지 않는다. 기본 launcher/global dispatch는 null provider이고 generated variant도 기본 등록되지 않는다. 별도 one-shot smoke는 이 variant를 실제 실행했지만 exit1, WFP `unknown` empty, exit frame0의 FAIL/CLOSED였으며 generic lease refusal만으로 WFP status 원인·whole-job death·권한을 확정하지 않는다. 따라서 collector·matcher·hook·adapter·variant·consumer 어느 쪽도 live subscription/event reader, OS worker/job death, PID·identity, network-denial 또는 qualification authority가 아니다. Coordinator-to-ledger success는 exact nonce, verified worker death, real SQLite identity/cleanup store write와 reopen을 모두 요구하며 wrong nonce/unknown death는 authority row0이다.

재시도 claim의 host callback 이후에는 동일 transaction의 최신 시도·예산 상태를 다시 판정하며, callback mutation이 한도를 소비하면 그 mutation과 후보 claim을 함께 rollback한다. 동시 reservation 검증은 connection/migration 초기화와 실제 reservation race를 구분한다.
복구 실패 관측은 후속 호스트 콜백 전에 소유 복사본으로 고정하고, 재시도 가능 코드·쿼터 재설정 시각·독립 품질 실패·기존 후보 자격을 `cue-recovery-classification-v1` 근거로 함께 저장한다. 기존 migration036의 바깥 관측 형식은 유지한다. 결정 시 저장 형식·해시·원장 결합과 새 관측 전체의 일치를 확인하며, 결정에는 저장된 값을 사용한다. 후보 관측은 후보당 한 번만 호출해 고정한다. 근거가 빠진 과거 기록으로 새 복구나 비중단 결정 재생을 승인하지 않는다. [독립 검토](../evidence/integrations/S4/20260914-recovery-observation-integrity/review.md)에서 빌드0과 4파일80/80을 확인했다. 주입한 호스트 검증이며 실제 공급자 원인 분류나 broad S4 완료를 뜻하지 않는다.
Ledger startup의 schema discovery와 migration write는 phase001–015 및017–039를 IMMEDIATE transaction으로 직렬화한다. Migration016은 outer transaction을 거부하는 기존 전용 EXCLUSIVE/FK·pragma 복원 경계를 유지한다. Startup 예외는 열린 connection을 닫아 Windows file handle을 남기지 않는다.

변경 journal/held 복구 기반은 production consumer와 분리된 동안 read-only inspection이 `unknown`만 반환하고 pass 저장을 허용하지 않는다. Production 연결 전에는 worktree 아래 atomic path primitive로 검사와 open 사이 ancestor 교체를 막고, 실제 restore·current observer·revision 전체 lineage와 crash/native lifecycle을 검증한다.

Windows read-only 경계는 고정된 Microsoft hcsshim handle-relative safe-open 패턴을 작은 host-owned `snapshotRelative` helper로 적응한다. 동일 handle의 root/target identity·read 재검사와 reparse 거부를 검증한다. Helper hash의 import-time 재검사는 drift 탐지이고 installation provenance가 아니므로 approved root identity의 불변 저장과 authenticated generation pin 뒤에만 production capture/observer에 연결한다. Safe open은 exact compare-and-replace가 아니며 restore CAS는 별도 검증 전까지 unavailable이다.

Native journal은 승인 시 exact root identity·ordered targets·task별 common read cap을 불변 저장하고, 전체 요청이16 MiB를 넘으면 helper 조회 전 거부한다. Capture는 claim/reservation/stage/launch-intent와 같은 prelaunch transaction에서 수행하며 path 기반 fallback을 두지 않는다. Terminal receipt를 받은 뒤 이를 조정하고 fresh observation을 기록하며, 그 관측이 없거나 `unknown`이면 retry/acceptance 진행을 차단한다. Packaging의 fixed helper digest·manifest·generation 검사는 tamper/drift 탐지이며 publisher signature나 atomic hash-to-execute 보증이 아니다.

승인 화면은 선언된 변경 대상1..64개의 path/task/backup limit를 bounded text로 표시한다. 비어 있거나 부분적인 목록은 이전 disclosure를 지우고 승인을 비활성화한다. DOM 검사는 실제 Electron 실행이나 journal execution authorization을 대신하지 않는다.

중단된 journal run은 process/profile handling 전에 durable held case를 만들고, unresolved journal이 하나라도 있으면 exact workspace writer lease를 유지한다. Current-ledger 시작 순서는 별도 read connection에서 held commit을 확인한 뒤에만 side effects가 가능하도록 검증하며, stale-ledger 분기는 별도 runtime 검증 전까지 source-inspection 근거로 제한한다. Protected native host만 저장된 full cleanup/native identity를 다시 대조한 뒤 fresh read-only journal observation을 추가할 수 있다. 관측만으로 cleanup/provider terminal, disposition eligibility, lease release, restore 또는 자동 resume 권한을 만들지 않는다. 기존 persisted generated-JSON handoff resolver는 live/recovery host가 공유하며 exact artifact-owning attempt와 integrity-bound lineage를 검증한다. Recovery는 reconciliation 전과 비동기 관측 뒤 final transaction callback에서 terminal integrity를 다시 읽고, 외부 효과 완전성을 확인할 authority가 없으면 계속 held다. 이 protected recovery 연결은 source-inspected held-only 경계이며 positive native-journal/generated-handoff runtime 증거가 아니다. UI에는 검증된 journal state/revision과 다섯 개 allowlisted reason code의 고정 한국어 표시만 공개하고 raw reason/case identity/private path/action을 노출하지 않는다.

Fresh change observation은 `unknown`·`outside-manifest`·`moved`·`type-changed`를 retry/recovery 전에 `change_observation_unknown`으로 차단한다. `modified` 등 허용 상태는 이 gate만 통과하며 downstream evidence/cleanup 요건을 면제하지 않는다. Held recovery disposition은 exact case/revision/state/reason seal을 다시 계산하고 open·unknown·corrupt·seal mismatch를 거부한다. Decision issuance/replay/replan과 replacement claim은 마지막 host callback 뒤 같은 transaction에서 이를 재검사하며, valid `eligible-for-disposition`만 non-stop recovery를 허용하고 `reconciled-stop`은 stop으로 고정한다.
Decision-free ordinary retry도 final admission에서 `retry.previousAttemptId`와 recovery decision의 prior attempt ID를 중복 제거해 모두 검사한다. Open·reconciled-stop·corrupt held는 writer lease, replacement attempt, retry link 또는 activation mutation 전에 거부하며, no-held와 exact eligible seal만 store admission을 통과한다. 이 guard는 이후 budget reservation이나 runtime launch를 증명하지 않는다.
Store가 만든 recovery scope는 기존 retry contract와 `maxAttemptsTotal`·`deadlineMs`·requirements·plan·policy binding이 정확히 같아야 한다. Decision-backed revised claim은 final trusted clock과 누적 attempt cap을 다시 검사해 deadline 도달·callback clock advance·cap 소진을 replacement/activation mutation 없이 거부한다. 이는 monetary budget, full driver 또는 live workflow 증거가 아니다.
Replan engine은 original budget 안에서 기존 committed reservation과 revised reservation을 합산한다. 초과 claim은 replacement attempt·activation·stage·selection을 같은 transaction에서 rollback하고, 허용된 revised claim의 exact replay는 reservation/runtime start를 반복하지 않는다. `appendRevision`은 original approval과 requirement coverage를 유지하며 changed approval과 empty requirements를 거부한다. 이 계약의 budget 값과 runtime은 deterministic fixture/injected 경계이고 provider spending이나 billing receipt가 아니다.
Prepared approval은 `recoveryMode: manual|automatic-approved`를 불변 저장하며 omission은 `manual`이다. `automatic-approved`는 retry·requirements·trusted recovery host가 모두 있어야 하고, 실패 receipt 뒤 shared observation/decision authority와 deterministic receipt-bound ID만 사용한다. Approved retry/switch/quota는 callback 뒤 prepared request·attempt·revision·cancel/close·absolute deadline을 다시 검사한다. Stop은 sealed decision으로 종료하고 replan은 saved decision metadata만 공개한 채 explicit validated plan의 public recovery를 기다린다. Default generated host에는 진단 기반 stop-only callbacks가 연결되었지만 이 mode는 기본 활성화되지 않는다.

기본 generated-JSON host는 실패한 isolated-model 결과의 고정 `diagnosticCode`를 기존 immutable terminal activity에 저장한다. 최초 관측 실패를 유지하며 취소와 deadline을 구분하고 raw exception/provider text를 저장하지 않는다. 진단은 실패 terminal에만 선택적으로 허용하고 기존 진단 없는 기록은 유지한다. [독립 32/32 검토](../evidence/integrations/S4/20260913-generated-recovery-observations/review.md)는 mocked child/real SQLite, 재개방과 입력 경계를 확인했다. 이 코드는 provider 원인 분류·retry authority·verified cleanup/handoff를 대신하지 않는다. 재시도 가능한 원인·외부 효과 관측, 기본 자동 복구 설정과 UI 진단 표시는 후속 작업이다.

출력 없는 `produce-json` 실패는 exact issued failed/clean receipt가 있을 때 기존 verified-clean cleanup observation을 `cleanup-evidence` handoff artifact로 재사용한다. Resolver는 canonical bytes/hash, attempt/candidate/role/subject/session, 실패 terminal과 기존 receipt/handoff를 대조하며 성공·출력 있는 실행·불명확한 정리는 거부한다. 저장 상태는 failed이고 후속 checker와 acceptance는 진행하지 않는다. [독립 검토](../evidence/integrations/S4/20260913-outputless-failure-handoff/review.md)는 재개방 후 전체 terminal integrity와 running 상태의 succeeded receipt 거부를 포함한 3파일25/25 PASS다. 정리 기록의 byte integrity가 현재 OS 상태·provider stop/billing·복구 자격을 증명하지는 않는다.

Generated host의 trusted recovery observer는 exact failed/clean receipt·verified terminal handoff·허용된 진단을 가진 canonical terminal activity를 다시 검증한다. Attempt/ordinal/payload/receipt/handoff에 묶인 짧은 digest 참조로 기존 activity bytes를 읽으며 재개방·변조·외래 참조·미래 timestamp를 검증한다. 현재 진단은 provider 원인과 외부 효과를 확정하지 않으므로 cause/effects는 `unknown`, retry/quality/eligibility는 false, quota는 null, candidate 관측은 미제공이다. 명시적으로 승인된 retry와 `automatic-approved` 설정에서는 기존 정책이 durable observation과 stop 결정을 저장하고 추가 실행을 막는다. 기본 설정은 retry 없이 manual이며 자동 재시도·전환 자격은 아직 없다. [독립 검토](../evidence/integrations/S4/20260913-generated-recovery-authority/review.md) 19/19 및 build0.

로컬 모델 HTTP non-OK 응답은 `local-http-401/403/408/429/5xx/other` 고정 진단으로 기록한다. 통신 모듈 내부 WeakMap이 발급한 오류만 인식하고 임의 message/property/prototype은 근거로 사용하지 않는다. HTTP200 missing-body는 HTTP 거부로 분류하지 않는다. 실제 transport→isolated adapter 연결과 기존 terminal activity를 재사용하며 response body/statusText/headers는 진단에 저장하지 않는다. [독립 검토](../evidence/integrations/S4/20260913-local-transport-failures/review.md) 3파일26/26, compiled classifier hostile6/6, build0. HTTP 코드만으로 provider 원인·quota reset·재시도 자격을 추론하지 않으며 현재 recovery cause/effects는 unknown으로 유지한다.

### S5 — 실측 성과 기반 선택 개선

저장된 비교 ID의 명시적 조회는 `cue:evaluation`의 exact `comparison-read` 명령으로 기존 workspace-scoped Core를 호출한다. 새 실행 준비 전에도 조회할 수 있지만 현재 실행의 등록·관측 권한은 기존 gate를 유지한다. IPC는 membership/run/관측 ID·raw constraints·오류 내용을 제외한 bounded descriptive DTO만 반환한다. 화면은 저장 시점·모드·평가/홀드아웃 상태와 기록/측정/누락 수·제한 사유를 표시하고 새 조회·새 작업·실패 때 이전 결과와 지연 응답을 지운다. 통계 검정 미수행·승격 불가를 명시하며 현재 null-trial은 근거 부족이다. [독립 검토](../evidence/integrations/S5/20260913-comparison-read-ui/review.md)는 actual SQLite Core→IPC 및 DOM 2파일9/9와 문구 수정 후 UI8/8(중복, 합산 금지), build0/문법0을 확인했다. 조회는 저장·실행·승격을 발생시키지 않으며 목록·생성·실제 Electron 시각 검증은 별도다.

저장된 비교 목록은 현재 Core 작업공간에 고정된 읽기 전용 API로 제공한다. Exact limit(1..20)·cursor(null 또는 양의 safe integer)만 받고 한 요청에 rowid 저장 순서로 최대64개 ID를 검사한다. 각 기록은 보호된 내부 read helper에서 무결성과 전체 workspace membership을 재검증한 뒤 제한된 요약만 반환한다. Numeric cursor는 조회 위치일 뿐 권한이 아니며 다른 작업공간 ID나 오류 내용을 담지 않는다. 페이지/검사 한도에 닿으면 incomplete와 다음 위치를 유지하며 빈 페이지를 전체 목록의 끝으로 오인하지 않는다. 화면은 명시적 새로고침·다음 페이지·선택을 제공하고 선택 시 기존 상세 조회로 다시 검증한다. [독립 검토](../evidence/integrations/S5/20260913-comparison-list/review.md) 2파일10/10 및 root build0. DB outer transaction·위조 receiver·stale cursor를 거부하며 목록은 비교 생성·실행·승격 권한을 만들지 않는다. 실제 Electron 시각 검증은 별도다.

저장된 평가 관측은 명시적 `비교용 기록 저장` 동작으로 기존 immutable projection 저장소에 연결한다. Core는 enrollmentId·observationId만 받고 현재 작업공간과 저장 관측의 결합을 확인한 뒤 두 ID에서 안정적인 projection ID를 도출한다. IPC는 준비된 현재 run의 등록만 허용하고 raw run ID·digest·측정값 없이 제한된 설명 DTO를 반환한다. 화면은 새 등록·관측·작업과 늦은 응답·오류에서 이전 결과를 지우며 새 측정이 아닌 파생 기록임을 표시한다. [독립 검토](../evidence/integrations/S5/20260913-evaluation-projection-ui/review.md) 3파일16/16, root 최종 build0. 실제 SQLite Core→IPC 재생·재열기·변조·다른 작업공간 거부와 쓰기 범위를 검증했다. `trial:null`·승격 불가는 유지하며 비교 생성 화면·실측·실제 Electron 시각 검증은 별도다.

저장된 기준선·후보 비교용 기록 ID와 후보 모드를 직접 입력해 비교를 생성하는 화면을 제공한다. `comparison-create` IPC와 별도 Core wrapper는 각 군 1..64개(합계 최대128개)의 정확한 ID 배열만 받고 현재 작업공간·기록 무결성·수동 기준선·후보 모드를 확인한다. 정책 digest는 저장 기록에서 도출하며 기존 immutable comparison 저장소를 재사용한다. 고정 설명 기준은 가격 근거 최대24시간, 분할별 최소2쌍, 품질/성공률 최소0.5, 미확인 비율 최대0.5, 개선 기준0, 비용 한도null, 비용/시간 기준값1이며 실측값이나 승인된 정책이 아니다. 명시적 저장·동일 요청 재생·ID 충돌 거부·늦은 응답과 오류 초기화를 제공한다. [독립 검토](../evidence/integrations/S5/20260913-comparison-create-ui/review.md) 2파일12/12, root 최종 build0. 현재 결과는 `trial:null`에 따른 insufficient/승격 불가다. 기록 선택 목록·사용자 지정 비교 기준·실측·실제 Electron 검증은 별도다.

저장된 비교용 기록은 명시적인 목록 조회와 선택으로 기존 비교 생성 폼에 추가할 수 있다. Core `listEvaluationProjections`와 `projection-list` IPC는 limit1..20 및 rowid cursor만 받고 최대64개 ID를 검사한 뒤 기존 immutable projection 저장소·현재 작업공간을 재검증한 요약만 반환한다. 다른 작업공간/손상 기록은 노출 없이 건너뛰며 빈 페이지도 다음 cursor로 계속 조회할 수 있다. 기준선은 기존 manual-baseline만 허용하고, 첫 후보 선택은 빈 입력란의 모드를 맞추며 이미 후보 ID가 있으면 현재 모드 일치를 요구한다. 중복·각 군64개 한도를 지키고 선택만으로 비교를 생성하지 않는다. 조회 오류는 선택 가능한 목록을 지우되 직접 입력한 ID를 보존하고, 새 작업 이후 늦은 응답은 무시한다. [독립 검토](../evidence/integrations/S5/20260914-comparison-record-picker/review.md) 2파일13/13, maker build0. 실제 SQLite Core→IPC와 DOM 범위이며 실제 Electron·실측·승격은 별도다.

비교 생성은 선택적인 `criteria` 객체로 기존 아홉 설명 기준을 설정할 수 있다. 미지정 요청은 기존 기본값을 유지하며, 지정 시 가격 근거 유효기간·분할별 최소 쌍 수·품질/성공률/미확인 비율·비용 상한·비용/시간 기준값·최소 개선값을 빠짐없이 검증한다. Core/IPC는 정확한 data-property 필드, 안전한 정수와 범위, 유한 숫자를 projection 읽기/쓰기 전에 확인한다. 고성능 모드는 기존 엔진 규칙대로 명시적 비용 상한을 요구하며 임의 상한은 만들지 않는다. 저장된 기준은 기존 immutable snapshot에 포함되고 생성/재조회 화면에 제한된 기준 DTO로 표시한다. 정책 digest·관측/측정값은 사용자 기준에서 받지 않는다. 동일 ID의 다른 기준은 충돌로 거부하며 기준의 통화 변환·실측·정책 승인 권한은 없다. [독립 검토](../evidence/integrations/S5/20260914-comparison-criteria/review.md) 3파일17/17, root 최종 build0. 실제 SQLite 기본/사용자값 재생·재열기·충돌·고성능 상한과 DOM 저장 기준 표시를 확인했다. 실측·통계 자격·승격·실제 Electron 검증은 별도다.

저장된 측정 사실에는 읽기 전용 근거 요약을 제공한다. Core `projectEvaluationMeasuredFactEvidence({factId})`는 명시적 측정 호스트 설정·열린 DB·외부 transaction 부재·현재 작업공간을 먼저 확인한 뒤 기존 measured-fact 저장소로 사실과 근거 바이트를 재검증한다. 생산자 class/revision/digest, 저장된 실행의 도구·모델 revision/lineage digest, 입력 digest 일치, 품질/시간/회계 자료 유무와 불확실성을 동결된 backend DTO로 반환한다. 원문 근거·품질 점수·회계 항목/총액을 전달하지 않으며 `trialReady:false`·`promotionEligible:false`를 유지한다. 기존 trial v1과 기본 호스트 활성화는 변경하지 않는다. [독립 검토](../evidence/integrations/S5/20260914-measured-fact-evidence/review.md) 3파일15/15, root build0. 실제 SQLite/Core 검증은 주입한 terminal authority와 제한된 테스트 lineage를 사용하므로 런타임·실측 정확성·도구 자격·정책 승격 증거가 아니다. UI/IPC 노출은 별도다.

측정 사실의 종료 무결성 결과는 정확한 동기 plain object `{status,attemptId}`로 검증한다. 두 필드는 enumerable own data property여야 하며 `verified` 상태와 현재 저장된 실행 시도 ID가 모두 일치해야 한다. 다른 시도·누락/추가 필드·getter·Proxy·custom prototype·Promise는 접근자를 실행하지 않고 거부한다. 이 검사는 최초 capture뿐 아니라 저장 사실 read·capture replay·Core 근거 조회에도 적용된다. 정상 사실의 schema·canonical payload·digest·생산자 분류는 유지한다. [독립 검토](../evidence/integrations/S5/20260914-measured-terminal-binding/review.md) 3파일16/16, maker build0. 실제 SQLite/Core fixture에서 거부 시 쓰기/재수집0, trap0, 정상 응답 복원·재열기 불변을 확인했다. 주입한 호스트 결과의 연결 검증이며 실제 런타임 자격·측정 정확성·기본 호스트 활성화는 별도다.

측정 사실의 canonical 검증은 호스트 자료를 먼저 Cue 소유의 깊은 복사본으로 고정한 뒤 근거/종료 콜백을 호출한다. 원본 객체를 동결하지 않으며, 원본의 콜백 중 변경이나 저장 후 변경이 검증값·저장값·반환값에 영향을 주지 않는다. 복사는 descriptor만 읽고 getter·Proxy·custom iterator/toJSON·순환·희소/추가 배열 필드·비JSON 값을 거부한다. raw JSON 누적 UTF-8 크기1MiB, 깊이64, 노드262144, 배열65536, 객체 키4096 한도를 검사하며 기존 필드/배열 순서와 schema/digest 구성을 유지한다. [독립 검토](../evidence/integrations/S5/20260914-measured-capture-snapshot/review.md) 3파일19/19, root build0. SQLite/Core에서 호스트 시간3→999 변경에도 저장/재조회3 유지, 원본 독립 변경·반환값 동결, trap/쓰기0, 큰 escaped 입력 거부를 확인했다. 이 수리는 신뢰된 측정 호스트의 자료 처리 경계이며 실측·생산자 자격·trial/승격 권한은 추가하지 않는다.

저장된 측정 근거는 평가 화면에서 사실 ID를 직접 입력해 조회할 수 있다. `measured-fact-read` IPC는 준비 전에도 정확한 factId 요청만 받아 기존 작업공간 보호 Core 조회를 호출하고 반환 ID를 대조한다. 화면에는 생산자 구분·개정·기록 시각, 최대1024개 실행의 도구/모델 정보, 품질·시간·회계 자료 유무 및 불확실성 개수만 전달한다. 회계 유형은 unknown/local-invocation/monetary와 availability 조합을 검증하며 원문 근거·임의 사유·품질 점수·회계 총액·예외 상세는 전달하지 않는다. 새 조회/오류/새 작업에서 이전 결과를 지우고 승인 시 조회를 잠그며 늦은 응답을 무효화한다. [독립 검토](../evidence/integrations/S5/20260914-measured-evidence-ui/review.md) 3파일28/28, root build0. Mock IPC·DOM과 별도 SQLite/Core 회귀 범위이며 실제 Core→IPC 정상 연동·Electron 시각 검증·생산 측정 자격은 별도다. 기본 호스트 비활성 및 trial/승격 불가는 유지한다.

측정 근거 조회는 실제 SQLite 저장소와 Core에 `registerIpcHandlers`를 연결한 통합 검증도 완료했다. 준비 전 저장 사실 조회·정확한 제한 DTO·반복/재시작 후 재조회, 읽기 중 DB 쓰기/재수집 없음, 다른 작업공간·미설정 호스트·닫힌 Core·외부 transaction·잘못된 입력 거부를 확인했다. 근거 바이트 변경과 저장 자료 변조는 내부 상세 없이 조회 불가로 반환하며 미측정 항목은 unavailable을 유지한다. [독립 검토](../evidence/integrations/S5/20260914-measured-core-ipc/review.md) 3파일28/28(Core8·측정UI8·평가UI12), root build0. 이번 변경은 기존 테스트 확장이며 제품 코드는 변경하지 않았다. Core→IPC 정상 연결의 기존 검증 공백은 해소했으나 실행 계보와 종료 권한은 합성 fixture이므로 실제 런타임·측정 정확성·Electron 시각 검증은 별도다.

저장된 측정 사실은 수동 목록 조회와 선택으로 찾을 수 있다. Core `listEvaluationMeasuredFacts({limit,cursor})` 및 `measured-fact-list` IPC는 정확한 요청과 limit1..20·양의 안전한 rowid cursor를 검증하고, 측정 호스트 미설정·닫힌 DB·외부 transaction을 거부한다. 최대64개 ID를 검사해 작업공간과 기존 근거를 재검증한 최대20개 요약만 반환하며 외래/손상 기록은 비공개로 건너뛴다. 빈 중간 페이지도 계속 조회할 수 있고, 목록에는 사실 ID·생산자 구분/개정/기록 시각 및 고정된 readiness/승격 불가만 담는다. 화면은10개씩 수동 새로고침·다음·선택을 제공하고 선택 시 기존 상세 읽기로 재검증한다. 새 선택은 이전 응답을 무효화하며 목록 오류·새 작업·승인은 진행 중 조회와 화면을 정리한다. 오류 시 직접 입력한 ID는 유지한다. [독립 검토](../evidence/integrations/S5/20260914-measured-fact-picker/review.md) 3파일35/35, 최종 build0. 합성 SQLite/Core→IPC·DOM 검증이며 실측·기본 호스트 활성화·실제 Electron·trial/승격 자격은 별도다.

명시적 실행 보고서 내보내기는 해당 실행의 저장된 측정 근거를 재검증한 제한 요약도 포함한다. Core는 열린 DB·외부 transaction 부재·현재 작업공간을 콜백과 파일 생성 전에 확인한다. 기존 성과 보고서 digest를 `measuredEvidenceBaseReportDigest`로 보존하고 측정 요약은 별도 읽기 시점으로 표시한다. 실행별 최대64개 사실을 검사해20개 요약·요약당20개 도구/모델 정보를 담으며 scanComplete·생략/검증 실패 수·실행 정보 생략 수를 구분한다. 생산자 구분/개정/시각·측정 자료 유무·확인된 경과 시간만 전달하고 원문 근거/경로·임의 사유·점수·금전 총액은 제외한다. 호스트 미설정은 unavailable, 접근 가능한 빈 실행은 빈 조회 완료로 표시하며 trial/승격 불가는 유지한다. 조회로 생성한 요약만 보고서에 추가할 수 있고 기존 전달 경로의 최종 HTML/명세 해시를 사용한다. [독립 검토](../evidence/integrations/S5/20260914-measured-run-report/review.md) 5파일37/37, maker 최종 build0. 실제 SQLite/Core 내보내기·재조회/재시작·근거 변경/변조·작업공간 차단·영수증/해시를 검증했으나 실행 계보와 종료 권한은 합성 fixture이므로 실측 정확성·런타임·Electron 시각 자격은 별도다.

신규 제안: `daemon/src/evaluation/`. 테스트: `integration-evaluation.test.ts`.

작업 유형·모델/도구/정책 revision별 검증 성공률·품질·시간·총비용·재시도/인계 비용을 축적한다. 실패/취소/unknown을 제외해 성공률을 부풀리지 않는다. 로컬 부하와 계정 제한도 반영한다.

회계 투영은 고정 cutoff의 역사 snapshot/digest와 cutoff 이후 current disclosure를 분리한다. 금전 값은 decimal 문자열의 debt/remaining을 보존하고, 금액을 알 수 없는 local 실행도 완전한 호출 수를 별도로 기록한다. Revised lineage를 검증하지 못하면 역할을 추정하지 않고 unclassified로 둔다.

기존 run-outcome/report consumer는 완전한 authoritative actual inventory에만 base/retry/verification class totals를 공개한다. Missing/estimated receipt는 `final=false`와 class totals `null`을 반환한다. Revised-unverified lineage는 유효한 final/actual totals를 보존할 수 있지만 class breakdown만 `null`로 유지한다. Handoff 비용 schema가 없으면 handoff는 `null`, local accounting은 count-only로 표시한다.

Measured fact의 최초 저장은 caller가 전달한 authoritative-shaped snapshot을 거부하고 같은 transaction에서 현재 authoritative inventory를 내부 capture한다. 저장된 cutoff의 historical projection과 byte-equivalent accounting만 fact identity로 인정하며 current disclosure는 identity에 포함하지 않는다. Core는 명시적으로 공급된 trusted runtime host가 있을 때만 같은 daemon DB의 store를 만들고, workspace/enrollment/observation 및 기존 fact tuple을 host callback 전에 검증한다. 이 연결은 `trialReady:false`를 유지하며 trial/promotion authority를 만들지 않는다.

기존 평가군 등록·관측·coverage UI의 실제 검증은 DOM/data assertion과 독립 시각 판정을 분리한다. 접힌 상위 details 아래의 대상은 화면 증거가 아니며, 각 시나리오가 서로 다른 실제 상태를 열고 대상이 viewport와 교차함을 확인해야 한다. 이 UI 검증은 분리된 authoritative accounting의 Core/UI 연결 증거가 아니다.

완료: 동결 작업군과 독립 holdout에서 수동 기본 조합과 비교한다. 효율은 품질 하한 유지·시간/비용 종합 목적 개선, 고성능은 예산 내 검증 품질 개선, 가성비는 품질 유지·총비용 감소, 속도는 품질 유지·완료시간 감소를 입증한다. 표본 수·분산·가격 시각을 기록하고 개선 미확인 정책은 승격하지 않는다.

### S6 — 지식·리소스·회고·제한된 확장 (TA-01, TA-03, TA-04, PI-05)

신규 제안: `daemon/src/knowledge/`, `daemon/src/resources/`, `daemon/src/extensions/`. 테스트: `integration-resources.test.ts`.

TeamAI의 근거 검색·버전 고정 배포·회고 초안을 적용한다. 자료는 출처/revision/hash로 추적하고 참고 데이터로만 사용한다. 한국어+영어 식별자 평가셋으로 검색 적중 개선·오탐 비증가를 확인한다. 인증/환경/원시 대화는 기본 색인 제외, 외부 공유는 기본 비활성이다.

패키지는 경로/스키마/크기/hash 검사 후 다음 run부터 사용한다. 사용자 홈의 훅/MCP를 자동 주입하지 않는다. 초기 확장은 선언형/읽기 전용부터 시작한다. 임의 Node 실행 플러그인은 OS 경계·P13 검증 전 보류한다.

완료: 업데이트로 활성 정책 변경 0, 제거 시 사용자 파일 손실 0, 미자격 확장의 권한 취득 0. 통신 비활성 모드의 외부 요청 0. 출처 없는 검색 결과를 검증 증거로 승격하지 않는다.

### S7 — 실행·구조·비교 다이어그램 (AR-01, AR-02, AR-03)

현재 정적 소스 보고서는 [독립 갱신 검토](../evidence/integrations/S7/20260914-current-source-refresh/review.md)의 generation 26081b82…로 갱신했다. JS/TS 170파일·선언 import 385관계와 5개 산출물의 바이트/지문, 전후 소스 기준 일치를 검증했다. 이전 generation은 보존하며 실행 의존성·영향·성능·시각 품질 증거로 해석하지 않는다.

Current-source 정적 snapshot은 현재 파일 byte와 declared relative import만 결합한다. Byte-identical active generation은 fixed artifact set·manifest·source-basis가 모두 일치할 때만 재사용하며, 새 staging만 제거하고 pointer와 기존 generation은 다시 쓰지 않는다. Extra/missing/malformed/tampered/stale content는 publication 전에 실패한다. 새 source digest가 생기면 이전 HTML/화면은 exact 역사 snapshot으로 남기고 새 visual/runtime 증거로 재사용하지 않는다.

기존 접점: `daemon/src/reporting.ts`, `state-machine.ts`, `ledger.ts`.
신규 제안: `daemon/src/reports/`. 테스트: `integration-reports.test.ts`.

다이어그램 IR을 원장 기준점·실제 승인 객체·코드 revision에서 생성한다. Archify를 채택하면 해당 입력 계약으로 변환한다. 계획/관측을 구분하고 가상 상태를 넣지 않는다. 기존 텍스트 보고/Mermaid는 유지한다. HTML은 읽기 전용 산출물로 전달하고 앱 내 보기는 privileged IPC와 분리한다. 선언된 소스 관계만으로 실제 소스 추출·검증 완료를 표시하지 않는다.

CLI의 Node/Git 자식 프로세스는 현재 워커 정책과 충돌하므로 단일 프로세스 API 또는 Cue 소유 단계별 실행을 검증한다. 불가능하면 기존 보고서를 유지한다. [R-08](reuse-decisions/R-08-archify.md)은 고정 CLI/자산 편입을 보류하고 Cue 소유 IR·renderer·전달 구현을 선택했다. 따라서 현재 구현에는 upstream CLI 자식 실행·업데이트 확인 자체가 없다. 출력 경로 제한과 네트워크 비활성은 선택한 구현에서도 필수다.

완료: 입력/출력 hash 일치, 실패 시 마지막 정상 보고서 보존, 실제 산출물의 브라우저 증거와 독립 시각 검토를 각각 기록한다. 고정 Archify CLI를 사용하는 구현에는 upstream deliver/visual-check도 필수다. 현재 R-08 경로의 upstream CLI 검사는 **N/A(미편입)**로 명시하고 Cue 전달 검사·실제 Electron 증거·시각 검토로 각 구현 경계를 검증한다. N/A를 upstream 통과로 표시하지 않는다. Source 산출물은 exact observation revision의 content-addressed snapshot과 원자적 active-generation pointer로 전달하며, 이후 source 변경 시 보존된 generation은 역사 증거가 되고 현재 작업 트리 표시는 재캡처 전까지 미완료다. 완료 표현은 bounded static source snapshot과 declared-import diagram/comparison으로 제한하며 runtime dependency·실행 영향·안전/성능 증명으로 확장하지 않는다.

## 7. 검증·배포·완료 규칙

문서 개정 단계에는 설치·모델 호출·앱 구현을 수행하지 않는다. 향후 유료 검증은 승인된 계정/예산 범위에서 실행하고 미승인 외부 게시를 하지 않는다.

각 단계는 기준선→구현→해당 테스트→필요한 실측→독립 검토 순서다. §6의 테스트 파일을 만든 뒤 daemon 디렉터리에서 실행한다.

```powershell
# cwd: C:\Users\User\cue\daemon; S2 예시
npx vitest run test/integration-selection.test.ts --fileParallelism=false --maxWorkers=1
# cwd: C:\Users\User\cue; 단계 통합 검사
npm test
```

종료 코드 0이 필요하며 mock과 실물 검증을 구분한다. 실행 경계 변경 시 해당 P13 및 관련 P12 정지/부모 사망/봉인/자격증명 게이트를 현재 빌드로 재측정한다. 기존 실패를 기록하고 새 회귀를 숨기지 않는다.

증거: `evidence/integrations/S<번호>/<run-id>/`에 소스 revision, 명령/exit code, 입력/출력 hash, 환경, 정책/가격 시각, 실제/추정/미측정 구분, 독립 리뷰를 보관한다. Stop-hook 상태는 프로젝트 밖 기존 위치에 둔다.

기능 플래그로 도입하고 기존 Codex 경로·텍스트 보고를 복구 경로로 유지한다. DB는 버전형 마이그레이션·검증된 백업 복원을 사용한다. 변경마다 측정 게이트를 정하고 최대 2회 가설 수정 후 재평가한다. 회귀는 해당 변경만 되돌리거나 비활성화한다.

첫 제품 이정표는 S0~S4: 검증된 복수 실행 후보를 네 모드로 선택하고 요구사항을 끝까지 추적하는 흐름이다. S5 개선을 입증하기 전에는 최적화 성능 검증 완료로 표시하지 않는다. S6~S7은 확장/설명 계층이다. 실행형 플러그인 등 보류 기능은 해제 조건을 남기고 전체 지원 완료로 표현하지 않는다.

## 8. 재사용 우선 개발 방식

**범용 기능은 검증 가능한 외부 부품을 우선 검토하고, Cue의 판단·권한·상태 계약은 Cue가 소유한다.** 전체 저장소를 합치는 것을 기본 경로로 삼지 않는다. 직접 작성할 코드량을 줄이되 통합 검증은 생략하지 않는다.

기존 S0~S7의 목표·모드·완료 기준은 유지한다. 이 절은 각 단계의 구현 방식을 정하며, S0~S2부터 적용한다. r3 작성 시에는 조사·채택 절차만 정의했다. 이후 후보 비교와 격리 실험을 시작했으며 최신 상태는 구현 기록과 체크리스트를 따른다.

### 8.1. 재사용과 Cue 소유 범위

| 기능 | 기본 전략 | Cue에 남길 책임 |
|---|---|---|
| 모델 API·스트리밍·프로토콜 파싱 | 공식 SDK/독립 라이브러리 우선 비교 | account/model 매핑, 허용 범위, 취소·사용량 해석 |
| CLI 연결·이벤트 정규화 | 공개 프로토콜/클라이언트 재사용 | 실행 identity, 프로세스 소유권, 정지·복구 계약 |
| 역할/스킬/설정 형식 변환 | TeamAI 등 작은 모듈 비교 | 입력 검증, 실제 권한과 모델 선택 정책 |
| diff·검색·다이어그램 | 기존 구현 재사용 우선 | 출처·출력 경계·보고서 한계·복원 권한 |
| 큐·그래프·재시도 자료구조 | 적합한 일반 라이브러리 비교 | 상태 전이, 단일 writer, idempotency, 시도/예산 상한 |
| 모드별 선택·예산 예약·재계획 | Cue 계약 중심 구현 | 최종 의사결정·불변식·감사 기록 전체 |
| 완료 검증·격리·Stop·원장 | 현재 Cue 보증 유지/확장 | 외부 엔진에 최종 판정을 위임하지 않음 |

“Cue 소유”는 모든 코드를 새로 작성한다는 뜻이 아니다. 외부 부품 내부 사정이 승인 범위·완료 기준·예산·실행 상태의 의미를 바꾸지 못하도록 한다.

### 8.2. 기능별 후보 조사 → 연결 실험 → 결정

1. **계약부터 작성:** 입력/출력, 실패/취소 의미, OS/프로세스/네트워크 조건, 허용 부작용, 필수 게이트를 고정한다.
2. **소수 후보 조사:** 기능당 우선 최대 3개 후보와 직접 구현 대안을 비교한다. 적합한 후보가 없으면 탐색을 무한 확대하지 않고 공백과 직접 구현 이유를 기록한다.
3. **편입 전 적합성 검사:** 정확한 repo/package identity, commit/version, 재배포 조건/제3자 고지, 공개 API, 내부 workspace 결합, Windows/Node/Electron 호환성, 테스트/유지보수, 설치 스크립트/네트워크/프로세스 요구를 확인한다. stars 수는 통과 근거가 아니다.
4. **분리된 연결 실험:** disposable 경로에서 고정 fixture로 실행한다. 프로젝트 의존성·사용자 홈·실제 계정을 바꾸지 않는 오프라인 실험을 먼저 한다. 실제 연결/과금이 필요하면 기존 승인 범위 안에서만 추가 검증한다.
5. **채택/제한 채택/기각:** 구현량이 아닌 전체 비용과 필수 게이트로 결정한다. 안전·라이선스·핵심 기능의 미확인은 점수 평균으로 상쇄하지 않는다.
6. **편입 후 검증:** 얇은 Cue 어댑터로 연결하고 기존 회귀, 경계 계약, 실제 필요한 OS/외부 동작 검증을 수행한다. 실험 성공과 제품 지원 완료를 구분한다.

첫 후보 조사 범위는 [도입 목록의 R-01~R-06](INTEGRATION_BACKLOG.md#재사용-조사-작업)이다. 기능당 최초 조사 1회·초기 실험 1회, 실험 수정은 새 가설로 최대 2회 수행한다. 이후 계속할 근거가 없으면 기각/보류/직접 구현으로 전환한다. 전체 중단이나 무조건적인 사용자 확인을 뜻하지 않는다.

### 8.3. 비교표와 판정 기록

각 후보에 아래 항목을 기입한다. 확인되지 않은 값을 추정 확정하지 않는다.

| 기록 | 내용 |
|---|---|
| 식별/추적 | R-ID, S단계, 기능, repo/package, commit/version/hash, 조사일 |
| 적합성 | 필수 API/기능, OS/runtime, 의존성 수/종류, 내부 결합, 설치/실행 부작용 |
| 유지 조건 | license/고지, 공개 API 안정성, 필요한 patch, upstream 업데이트/취약점 처리 경로 |
| 실험 | 입력 fixture/hash, 실행 명령/exit code, 정상·실패·취소·재시작 결과, 실행 시간/자원 |
| 비용 비교 | 조사+연결+수정+검증+업데이트 추정 노력과 직접 설계+구현+검증+유지 추정 노력, 실제 소요/가정 구분 |
| 결정 | adopt / limited / reject / defer, 근거, 남은 제한, 교체 경로, 독립 검토자 |

비용 비교는 같은 기능/검증 범위로 한다. 근거 없는 절감 비율을 쓰지 않는다. 단순한 순수 변환 함수는 취소/프로세스/재시작을 `해당 없음 + 이유`로 기록하고 결정성·잘못된 입력·출력 안전성을 검사한다. 런타임 부품은 필수 수명주기 검사를 생략하지 않는다.

### 8.4. 최소 실험과 채택 기준

- 정상: 같은 계약의 입력에 예상 구조/이벤트/결과가 나온다.
- 실패: 잘못된 입력·부분 스트림·프로세스 오류를 성공으로 해석하지 않는다.
- 취소/정지: 요청 성공과 실제 정리를 구분하고 Cue의 관측 경로로 확인한다.
- 재시작/중복: 미완료 시도와 외부 부작용을 대조하고 중복 실행을 막는다.
- 경계: 사용자 홈/인증/미승인 경로/네트워크/숨은 자식 실행 변경을 확인한다. 필수 실행 보증 충돌은 기각 또는 해당 기능 비활성 조건이다.
- 비용: 예상 연결 코드·외부 patch·직접 구현 대안을 기록한다. 외부 내부 구조를 대폭 고쳐야 하거나 두 번째 권한/상태 엔진을 유지해야 하면 직접 구현을 우선 재평가한다.

필수 게이트 통과 + 직접 구현 대비 유지 비용 이점 + 검토 가능한 증거가 있어야 adopt다. limited는 비활성/제한 기능을 명시하고 남은 기능이 Cue 계약을 충족할 때만 가능하다. 모르는 것을 지원 가능으로 처리하지 않는다.

### 8.5. 편입·업데이트·탈출 경로

우선순위는 공개 SDK/API 의존 → 독립 CLI/sidecar 계약 → 작은 모듈의 출처 보존 편입 → 필요한 경우에만 깊은 fork다. CLI/sidecar는 Cue 프로세스 정책에 적합한 경우만 선택한다.

- 의존성은 lockfile/정확 버전 또는 commit/hash로 고정하고 재배포 고지를 유지한다.
- 외부 수정은 별도 patch 목록·이유·테스트와 함께 보관한다. 생성 코드/벤더 코드와 Cue 연결 코드를 구분한다.
- 외부 객체/상태를 Cue 내부 전역 계약으로 확산시키지 않는다. 교체 가능한 adapter seam과 fallback을 둔다.
- 업데이트는 별도 변경으로 처리하고 계약 테스트·관련 회귀·필요한 P13 지문 재측정을 거친다. 자동 업데이트가 활성 run을 바꾸지 못한다.
- upstream 테스트는 재사용할 수 있지만 Cue 통합 테스트를 대신하지 않는다. CI 초록불만으로 OS 격리/실제 취소/품질을 증명하지 않는다.

PI-Desktop, TeamAI, Archify는 참고 후보이며 이름을 등록했다고 코드 편입이 확정된 것은 아니다. 특히 내부 workspace 의존 패키지는 독립 공개 라이브러리처럼 가정하지 않는다. 기능을 동일 계약으로 직접 구현하게 되더라도 외부 후보 기각 근거를 남기면 올바른 결과다.

### 8.6. S단계에 추가되는 게이트

| 단계 | 추가 작업/완료 조건 |
|---|---|
| S0 | R-01~R-06 기능 계약·후보 비교·직접 구현 대안 기록. 다음 단계의 실험 대상과 사전 기각 사유 확정. 최종 채택은 해당 연결 실험 이후 |
| S1 | R-01~R-03에서 채택한 부품으로 계약 실험 후 얇은 어댑터 연결. 불일치는 직접 구현하거나 기능 비활성 |
| S2 | R-04~R-06의 역할/사용량/검증 부품 활용. 선택·예산 최종 정책은 Cue 소유 |
| S3~S7 | 실제 착수 기능에 같은 조사/실험/판정 절차 적용. 먼 단계 후보 조사를 S1/S2의 차단 조건으로 만들지 않음 |

결정 기록은 구현 착수 시 `docs/reuse-decisions/<R-ID>.md`, 실험 증거는 `evidence/integrations/S<번호>/<run-id>/reuse/<R-ID>/`에 둔다. 지금은 경로 제안이며 기록이 생성/통과됐다는 뜻이 아니다. 기존 단계별 제품 완료 게이트는 모두 유지한다.

## 구현 상태 — 2026-09-11 작업 기록

단계 정의와 현재 동작을 구분한다. 최신 완료 항목은 [체크리스트](INTEGRATION_CHECKLIST.md), 실행 명령·증거·제한은 [진행 기록](INTEGRATION_PROGRESS.md)이 기준이다.

- R-01~R-06 사전 비교와 격리 실험을 수행했다. 외부 프로젝트 전체를 제품에 편입한 상태는 아니다.
- Qwen `qwen38-27b-unc` / llama.cpp `http://127.0.0.1:8085/v1`의 모델 목록 및 실제 SSE 응답을 확인했다. 서버 보고 context는 144K다. 모델 실행 자격과 최대 컨텍스트 부하 검증은 별도다.
- daemon의 증거 기반 자격 평가와 공통 실행 계약을 구현하고 집중 테스트했다. 실제 앱/dispatch 연결과 기존 Codex 동작 보존 검증은 아직 남아 있다.
- 네 모드의 순수 선택 정책을 구현했다. 고정 기준 정규화·품질 하한·비용/기한/자원 필터·수동 고정·동점 처리를 검사했으며, 실제 데이터 수집·예산 예약·UI·실행 연결은 별도다.
- 과거 Codex manifest 바이너리 핀 불일치는 사용자 지시에 따라 추적을 보류한다. 해당 실패를 새 후보의 자격 또는 검증 통과로 해석하지 않는다.

## 9. 참고 구현

재사용 커밋·라이선스는 [도입 목록](INTEGRATION_BACKLOG.md)에 고정한다. 후보 전체 지원과 외부 코드 편입은 별도 검증 전 완료로 표시하지 않는다.

- PI-Desktop: [RuntimeHost](https://github.com/vastsa/PI-Desktop/blob/db29ac2e8e5d59d9da8ba73d18423e964548c1a5/packages/agent-runtime/src/host-client.ts), [queue](https://github.com/vastsa/PI-Desktop/blob/db29ac2e8e5d59d9da8ba73d18423e964548c1a5/crates/host-core/src/turn_queue.rs), [review](https://github.com/vastsa/PI-Desktop/blob/db29ac2e8e5d59d9da8ba73d18423e964548c1a5/crates/host-core/src/review.rs).
- TeamAI: [역할 변환](https://github.com/Tencent/teamai-cli/blob/9e7adc79faa03ef4c3a49cb7a148bba83b7dc1f3/src/resources/agent-format.ts), [검색](https://github.com/Tencent/teamai-cli/blob/9e7adc79faa03ef4c3a49cb7a148bba83b7dc1f3/src/code-knowledge-recall.ts).
- Archify: [전달 계약](https://github.com/tt-a1i/archify/blob/18911058008f17dc065af23a2cdc9bfeff6d3f7a/archify/references/delivery-contract.md), [구조 비교](https://github.com/tt-a1i/archify/blob/18911058008f17dc065af23a2cdc9bfeff6d3f7a/archify/delta/architecture-delta.mjs).
