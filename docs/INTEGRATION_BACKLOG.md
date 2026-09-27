# Cue 외부 프로젝트 도입 목록

등록일: 2026-09-11  
상태: **도입 목록 등록 완료 / S0 조사·S1~S4 기반 및 앱 연결 구현 중**  
실행 계획: [통합 작업 spec](INTEGRATION_SPEC.md) · [체크리스트](INTEGRATION_CHECKLIST.md)

2026-09-11 개정: 도입 순서는 자동 선택·지휘 중심의 S0~S7을 따른다. Archify를 첫 작업으로 두었던 이전 순서는 대체되었다.

r3 개발 방식: 범용 부품을 재사용하고 Cue의 판단·권한·상태 계약은 직접 소유한다. 기능 후보 조사와 분리된 연결 실험을 거쳐 채택하며, 전면 포크/결합은 기본 경로가 아니다.

## 재사용 조사 작업

아래는 기능별 재사용 의사결정 목록이다. S0 후보 비교와 격리 실험을 수행했으며 제품 편입 완료와 구분한다. 비교 기록은 `docs/reuse-decisions/`, 명령·증거·제한은 [진행 기록](INTEGRATION_PROGRESS.md)에 있다. 세부 기준은 [spec §8](INTEGRATION_SPEC.md#8-재사용-우선-개발-방식)을 따른다.

| ID | 대상 기능 | 적용 단계 | 후보 탐색 방향 | 현재 상태 |
|---|---|---|---|---|
| R-01 | 모델 API·스트리밍·오류 파싱 | S0→S1 | 공식 SDK/독립 라이브러리, pi 하위 부품 비교 | daemon transport·공통 어댑터 검사 완료, 기본 앱 실물 실행 미완료 |
| R-02 | 에이전트 CLI 프로토콜·이벤트·취소 | S0→S1 | 공식 클라이언트/공개 프로토콜, Cue 기존 경로 | 비교·Claude 오프라인 계약 검증 완료, 실제 실행 미완료 |
| R-03 | 로컬 모델 endpoint 연결·기능 탐지 | S0→S1 | 실제 endpoint 호환 SDK/클라이언트 | 격리 broker 실제 Qwen 왕복·정리 확인, 전체 자격/기본 앱 편입 미완료 |
| R-04 | 역할·모델 설정 형식 변환 | S0→S2 | TeamAI 모듈과 직접 구현 비교 | 비교·순수 변환 실험 완료, 제품 편입 미완료 |
| R-05 | 토큰·캐시·사용량 정규화 | S0→S2 | 제공자 usage 파서/SDK, Cue 기존 계산 재사용 | 비교·순수 정규화 실험 완료, 비용 원장 연결 미완료 |
| R-06 | capability/정책 입력의 스키마 검증 | S0→S2 | 작은 검증 라이브러리와 기존 검사 비교 | 비교·입력 계약 실험 완료, 전체 정책 편입 미완료 |
| R-07 | Windows 모델 경계의 실제 상태 관측 | S1 | Microsoft MXC와 좁은 native observer 비교 | MXC 전체 편입 보류, Cue native 관측·고정 진단 경로 검증, 전체 자격 발행 미완료 |
| R-08 | 출처·안정 ID·해시 기반 보고서 | S7 | Archify 고정 revision의 IR·전달 원칙 | 원칙 제한 채택, Cue IR/HTML/원자적 전달·브라우저 QA 완료, 앱 연결 진행 중 |

R-ID는 재사용 의사결정, PI/TA/AR-ID는 제품 기능 추적 단위다. 외부 후보가 기각돼도 동등한 기능을 Cue에 맞게 구현할 수 있으며 해당 결정 근거를 남긴다.

## 핵심 제품 작업

| 단계 | 기능 | 상태 |
|---|---|---|
| S0 | 현재 실행 기반·P13·후보 identity 대조 | 조사 중: 요청 후보의 비활성 신원 판정 기록, NLM/Hermes 사용자 선택 확정·설치/자격/모델 매핑 미완료 |
| S1 | 공통 도구/모델 레지스트리·런타임 연결 | 구현 중: catalog·runtime·어댑터 검증, 실물 자격 미완료 |
| S2 | 효율·고성능·가성비·속도 모드와 예산 내 자동 선택 | 구현 중: 정책·예산·조건부 모드 UI/기본값 저장 검증, 기본 실물 호스트 연결 미완료 |
| S3 | 작업 분해·배분·인계·진행 감시·세션 보존 | 구현 중: 조건부 앱 driver·단계 봉투·관측 화면 검증, 기본 실물 호스트 미완료 |
| S4 | 실패 복구·재계획·요구사항별 독립 완료 검증 | 구현 중: 조건부 인수·제한 재시도·실패 이력/UI 검증, 실제 checker·재계획·복원 미완료 |
| S5 | 실측 품질·시간·총비용 기반 선택 개선 | 계획 등록 |
| S6 | 지식·리소스 배포·회고·제한된 확장 | 계획 등록 |
| S7 | 실행·구조·비교 다이어그램 | 계획 등록 |

첫 제품 이정표는 S0~S4이며 성능 최적화 입증은 S5다. 도구/모델 후보 전체와 지원 판정 조건은 [spec §4](INTEGRATION_SPEC.md#4-연결-후보와-지원-판정)에 기록한다.

### S0 비활성 후보 결정 — 2026-09-12

후속 사용자 확인: NLM과 Hermes 제품 선택의 모호함은 해소했다. [확인 기록](../evidence/integrations/S0/20260912-confirmed-identities/report.md)이 기존 통합 검토의 두 unresolved 판정을 대체하며 실행 비활성 상태는 유지한다.

[독립 신원 통합 검토](../evidence/integrations/S0/20260912-candidate-identity/review.md)를 [비활성 후보 목록](reuse-decisions/CANDIDATE_INVENTORY.md)에 반영했다. 아래 등록은 공개 제품 신원 또는 이미 확립된 로컬 제품 신원만 추적한다. 모든 후보는 비활성·실행 불가이며 installed, authenticated, protocol-tested, qualified, enabled 또는 admitted 상태가 아니다.

| 요청 후보 | S0 결정 | 다음 해제 조건 |
|---|---|---|
| agy | Google Antigravity CLI로 `resolved-unqualified` | 설치 artifact/version, auth 참조, protocol/cleanup 실측 |
| grok build | SpaceXAI Grok Build로 `resolved-unqualified` | 설치 artifact/version, ACP/auth/lifecycle 실측 |
| openclaw | OpenClaw Gateway로 `resolved-unqualified` | Gateway identity/auth, reconnect/cancel/소유권 실측 |
| paseo | Paseo daemon/client로 `resolved-unqualified` | 설치 identity와 child/worktree lifecycle 실측 |
| orca | 이미 확립된 로컬 Orca 제품으로 `resolved-unqualified`; public repo provenance는 unresolved | 로컬 artifact/package provenance와 version-matched schema 실측 |
| herdr | `herdrdev/herdr`로 `resolved-unqualified` | 설치 identity, Windows pipe ACL, protocol/cleanup 실측 |
| pi / PI-Desktop | `vastsa/PI-Desktop`으로 `resolved-unqualified` | 설치 identity, opt-in MCP/auth/authority/lifecycle 실측 |
| nlm mcp cli | 사용자 선택 `jacob-bd/notebooklm-mcp-cli` alias → [jacob-bd/gemini-notebook-mcp-cli @03f7812](https://github.com/jacob-bd/gemini-notebook-mcp-cli/tree/03f7812c243f4d6ff732e2a485e6b9d35540f660), inactive / `resolved-unqualified` | package `notebooklm-mcp-cli`, `nlm`/`notebooklm-mcp` 설치 identity·source 대응·auth·서비스 권한/취소 실측; `tmc/nlm` 미선택 |
| hermesagent | 사용자 선택 [NousResearch/hermes-agent @2f21d29](https://github.com/NousResearch/hermes-agent/tree/2f21d29f4446134b51b7e6b1d2f515502bc0ae5e), inactive / `resolved-unqualified` | 설치 identity·source 대응·auth·protocol·tool/child/session cleanup 실측; `hermesagent/hermesforge-mcp` 미선택 |

이 결정으로 체크리스트 28, 30–32를 닫지 않는다. Codex/Claude/local endpoint identity·auth·protocol, Orca public-source provenance, 모델 canonical ID, 설치 artifact hash와 전체 제3자 자산 조건이 남아 있다. runtime catalog는 host 관측 필드만 지원하고 공개 신원 provenance/`resolved-unqualified` 상태를 표현하지 못하므로 이번 단계에서 소스 registry row를 추가하지 않는다.

## 외부 프로젝트 기능 매핑

등록은 아래 기능의 단계적 적용 계획을 뜻한다. 저장소 전체 교체·설치·외부 게시·유료 호출이 완료되었다는 뜻이 아니다. 실제 구현 착수와 완료는 별도로 기록한다.

| ID | 후보 | 적용 기능 | 작업 순서 | 현재 상태 |
|---|---|---|---|---|
| PI-01 | PI-Desktop | 도구 호출별 변경 기록·diff·해시 확인 후 되돌리기 | S4 | 계획 등록 |
| PI-02 | PI-Desktop | 모델 런타임과 Cue 실행 호스트의 인터페이스 분리 | S1 | Cue 공통 계약·어댑터 구현 중, 실물 경계 자격 미완료 |
| PI-03 | PI-Desktop | 대기 요청 영속화·응답 체크포인트 | S3 | claim·이벤트 계보 저장 구현, 요청/응답 체크포인트 전체 미완료 |
| PI-04 | PI-Desktop | 세션별 대화·변경·모델·상태 UI | S3 | 정책·단계·후보·비용 관측 구현, 대화/변경/전체 출처 미완료 |
| PI-05 | PI-Desktop | 제한된 확장 기여점·플러그인 관리 | S6 | 실행형 플러그인은 격리 검증 전 보류 |
| TA-01 | TeamAI | 프로젝트 문서·과거 실패·코드 근거 검색 | S6 | 계획 등록 |
| TA-02 | TeamAI | 공통 역할 정의와 도구별 설정 변환 | S2 | 공통 런타임 이후 적용 |
| TA-03 | TeamAI | 버전 고정된 스킬·규칙·지식 배포 | S6 | 로컬 패키지부터 적용 |
| TA-04 | TeamAI | 원장 기반 회고 초안·재사용 지식 후보 | S6 | 외부 공유는 기본 비활성 |
| AR-01 | Archify | 읽기 전용 작업 흐름·상태 보고서 | S7 | 핵심 지휘 기능 이후 적용 |
| AR-02 | Archify | 소스 근거가 있는 Cue 구조 문서 | S7 | 계획 등록 |
| AR-03 | Archify | 승인 계획 보조 그림·버전별 구조 비교 | S7 | 실제 원장·스냅샷 연동 후 적용 |

## 조사 기준

| 프로젝트 | 고정 커밋 | 라이선스 | 재사용 방침 |
|---|---|---|---|
| [vastsa/PI-Desktop](https://github.com/vastsa/PI-Desktop) | `db29ac2e8e5d59d9da8ba73d18423e964548c1a5` | LGPL-3.0 표기 | 구조 참고 우선. 코드 편입 시 적용 조건·고지·배포 방식을 먼저 기록 |
| [Tencent/teamai-cli](https://github.com/Tencent/teamai-cli) | `9e7adc79faa03ef4c3a49cb7a148bba83b7dc1f3` | MIT | 필요한 모듈만 선택하고 저작권·라이선스 고지 유지 |
| [tt-a1i/archify](https://github.com/tt-a1i/archify) | `18911058008f17dc065af23a2cdc9bfeff6d3f7a` | MIT | 렌더러·검사기 연동, 포함 자산의 제3자 고지도 확인 |

현재 평가는 소스·설계·일부 테스트 코드 열람에 기반한다. 설치, 벤치마크, Cue 통합 동작은 아직 검증하지 않았다. 최신 버전으로 변경하면 기존 평가를 그대로 승계하지 않는다.

## 유지할 Cue 기능

- 승인된 실행 범위와 실행 중 불변성.
- AppContainer 워커, 자격증명 격리, 작업 폴더 단위 writer lease.
- 프로세스 identity 기반 정지·부모 사망 처리·잔여물 검증.
- 원장, 위반 후 실행 봉인, 크래시 후 쓰기 자동 재개 금지.
- 실행 조합의 지문과 실측으로 파생하는 자격.

## 완료 기록 규칙

각 ID는 `계획 등록 → 구현 중 → 검증 대기 → 완료` 순서로 갱신한다. 완료 시 구현 커밋, 검증 명령·종료 코드, 증거 경로, 독립 검토 결과를 기록한다. 보류 항목은 해제 조건을 유지한다.
